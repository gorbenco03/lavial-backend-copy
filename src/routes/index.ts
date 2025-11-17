import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as routeController from '../controllers/routeController';
import * as bookingController from '../controllers/bookingController';
import * as paymentController from '../controllers/paymentController';
import * as ticketController from '../controllers/ticketController';

const router = Router();

// ===== HEALTH CHECK =====
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== ROUTES ENDPOINTS =====
// GET /api/cities - Get all available cities
router.get('/cities', routeController.getCities);

// GET /api/destinations/:from - Get destinations for a city
router.get('/destinations/:from', 
  param('from').trim().notEmpty(),
  routeController.getDestinations
);

// GET /api/routes/:from/:to/student-discount - Get student discount for a route
router.get('/routes/:from/:to/student-discount',
  param('from').trim().notEmpty(),
  param('to').trim().notEmpty(),
  routeController.getStudentDiscount
);

// GET /api/routes/:from/:to/available-days - Get available days for a route
router.get('/routes/:from/:to/available-days',
  param('from').trim().notEmpty(),
  param('to').trim().notEmpty(),
  routeController.getRouteAvailableDays
);

// POST /api/trips/search - Search for trip details
router.post('/trips/search',
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('date').isISO8601(),
  routeController.searchTrip
);

// ===== ADMIN ROUTE MANAGEMENT =====
router.get('/admin/routes',
  query('active').optional().isBoolean().toBoolean(),
  routeController.getAllRoutesAdmin
);

router.post('/admin/routes',
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('basePrice').isFloat({ min: 0 }),
  body('currency').isIn(['RON', 'EUR']),
  body('departureTime').trim().notEmpty(),
  body('arrivalTime').trim().notEmpty(),
  body('fromStation').trim().notEmpty(),
  body('toStation').trim().notEmpty(),
  body('active')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return value;
    })
    .optional({ nullable: true })
    .isBoolean()
    .toBoolean(),
  body('availableDays')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          return value;
        }
      }
      return value;
    })
    .optional({ nullable: true })
    .custom((days) => {
      if (days === null || days === undefined) {
        return true;
      }
      if (!Array.isArray(days)) {
        throw new Error('availableDays must be an array or JSON array of integers between 0 and 6');
      }
      if (days.length === 0) {
        return true;
      }
      const valid = days.every((day) => {
        const parsed = Number(day);
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6;
      });
      if (!valid) {
        throw new Error('availableDays must contain integers between 0 and 6');
      }
      return true;
    }),
  body('studentDiscount')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return value;
    })
    .optional({ nullable: true })
    .isFloat({ min: 0 }),
  body('closedDates')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return value;
    })
    .optional({ nullable: true }),
  routeController.createRoute
);

router.patch('/admin/routes/:id',
  param('id').isMongoId(),
  body('from').optional().trim().notEmpty(),
  body('to').optional().trim().notEmpty(),
  body('basePrice').optional().isFloat({ min: 0 }),
  body('currency').optional().isIn(['RON', 'EUR']),
  body('departureTime').optional().trim().notEmpty(),
  body('arrivalTime').optional().trim().notEmpty(),
  body('fromStation').optional().trim().notEmpty(),
  body('toStation').optional().trim().notEmpty(),
  body('active')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return value;
    })
    .optional({ nullable: true })
    .isBoolean()
    .toBoolean(),
  body('availableDays')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          return value;
        }
      }
      return value;
    })
    .optional({ nullable: true })
    .custom((days) => {
      if (days === null || days === undefined) {
        return true;
      }
      if (!Array.isArray(days)) {
        throw new Error('availableDays must be an array or JSON array of integers between 0 and 6');
      }
      if (days.length === 0) {
        return true;
      }
      const valid = days.every((day) => {
        const parsed = Number(day);
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6;
      });
      if (!valid) {
        throw new Error('availableDays must contain integers between 0 and 6');
      }
      return true;
    }),
  body('studentDiscount')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return value;
    })
    .optional({ nullable: true })
    .isFloat({ min: 0 }),
  body('closedDates')
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return value;
    })
    .optional({ nullable: true }),
  routeController.updateRoute
);

router.delete('/admin/routes/:id',
  param('id').isMongoId(),
  routeController.deleteRoute
);

router.post('/admin/routes/:id/closed-dates',
  param('id').isMongoId(),
  body('date')
    .trim()
    .notEmpty()
    .custom((value) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return true;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('date must be a valid ISO date (YYYY-MM-DD)');
      }
      return true;
    }),
  routeController.addClosedDate
);

router.delete('/admin/routes/:id/closed-dates/:date',
  param('id').isMongoId(),
  param('date')
    .trim()
    .notEmpty()
    .custom((value) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return true;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('date must be a valid ISO date (YYYY-MM-DD)');
      }
      return true;
    }),
  routeController.removeClosedDate
);

// ===== BOOKING ENDPOINTS =====
// POST /api/bookings - Create a new booking
router.post('/bookings',
  body('from').trim().notEmpty(),
  body('to').trim().notEmpty(),
  body('date').isISO8601(),
  body('passenger.name').trim().notEmpty(),
  body('passenger.surname').trim().notEmpty(),
  body('passenger.email').isEmail(),
  body('passenger.phone').trim().notEmpty(),
  body('promoCode').optional().trim(),
  body('studentDiscount').optional().isFloat({ min: 0 }),
  bookingController.createBooking
);

// GET /api/bookings - Get all bookings
router.get('/bookings',
  query('status').optional().isIn(['pending', 'paid', 'cancelled', 'refunded']),
  bookingController.getAllBookings
);

// GET /api/bookings/:bookingId - Get booking details
router.get('/bookings/:bookingId',
  param('bookingId').trim().notEmpty(),
  bookingController.getBooking
);

// ===== PAYMENT ENDPOINTS =====
// POST /api/payments/payment-sheet - Create Stripe Payment Intent
router.post('/payments/payment-sheet',
  body('bookingId').trim().notEmpty(),
  body('totalAmount').optional().isFloat({ min: 0 }),
  body('studentDiscount').optional().isFloat({ min: 0 }),
  paymentController.createPaymentSheet
);

// POST /api/payments/webhook - Stripe webhook for payment confirmation
router.post('/payments/webhook',
  paymentController.handleWebhook
);

// ===== PROMO CODE ENDPOINTS =====
// POST /api/promo/validate - Validate promo code
router.post('/promo/validate',
  body('code').trim().notEmpty(),
  body('subtotal').isFloat({ min: 0 }),
  bookingController.validatePromoCode
);

// ===== TICKET ENDPOINTS =====
// GET /api/tickets/:ticketId - Get ticket details
router.get('/tickets/:ticketId',
  param('ticketId').trim().notEmpty(),
  ticketController.getTicket
);

// GET /api/tickets/email/:email - Get all tickets for an email
router.get('/tickets/email/:email',
  param('email').isEmail(),
  ticketController.getTicketsByEmail
);

// POST /api/tickets/validate - Validate QR code (for drivers/staff)
router.post('/tickets/validate',
  body('qrToken').trim().notEmpty(),
  ticketController.validateQRCode
);

// POST /api/tickets/use - Mark ticket as used (for drivers/staff)
router.post('/tickets/use',
  body('qrToken').trim().notEmpty(),
  ticketController.useTicket
);

export default router;