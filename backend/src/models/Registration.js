import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  workshop: { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true, index: true },
  attendeeName: { type: String, required: true, trim: true },
  attendeeEmail: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: ['Active', 'Cancelled'], default: 'Active' },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  registeredAt: { type: Date, default: Date.now },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true });

registrationSchema.index(
  { workshop: 1, attendeeEmail: 1 },
  { unique: true, partialFilterExpression: { status: 'Active' } }
);
export default mongoose.model('Registration', registrationSchema);
