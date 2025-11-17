import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Route } from '../models';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkRoutes() {
  try {
    console.log('🔍 Checking routes in database...');
    
    await connectDatabase();
    
    const totalRoutes = await Route.countDocuments();
    const activeRoutes = await Route.countDocuments({ active: true });
    const sampleRoutes = await Route.find().limit(5).select('from to basePrice active');
    
    console.log(`\n📊 Route Statistics:`);
    console.log(`   Total routes: ${totalRoutes}`);
    console.log(`   Active routes: ${activeRoutes}`);
    
    if (sampleRoutes.length > 0) {
      console.log(`\n📋 Sample routes (first 5):`);
      sampleRoutes.forEach((route, index) => {
        console.log(`   ${index + 1}. ${route.from} → ${route.to} (${route.basePrice} RON, active: ${route.active})`);
      });
    } else {
      console.log('\n⚠️  No routes found in database!');
    }
    
    // Check specific route
    const chisinauBrasov = await Route.findOne({ from: 'Chișinău', to: 'Brașov' });
    if (chisinauBrasov) {
      console.log(`\n✅ Found Chișinău → Brașov route:`);
      console.log(`   Price: ${chisinauBrasov.basePrice} RON`);
      console.log(`   Departure: ${chisinauBrasov.departureTime}`);
      console.log(`   Arrival: ${chisinauBrasov.arrivalTime}`);
      console.log(`   From Station: ${chisinauBrasov.fromStation}`);
      console.log(`   To Station: ${chisinauBrasov.toStation}`);
      console.log(`   Active: ${chisinauBrasov.active}`);
    } else {
      console.log('\n❌ Chișinău → Brașov route not found!');
    }
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
  } catch (error) {
    console.error('❌ Error checking routes:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

checkRoutes();

