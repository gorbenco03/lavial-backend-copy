import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { connectDatabase } from './config/database';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.set('trust proxy', 1);

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/$/, '').toLowerCase();

const rawOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

console.log('[CORS] Configured allowed origins:', allowedOrigins);

if (allowedOrigins.length === 0) {
  console.warn('[CORS] ⚠️  No CORS_ORIGINS configured; allowing all origins');
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      console.log('[CORS] ✓ Allowing request with no origin');
      return callback(null, true);
    }

    const cleanOrigin = normalizeOrigin(origin);
    console.log(`[CORS] Request from origin: ${origin} (normalized: ${cleanOrigin})`);

    // If no origins configured, allow all
    if (allowedOrigins.length === 0) {
      console.log('[CORS] ✓ Allowing (no restrictions configured)');
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(cleanOrigin)) {
      console.log('[CORS] ✓ Origin allowed');
      return callback(null, true);
    }

    // Origin not allowed
    console.warn(`[CORS] ✗ Blocked request from origin: ${origin}`);
    console.warn(`[CORS] Allowed origins are: ${allowedOrigins.join(', ')}`);
    return callback(new Error(`CORS not allowed from origin: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Disable Express ETag for all responses
app.set('etag', false);

// ============================================
// APPLE PAY DOMAIN VERIFICATION
// ============================================
// This MUST be before other middleware to ensure it's served correctly

// Servește întreg folderul .well-known ca static (acceptă orice extensie sau fără extensie)
app.use('/.well-known', express.static(path.join(__dirname, '../public/.well-known'), {
  setHeaders: (res) => {
    res.type('text/plain');
  }
}));

// Fallback explicit pentru fișierul Apple Pay (cu sau fără .txt)
app.get('/.well-known/apple-developer-merchantid-domain-association*', (req: Request, res: Response) => {
  const filePath = path.join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association');
  
  console.log('[Apple Pay] Serving domain verification file');
  console.log('[Apple Pay] Requested URL:', req.url);
  console.log('[Apple Pay] File path:', filePath);
  
  res.type('text/plain');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[Apple Pay] ❌ Error serving verification file:', err);
      console.error('[Apple Pay] Error details:', err.message);
      res.status(404).send('Apple Pay verification file not found');
    } else {
      console.log('[Apple Pay] ✓ Domain verification file served successfully');
    }
  });
});

// ============================================
// END APPLE PAY CONFIGURATION
// ============================================

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsing - Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// General JSON and URL-encoded body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Lavial API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      cities: '/api/cities',
      destinations: '/api/destinations/:from',
      search: '/api/trips/search',
      bookings: '/api/bookings',
      payments: '/api/payments/payment-sheet',
      tickets: '/api/tickets/:ticketId',
      applePay: '/.well-known/apple-developer-merchantid-domain-association'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    attemptedPath: req.path,
    method: req.method
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS not allowed')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed by CORS policy',
      origin: req.headers.origin
    });
  }
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
async function startServer() {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS Origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'ALL (not recommended for production)'}`);
      console.log(`📱 Apple Pay verification: /.well-known/apple-developer-merchantid-domain-association`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;