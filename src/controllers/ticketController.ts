import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Ticket, Booking } from '../models';

// GET /api/tickets/:ticketId
export const getTicket = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { ticketId } = req.params;
    
    const ticket = await Ticket.findOne({ ticketId });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({
      ticketId: ticket.ticketId,
      bookingId: ticket.bookingId,
      qrToken: ticket.qrToken,
      from: ticket.from,
      to: ticket.to,
      date: ticket.date,
      departureTime: ticket.departureTime,
      arrivalTime: ticket.arrivalTime,
      passengerName: ticket.passengerName,
      price: ticket.price,
      isUsed: ticket.isUsed,
      usedAt: ticket.usedAt,
      createdAt: ticket.createdAt
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
};

// GET /api/tickets/email/:email
export const getTicketsByEmail = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.params;
    
    // Find all bookings for this email
    const bookings = await Booking.find({ 
      'passenger.email': email,
      status: 'paid'
    }).select('bookingId');
    
    const bookingIds = bookings.map(b => b.bookingId);
    
    // Find all tickets for these bookings
    const tickets = await Ticket.find({ 
      bookingId: { $in: bookingIds }
    }).sort({ createdAt: -1 });
    
    const ticketsData = tickets.map(ticket => ({
      ticketId: ticket.ticketId,
      bookingId: ticket.bookingId,
      from: ticket.from,
      to: ticket.to,
      date: ticket.date,
      departureTime: ticket.departureTime,
      arrivalTime: ticket.arrivalTime,
      passengerName: ticket.passengerName,
      price: ticket.price,
      isUsed: ticket.isUsed,
      usedAt: ticket.usedAt,
      createdAt: ticket.createdAt
    }));
    
    res.json({ tickets: ticketsData });
  } catch (error) {
    console.error('Error fetching tickets by email:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// POST /api/tickets/validate - Validate QR code
export const validateQRCode = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { qrToken } = req.body;
    
    const ticket = await Ticket.findOne({ qrToken });
    
    if (!ticket) {
      return res.status(404).json({ 
        valid: false,
        error: 'Ticket not found' 
      });
    }
    
    const booking = await Booking.findOne({ bookingId: ticket.bookingId });
    
    if (!booking || booking.status !== 'paid') {
      return res.status(400).json({ 
        valid: false,
        error: 'Booking not confirmed' 
      });
    }
    
    // Check if ticket is already used
    if (ticket.isUsed) {
      return res.json({
        valid: false,
        alreadyUsed: true,
        usedAt: ticket.usedAt,
        ticket: {
          ticketId: ticket.ticketId,
          from: ticket.from,
          to: ticket.to,
          date: ticket.date,
          passengerName: ticket.passengerName
        }
      });
    }
    
    // Check if ticket date is valid (not expired)
    const ticketDate = new Date(ticket.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (ticketDate < today) {
      return res.json({
        valid: false,
        expired: true,
        ticket: {
          ticketId: ticket.ticketId,
          from: ticket.from,
          to: ticket.to,
          date: ticket.date,
          passengerName: ticket.passengerName
        }
      });
    }
    
    res.json({
      valid: true,
      ticket: {
        ticketId: ticket.ticketId,
        bookingId: ticket.bookingId,
        from: ticket.from,
        to: ticket.to,
        date: ticket.date,
        departureTime: ticket.departureTime,
        arrivalTime: ticket.arrivalTime,
        passengerName: ticket.passengerName,
        price: ticket.price
      }
    });
  } catch (error) {
    console.error('Error validating QR code:', error);
    res.status(500).json({ error: 'Failed to validate QR code' });
  }
};

// POST /api/tickets/use - Mark ticket as used
export const useTicket = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { qrToken } = req.body;
    
    const ticket = await Ticket.findOne({ qrToken });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.isUsed) {
      return res.status(400).json({ 
        error: 'Ticket already used',
        usedAt: ticket.usedAt 
      });
    }
    
    ticket.isUsed = true;
    ticket.usedAt = new Date();
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket marked as used',
      ticket: {
        ticketId: ticket.ticketId,
        from: ticket.from,
        to: ticket.to,
        passengerName: ticket.passengerName,
        usedAt: ticket.usedAt
      }
    });
  } catch (error) {
    console.error('Error using ticket:', error);
    res.status(500).json({ error: 'Failed to mark ticket as used' });
  }
};