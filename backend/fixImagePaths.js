import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Gig from './models/gig.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gigflow';

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const gigs = await Gig.find({ image: { $exists: true, $ne: null } });
    console.log(`Checking ${gigs.length} gigs...`);

    let updatedCount = 0;

    for (const gig of gigs) {
      const oldPath = gig.image;
      if (!oldPath) continue;

      let newFilename = oldPath;

      if (oldPath.includes('\\')) {
        newFilename = oldPath.split('\\').pop();
      } else if (oldPath.includes('/')) {
        newFilename = oldPath.split('/').pop();
      }

      if (newFilename !== oldPath) {
        gig.image = newFilename;
        await gig.save();
        updatedCount++;
        console.log(`Updated: ${oldPath} -> ${newFilename}`);
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} gigs.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
