import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { Booking, Route, PromoCode } from '../models';

const normalizeTravelDate = (input: string | Date): Date => {
  let date: Date;

  if (input instanceof Date) {
    date = new Date(input.getTime());
  } else {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('Date value cannot be empty');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      date = new Date(`${trimmed}T00:00:00.000Z`);
    } else {
      date = new Date(trimmed);
    }
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }

  if (date.getUTCHours() >= 12) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const formatDateKey = (input: string | Date): string => {
  return normalizeTravelDate(input).toISOString().split('T')[0];
};

// POST /api/bookings
export const createBooking = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { from, to, date, passenger, promoCode, studentDiscount } = req.body;
    
    // Find route
    const route = await Route.findOne({ from, to, active: true });
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    // Check if route is available on the selected date
    const selectedDate = new Date(date);
    const travelDate = normalizeTravelDate(selectedDate);
    const dayOfWeek = travelDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // If availableDays is set and not empty, check if the selected day is available
    if (route.availableDays && route.availableDays.length > 0) {
      if (!route.availableDays.includes(dayOfWeek)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDayNames = route.availableDays.map(day => dayNames[day]).join(', ');
        
        console.error(`❌ [BOOKING] Route not available on selected date`);
        console.error(`   Requested date: ${date}`);
        console.error(`   Requested day: ${dayNames[selectedDate.getDay()]}`);
        console.error(`   Normalized date: ${travelDate.toISOString()}`);
        console.error(`   Normalized day: ${dayNames[dayOfWeek]}`);
        console.error(`   Available days: ${availableDayNames}`);
        
        return res.status(400).json({ 
          error: 'Route not available on selected date',
          message: `This route is only available on: ${availableDayNames}`,
          requestedDate: date,
          requestedDay: dayNames[selectedDate.getDay()],
          normalizedDate: travelDate.toISOString(),
          normalizedDay: dayNames[dayOfWeek],
          availableDays: route.availableDays,
          availableDayNames: availableDayNames
        });
      }
    }

    const travelDateKey = formatDateKey(travelDate);

    if (route.closedDates && route.closedDates.includes(travelDateKey)) {
      console.error(`❌ [BOOKING] Route closed for selected date`);
      console.error(`   Requested date: ${date}`);
      console.error(`   Normalized travel date: ${travelDateKey}`);
      console.error(`   Closed dates: ${route.closedDates.join(', ')}`);

      return res.status(400).json({
        error: 'Route closed on selected date',
        message: 'Bookings are temporarily closed for the selected date',
        requestedDate: date,
        travelDate: travelDateKey,
        closedDates: route.closedDates
      });
    }
    
    // Calculate pricing
    const subtotal = route.basePrice;
    const fees = Math.max(3, Math.round(subtotal * 0.015 * 100) / 100);
    
    let discount = 0; // Promo code discount
    let validPromoCode = null;
    
    // Validate promo code if provided
    if (promoCode) {
      const promo = await PromoCode.findOne({ 
        code: promoCode.toUpperCase(),
        active: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });
      
      if (promo) {
        if (promo.usageLimit === 0 || promo.usageCount < promo.usageLimit) {
          if (promo.discountPercent > 0) {
            discount = Math.round(subtotal * (promo.discountPercent / 100) * 100) / 100;
            if (promo.maxDiscount > 0) {
              discount = Math.min(discount, promo.maxDiscount);
            }
          } else if (promo.discountFixed > 0) {
            discount = promo.discountFixed;
          }
          validPromoCode = promo.code;
        }
      }
    }
    
    // Validate and apply student discount
    let studentDiscountAmount = 0;
    if (studentDiscount !== undefined && studentDiscount !== null) {
      const studentDiscountValue = Number(studentDiscount);
      if (studentDiscountValue > 0) {
        // Verify that the route has student discount available
        if (route.studentDiscount && route.studentDiscount > 0) {
          // Use the student discount from the route (backend validation)
          studentDiscountAmount = Math.min(studentDiscountValue, route.studentDiscount);
        }
      }
    }
    
    // Calculate total: subtotal + fees - promo discount - student discount
    const total = Math.max(0, subtotal + fees - discount - studentDiscountAmount);
    
    // Create booking
    const booking = new Booking({
      bookingId: `BK-${uuidv4().substring(0, 8).toUpperCase()}`,
      from,
      to,
      date: travelDate,
      departureTime: route.departureTime,
      arrivalTime: route.arrivalTime,
      passenger,
      subtotal,
      fees,
      discount, // Promo code discount
      studentDiscount: studentDiscountAmount > 0 ? studentDiscountAmount : undefined, // Student discount (only if > 0)
      total,
      currency: route.currency,
      promoCode: validPromoCode,
      status: 'pending'
    });
    
    await booking.save();
    
    const travelDateIso = booking.date.toISOString();
    const requestedDateIso = selectedDate.toISOString();

    res.status(201).json({
      bookingId: booking.bookingId,
      from: booking.from,
      to: booking.to,
      date: travelDateIso,
      travelDate: travelDateIso,
      requestedDate: requestedDateIso,
      closedDates: route.closedDates || [],
      departureTime: booking.departureTime,
      arrivalTime: booking.arrivalTime,
      passenger: booking.passenger,
      subtotal: booking.subtotal,
      fees: booking.fees,
      discount: booking.discount,
      studentDiscount: booking.studentDiscount || 0,
      total: booking.total,
      currency: booking.currency,
      promoCode: booking.promoCode,
      status: booking.status
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
};

// GET /api/bookings/:bookingId
export const getBooking = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findOne({ bookingId });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const travelDateIso = booking.date.toISOString();

    res.json({
      bookingId: booking.bookingId,
      from: booking.from,
      to: booking.to,
      date: travelDateIso,
      travelDate: travelDateIso,
      departureTime: booking.departureTime,
      arrivalTime: booking.arrivalTime,
      passenger: booking.passenger,
      subtotal: booking.subtotal,
      fees: booking.fees,
      discount: booking.discount,
      studentDiscount: booking.studentDiscount || 0,
      total: booking.total,
      currency: booking.currency,
      promoCode: booking.promoCode,
      status: booking.status,
      createdAt: booking.createdAt
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
};

// GET /api/bookings - Get all bookings (optionally filtered by status)
export const getAllBookings = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { status } = req.query;

    const filter: Record<string, unknown> = {};
    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });

    res.json(
      bookings.map((booking) => ({
        bookingId: booking.bookingId,
        from: booking.from,
        to: booking.to,
        date: booking.date.toISOString(),
        travelDate: booking.date.toISOString(),
        departureTime: booking.departureTime,
        arrivalTime: booking.arrivalTime,
        passenger: booking.passenger,
        subtotal: booking.subtotal,
        fees: booking.fees,
        discount: booking.discount,
        studentDiscount: booking.studentDiscount || 0,
        total: booking.total,
        currency: booking.currency,
        promoCode: booking.promoCode,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }))
    );
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// POST /api/promo/validate
export const validatePromoCode = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { code, subtotal } = req.body;
    
    const promo = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      active: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });
    
    if (!promo) {
      return res.status(404).json({ 
        valid: false,
        error: 'Promo code not found or expired' 
      });
    }
    
    if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
      return res.status(400).json({ 
        valid: false,
        error: 'Promo code usage limit reached' 
      });
    }
    
    let discount = 0;
    
    if (promo.discountPercent > 0) {
      discount = Math.round(subtotal * (promo.discountPercent / 100) * 100) / 100;
      if (promo.maxDiscount > 0) {
        discount = Math.min(discount, promo.maxDiscount);
      }
    } else if (promo.discountFixed > 0) {
      discount = promo.discountFixed;
    }
    
    res.json({
      valid: true,
      code: promo.code,
      discount,
      discountPercent: promo.discountPercent,
      discountFixed: promo.discountFixed
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({ error: 'Failed to validate promo code' });
  }
};
