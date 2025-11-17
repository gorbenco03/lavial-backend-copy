import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lavial';
    
    // Ensure database name is specified in MongoDB Atlas URI
    let finalUri = mongoUri;
    if (mongoUri.includes('mongodb+srv://') && !mongoUri.includes('mongodb.net/')) {
      // If Atlas URI doesn't have database name, add it
      finalUri = mongoUri.replace('mongodb.net/?', 'mongodb.net/lavial?').replace('mongodb.net/', 'mongodb.net/lavial?');
    } else if (mongoUri.includes('mongodb+srv://') && mongoUri.includes('mongodb.net/') && !mongoUri.match(/mongodb\.net\/[^?]/)) {
      // If it has / but no database name (just ?), add database name
      finalUri = mongoUri.replace('mongodb.net/?', 'mongodb.net/lavial?');
    }
    
    await mongoose.connect(finalUri);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.error('❌ MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error disconnecting MongoDB:', error);
  }
};
