import mongoose, { Schema, Document } from 'mongoose';

// ===== ROUTE MODEL =====
export interface IRoute extends Document {
  from: string;
  to: string;
  basePrice: number;
  currency: 'RON' | 'EUR';
  departureTime: string;
  arrivalTime: string;
  fromStation: string;
  toStation: string;
  active: boolean;
  availableDays?: number[]; // Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday). If null/undefined, route is available daily.
  studentDiscount?: number; // Fixed amount discount for students (only for Romania-Chisinau routes, not Switzerland)
  closedDates?: string[]; // ISO date strings (YYYY-MM-DD) when bookings are closed
}

const RouteSchema = new Schema<IRoute>({
  from: { type: String, required: true, trim: true },
  to: { type: String, required: true, trim: true },
  basePrice: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['RON', 'EUR'], default: 'RON' },
  departureTime: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  fromStation: { type: String, required: true },
  toStation: { type: String, required: true },
  active: { type: Boolean, default: true },
  availableDays: { 
    type: [Number], 
    default: null,
    validate: {
      validator: function(days: number[] | null | undefined) {
        if (!days || days.length === 0) return true; // null or empty = available daily
        return days.every(day => day >= 0 && day <= 6); // 0-6 are valid day numbers
      },
      message: 'availableDays must contain numbers between 0 (Sunday) and 6 (Saturday)'
    }
  },
  studentDiscount: { 
    type: Number, 
    default: null,
    min: 0,
    validate: {
      validator: function(value: number | null | undefined) {
        if (value === null || value === undefined) return true;
        return value >= 0;
      },
      message: 'studentDiscount must be a positive number'
    }
  },
  closedDates: {
    type: [String],
    default: [],
    validate: {
      validator: function(dates: string[] | undefined) {
        if (!dates || dates.length === 0) return true;
        return dates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
      },
      message: 'closedDates must be an array of ISO date strings (YYYY-MM-DD)'
    }
  }
}, { timestamps: true });

RouteSchema.index({ from: 1, to: 1 });

export const Route = mongoose.model<IRoute>('Route', RouteSchema);

// ===== BOOKING MODEL =====
export interface IPassenger {
  name: string;
  surname: string;
  email: string;
  phone: string;
}

export interface IBooking extends Document {
  bookingId: string;
  from: string;
  to: string;
  date: Date;
  departureTime: string;
  arrivalTime: string;
  passenger: IPassenger;
  subtotal: number;
  fees: number;
  discount: number; // Promo code discount
  studentDiscount?: number; // Student discount (optional)
  total: number;
  currency: 'RON' | 'EUR';
  promoCode?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentIntentId?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  bookingId: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  date: { type: Date, required: true },
  departureTime: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  passenger: {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  subtotal: { type: Number, required: true },
  fees: { type: Number, required: true },
  discount: { type: Number, default: 0 }, // Promo code discount
  studentDiscount: { type: Number, default: 0, min: 0 }, // Student discount (optional)
  total: { type: Number, required: true },
  currency: { type: String, enum: ['RON', 'EUR'], default: 'RON' },
  promoCode: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentIntentId: { type: String },
  stripeCustomerId: { type: String }
}, { timestamps: true });

BookingSchema.index({ 'passenger.email': 1 });
BookingSchema.index({ status: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);

// ===== TICKET MODEL =====
export interface ITicket extends Document {
  ticketId: string;
  bookingId: string;
  qrToken: string;
  from: string;
  to: string;
  date: Date;
  departureTime: string;
  arrivalTime: string;
  passengerName: string;
  price: number;
  currency: 'RON' | 'EUR';
  isUsed: boolean;
  usedAt?: Date;
  pdfUrl?: string;
  createdAt: Date;
}

const TicketSchema = new Schema<ITicket>({
  ticketId: { type: String, required: true, unique: true },
  bookingId: { type: String, required: true },
  qrToken: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  date: { type: Date, required: true },
  departureTime: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  passengerName: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, enum: ['RON', 'EUR'], default: 'RON' },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
  pdfUrl: { type: String }
}, { timestamps: true });

TicketSchema.index({ bookingId: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);

// ===== PROMO CODE MODEL =====
export interface IPromoCode extends Document {
  code: string;
  discountPercent: number;
  discountFixed: number;
  maxDiscount: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit: number;
  usageCount: number;
  active: boolean;
}

const PromoCodeSchema = new Schema<IPromoCode>({
  code: { type: String, required: true, unique: true, uppercase: true },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  discountFixed: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, default: 0 },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  usageLimit: { type: Number, default: 0 }, // 0 = unlimited
  usageCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });


export const PromoCode = mongoose.model<IPromoCode>('PromoCode', PromoCodeSchema);