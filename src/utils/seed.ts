import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Route, PromoCode } from '../models';
import { connectDatabase } from '../config/database';

dotenv.config();

/**
 * ⚠️ IMPORTANT: This seed file contains DEMO/EXAMPLE data only!
 * 
 * This file contains example routes and promo codes for demonstration purposes.
 * All prices, routes, and schedules are examples and should not be used in production.
 * 
 * For production use:
 * 1. Create a separate seed file with real production data (e.g., seed.production.ts)
 * 2. Add seed.production.ts to .gitignore to keep production data private
 * 3. Use the production seed file only in your production environment
 */

/**
 * Example routes data - DEMO ONLY
 * These are sample routes with example prices and schedules for demonstration.
 */
const routesData = [
  // Example routes from City A
  { from: "City A", to: "City B", basePrice: 100, currency: "RON", departureTime: "08:00", arrivalTime: "12:00", fromStation: "Central Station", toStation: "Main Terminal", active: true },
  { from: "City A", to: "City C", basePrice: 150, currency: "RON", departureTime: "09:00", arrivalTime: "14:00", fromStation: "Central Station", toStation: "Downtown Station", active: true },
  { from: "City A", to: "City D", basePrice: 200, currency: "RON", departureTime: "10:00", arrivalTime: "16:00", fromStation: "Central Station", toStation: "North Terminal", active: true },
  
  // Example routes from City B
  { from: "City B", to: "City A", basePrice: 100, currency: "RON", departureTime: "13:00", arrivalTime: "17:00", fromStation: "Main Terminal", toStation: "Central Station", active: true },
  { from: "City B", to: "City C", basePrice: 120, currency: "RON", departureTime: "14:00", arrivalTime: "18:00", fromStation: "Main Terminal", toStation: "Downtown Station", active: true },
  { from: "City B", to: "City E", basePrice: 180, currency: "RON", departureTime: "15:00", arrivalTime: "21:00", fromStation: "Main Terminal", toStation: "East Terminal", active: true },
  
  // Example routes from City C
  { from: "City C", to: "City A", basePrice: 150, currency: "RON", departureTime: "16:00", arrivalTime: "21:00", fromStation: "Downtown Station", toStation: "Central Station", active: true },
  { from: "City C", to: "City B", basePrice: 120, currency: "RON", departureTime: "17:00", arrivalTime: "21:00", fromStation: "Downtown Station", toStation: "Main Terminal", active: true },
  { from: "City C", to: "City F", basePrice: 250, currency: "RON", departureTime: "18:00", arrivalTime: "02:00", fromStation: "Downtown Station", toStation: "South Terminal", active: true },
  
  // Example routes from City D
  { from: "City D", to: "City A", basePrice: 200, currency: "RON", departureTime: "07:00", arrivalTime: "13:00", fromStation: "North Terminal", toStation: "Central Station", active: true },
  { from: "City D", to: "City E", basePrice: 160, currency: "RON", departureTime: "08:00", arrivalTime: "14:00", fromStation: "North Terminal", toStation: "East Terminal", active: true },
  
  // Example routes from City E
  { from: "City E", to: "City B", basePrice: 180, currency: "RON", departureTime: "10:00", arrivalTime: "16:00", fromStation: "East Terminal", toStation: "Main Terminal", active: true },
  { from: "City E", to: "City D", basePrice: 160, currency: "RON", departureTime: "11:00", arrivalTime: "17:00", fromStation: "East Terminal", toStation: "North Terminal", active: true },
  
  // Example routes from City F
  { from: "City F", to: "City C", basePrice: 250, currency: "RON", departureTime: "20:00", arrivalTime: "04:00", fromStation: "South Terminal", toStation: "Downtown Station", active: true },
  
  // Example international routes (EUR)
  { from: "City A", to: "International City 1", basePrice: 150, currency: "EUR", availableDays: [4], departureTime: "06:00", arrivalTime: "18:00", fromStation: "Central Station", toStation: "International Terminal", active: true },
  { from: "City A", to: "International City 2", basePrice: 200, currency: "EUR", availableDays: [4], departureTime: "07:00", arrivalTime: "20:00", fromStation: "Central Station", toStation: "International Hub", active: true },
  { from: "International City 1", to: "City A", basePrice: 150, currency: "EUR", availableDays: [0], departureTime: "08:00", arrivalTime: "20:00", fromStation: "International Terminal", toStation: "Central Station", active: true },
];

/**
 * ⚠️ DEMO PROMO CODES - Replace with your real production promo codes!
 * 
 * These are example codes for demonstration purposes only.
 * In production, use your actual promo codes and discount values.
 */
const promoCodesData = [
  {
    code: 'DEMO10', // Example code - replace with real code
    discountPercent: 10,
    discountFixed: 0,
    maxDiscount: 20,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2025-12-31'),
    usageLimit: 0, // unlimited
    active: true
  },
  {
    code: 'SAMPLE20', // Example code - replace with real code
    discountFixed: 20,
    discountPercent: 0,
    maxDiscount: 0,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2025-12-31'),
    usageLimit: 100,
    active: true
  },
  {
    code: 'EXAMPLE5', // Example code - replace with real code
    discountPercent: 5,
    discountFixed: 0,
    maxDiscount: 10,
    validFrom: new Date('2024-06-01'),
    validUntil: new Date('2025-09-01'),
    usageLimit: 0,
    active: true
  }
];

async function seed() {
  try {
    console.log('🌱 Starting database seed with DEMO data...');
    console.log('⚠️  WARNING: This seed contains DEMO/EXAMPLE data only!');
    console.log('📝 Routes data count:', routesData.length);
    console.log('📝 Promo codes data count:', promoCodesData.length);
    
    await connectDatabase();
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`✅ Database connected to: "${dbName}"`);
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    const deletedRoutes = await Route.deleteMany({});
    const deletedPromoCodes = await PromoCode.deleteMany({});
    console.log(`🗑️  Deleted ${deletedRoutes.deletedCount} routes and ${deletedPromoCodes.deletedCount} promo codes`);
    
    // Insert routes
    console.log('📥 Inserting routes...');
    const insertedRoutes = await Route.insertMany(routesData, { ordered: false });
    console.log(`✅ Inserted ${insertedRoutes.length} routes`);
    
    // Insert promo codes
    console.log('📥 Inserting promo codes...');
    const insertedPromoCodes = await PromoCode.insertMany(promoCodesData, { ordered: false });
    console.log(`✅ Inserted ${insertedPromoCodes.length} promo codes`);
    
    // Verify insertion
    const routeCount = await Route.countDocuments();
    const promoCount = await PromoCode.countDocuments();
    console.log(`📊 Verification: ${routeCount} routes and ${promoCount} promo codes in database`);
    
    console.log('🎉 Database seeded successfully!');
    
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Add immediate logging to verify script execution
console.log('🚀 Seed script started');
seed().catch((error) => {
  console.error('❌ Unhandled error in seed:', error);
  process.exit(1);
});