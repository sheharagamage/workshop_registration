import mongoose from 'mongoose';

const workshopSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  title: { type: String, required: true, trim: true },
  instructor: { type: String, required: true, trim: true },
  location: { type: String, default: '', trim: true },
  startsAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1 },
  activeCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' },
  description: { type: String, default: '' }
}, { timestamps: true });

workshopSchema.virtual('seatsAvailable').get(function () {
  return Math.max(0, this.capacity - this.activeCount);
});
workshopSchema.set('toJSON', { virtuals: true });
export default mongoose.model('Workshop', workshopSchema);
