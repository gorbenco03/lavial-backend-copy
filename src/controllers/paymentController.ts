import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Stripe from 'stripe';
import { Booking, Ticket, PromoCode } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { generateTicketPDF, sendTicketEmail } from '../utils/ticketUtils';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// POST /api/payments/payment-sheet
export const createPaymentSheet = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('❌ [PAYMENT] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { bookingId, totalAmount, studentDiscount } = req.body;
    
    const booking = await Booking.findOne({ bookingId });
    
    if (!booking) {
      console.error(`❌ [PAYMENT] Booking not found: ${bookingId}`);
      return res.status(404).json({ 
        error: 'Booking not found',
        bookingId: bookingId,
        searchedIn: 'Booking collection'
      });
    }
    
    // Use totalAmount from request if provided (for backward compatibility),
    // otherwise use booking.total (which already includes student discount if applied)
    const amountToCharge = totalAmount !== undefined && totalAmount !== null ? Number(totalAmount) : booking.total;
    
    // Only update booking.total if totalAmount is significantly different (for error correction)
    if (totalAmount !== undefined && totalAmount !== null && Math.abs(Number(totalAmount) - booking.total) > 0.01) {
      booking.total = Number(totalAmount);
      await booking.save();
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Booking already processed',
        currentStatus: booking.status
      });
    }
    
    // Validate currency
    const currency = booking.currency?.toLowerCase() || 'ron';
    if (currency !== 'ron' && currency !== 'eur') {
      console.error(`❌ [PAYMENT] Invalid currency: ${booking.currency}`);
      return res.status(400).json({ 
        error: 'Invalid currency',
        currency: booking.currency,
        supportedCurrencies: ['RON', 'EUR']
      });
    }
    
    // Create or retrieve Stripe customer
    let customerId = booking.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: booking.passenger.email,
        name: `${booking.passenger.name} ${booking.passenger.surname}`,
        phone: booking.passenger.phone,
        metadata: {
          bookingId: booking.bookingId
        }
      });
      
      customerId = customer.id;
      booking.stripeCustomerId = customerId;
      await booking.save();
    }
    
    // Create payment intent
    const amountInCents = Math.round(amountToCharge * 100);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, // Convert to cents
      currency: currency, // 'ron' or 'eur' (lowercase for Stripe)
      customer: customerId,
      metadata: {
        bookingId: booking.bookingId,
        from: booking.from,
        to: booking.to,
        date: booking.date.toISOString(),
        currency: booking.currency // Store original currency format
      },
      automatic_payment_methods: {
        enabled: true
      }
    });
    
    // Create ephemeral key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );
    
    // Update booking with payment intent
    booking.paymentIntentId = paymentIntent.id;
    await booking.save();
    
    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Error creating payment sheet:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    res.status(500).json({ 
      error: 'Failed to create payment sheet',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// POST /api/payments/webhook
export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  
  if (!sig) {
    console.error('❌ [WEBHOOK] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  
  if (!webhookSecret) {
    console.error('❌ [WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  // Ensure body is a Buffer (required by Stripe)
  let body = req.body;
  if (!Buffer.isBuffer(body)) {
    if (typeof body === 'string') {
      body = Buffer.from(body);
    } else {
      body = Buffer.from(JSON.stringify(body));
    }
  }
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('❌ [WEBHOOK] Signature verification failed:', err.message);
    console.error('   Error details:', err);
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      message: err.message 
    });
  }
  
  try {
    console.log(`🔔 [WEBHOOK] Event received: ${event.type} (id: ${event.id})`);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    // Still send 200 to Stripe so it doesn't retry
    res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
  }
};

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const bookingId = paymentIntent.metadata.bookingId;
    const paymentIntentId = paymentIntent.id;
    const amountReceived = paymentIntent.amount_received ?? paymentIntent.amount ?? 0;
    const amountReceivedUnit = amountReceived / 100;
    const currency = paymentIntent.currency?.toUpperCase();
    
    console.log('✅ [PAYMENT_SUCCESS] Event details', {
      bookingId,
      paymentIntentId,
      amountReceived,
      amountReceivedUnit,
      currency,
      livemode: paymentIntent.livemode
    });
    
    if (!bookingId) {
      console.error('❌ [PAYMENT_SUCCESS] No bookingId in payment intent metadata');
      console.error('   Available metadata keys:', Object.keys(paymentIntent.metadata));
      throw new Error('Booking ID not found in payment intent metadata');
    }
    
    const booking = await Booking.findOne({ bookingId });
    
    if (!booking) {
      console.error(`❌ [PAYMENT_SUCCESS] Booking not found: ${bookingId}`);
      console.error(`   Total bookings in DB: ${await Booking.countDocuments()}`);
      const recentBookings = await Booking.find().limit(5).select('bookingId status').sort({ createdAt: -1 });
      console.error(`   Recent bookings:`, recentBookings.map(b => ({ id: b.bookingId, status: b.status })));
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status === 'paid') {
      console.warn(`ℹ️ [PAYMENT_SUCCESS] Booking ${bookingId} already marked as paid. Skipping duplicate processing.`);
      return;
    }

    const previousStatus = booking.status;
    
    // Update booking status
    booking.status = 'paid';
    booking.paymentIntentId = paymentIntentId;
    if (amountReceived > 0) {
      booking.total = amountReceivedUnit;
    }
    if (currency && (currency === 'RON' || currency === 'EUR')) {
      booking.currency = currency;
    }
    await booking.save();

    console.log('✅ [PAYMENT_SUCCESS] Booking updated', {
      bookingId: booking.bookingId,
      previousStatus,
      newStatus: booking.status,
      total: booking.total,
      currency: booking.currency,
      paymentIntentId: booking.paymentIntentId
    });
    
    // Increment promo code usage if used
    if (booking.promoCode) {
      await PromoCode.findOneAndUpdate(
        { code: booking.promoCode },
        { $inc: { usageCount: 1 } }
      );
    }
    
    // Check if a ticket already exists (idempotency)
    let ticket = await Ticket.findOne({ bookingId: booking.bookingId });

    if (!ticket) {
      const ticketId = `TK-${uuidv4().substring(0, 8).toUpperCase()}`;
      const qrToken = uuidv4();
      
      ticket = new Ticket({
        ticketId,
        bookingId: booking.bookingId,
        qrToken,
        from: booking.from,
        to: booking.to,
        date: booking.date,
        departureTime: booking.departureTime,
        arrivalTime: booking.arrivalTime,
        passengerName: `${booking.passenger.name} ${booking.passenger.surname}`,
        price: booking.total,
        currency: booking.currency,
        isUsed: false
      });
      
      await ticket.save();

      console.log('🎟️ [PAYMENT_SUCCESS] Ticket generated', {
        ticketId: ticket.ticketId,
        bookingId: ticket.bookingId
      });
    } else {
      console.warn(`ℹ️ [PAYMENT_SUCCESS] Ticket already exists for booking ${booking.bookingId} (ticketId: ${ticket.ticketId}). Skipping creation.`);
    }
    
    // Generate PDF and send email asynchronously (don't block webhook)
    const pdfBuffer = await generateTicketPDF(ticket, booking);
    
    // Send email asynchronously - don't block webhook response
    // If email fails, it won't affect the webhook success
    sendTicketEmail(
      booking.passenger.email,
      booking.passenger.name,
      ticket,
      booking,
      pdfBuffer
    ).then(() => {
      console.log(`📧 [PAYMENT_SUCCESS] Ticket email sent to ${booking.passenger.email}`);
    }).catch((emailError) => {
      console.error(`❌ [PAYMENT_SUCCESS] Failed to send email to ${booking.passenger.email}:`, emailError);
      console.error('   Email error details:', emailError instanceof Error ? emailError.message : emailError);
      // Don't throw - email failure shouldn't fail the webhook
    });
  } catch (error) {
    console.error('❌ [PAYMENT_SUCCESS] Error handling payment success:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    throw error; // Re-throw to be caught by webhook handler
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const bookingId = paymentIntent.metadata.bookingId;
    
    if (!bookingId) {
      console.error('❌ [PAYMENT_FAILED] No bookingId in payment intent metadata');
      console.error('   Available metadata keys:', Object.keys(paymentIntent.metadata));
      throw new Error('Booking ID not found in payment intent metadata');
    }
    
    const result = await Booking.findOneAndUpdate(
      { bookingId },
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!result) {
      console.error(`❌ [PAYMENT_FAILED] Booking ${bookingId} not found`);
      console.error(`   Total bookings in DB: ${await Booking.countDocuments()}`);
      throw new Error(`Booking ${bookingId} not found`);
    }
  } catch (error) {
    console.error('❌ [PAYMENT_FAILED] Error handling payment failure:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    throw error; // Re-throw to be caught by webhook handler
  }
}
