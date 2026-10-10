import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Workshop from './models/Workshop.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/workshop_registration');
const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin123!';
let admin = await User.findOne({ email });
if (!admin) {
  admin = await User.create({
    name: process.env.ADMIN_NAME || 'Development Admin',
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'Admin'
  });
  console.log(`Seeded Admin: ${email}`);
} else {
  console.log(`Admin already exists: ${email}`);
}
if (await Workshop.countDocuments() === 0) {
  const day = 86400000;
  await Workshop.insertMany([
    { code: 'POT-101', title: 'Introduction to Pottery', instructor: 'Nimali Perera', startsAt: new Date(Date.now() + day * 2), capacity: 12, location: 'Main Centre', description: 'A beginner-friendly pottery workshop.' },
    { code: 'COD-201', title: 'Coding for Beginners', instructor: 'Kasun Silva', startsAt: new Date(Date.now() + day * 4), capacity: 20, location: 'North Centre', description: 'Build your first small program.' },
    { code: 'FIT-105', title: 'Weekend Fitness', instructor: 'Amara Fernando', startsAt: new Date(Date.now() + day * 6), capacity: 15, location: 'South Centre', description: 'A guided community fitness session.' }
  ]);
  console.log('Seeded 3 sample workshops.');
}
await mongoose.disconnect();
console.log('Seed complete. Use the development credentials from README.');
