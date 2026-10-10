import { Router } from 'express';
import mongoose from 'mongoose';
import Registration from '../models/Registration.js';
import Workshop from '../models/Workshop.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.workshopId) filter.workshop = req.query.workshopId;
    if (req.query.status && ['Active', 'Cancelled'].includes(req.query.status)) filter.status = req.query.status;
    const registrations = await Registration.find(filter)
      .populate('workshop', 'code title startsAt capacity')
      .populate('registeredBy', 'name email role')
      .populate('cancelledBy', 'name email role')
      .sort({ registeredAt: -1 });
    res.json(registrations);
  } catch (err) { next(err); }
});

router.post('/', allowRoles('Manager', 'Staff'), async (req, res, next) => {
  let claimedWorkshopId;
  try {
    const { workshopId, attendeeName, attendeeEmail } = req.body;
    if (!mongoose.isValidObjectId(workshopId) || !attendeeName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(attendeeEmail || '').trim())) {
      return res.status(400).json({ message: 'Choose a workshop and enter a valid attendee name and email.' });
    }
    const email = attendeeEmail.trim().toLowerCase();

    // Atomically claim a seat only when one remains. Competing requests cannot both claim the final seat.
    const workshop = await Workshop.findOneAndUpdate(
      { _id: workshopId, status: 'Scheduled', $expr: { $lt: ['$activeCount', '$capacity'] } },
      { $inc: { activeCount: 1 } },
      { new: true }
    );
    if (!workshop) {
      const exists = await Workshop.findById(workshopId).select('_id status');
      if (!exists) return res.status(404).json({ message: 'Workshop not found.' });
      return res.status(409).json({ message: exists.status !== 'Scheduled' ? 'This workshop is not open for registration.' : 'This workshop is full.' });
    }
    claimedWorkshopId = workshop._id;
    const registration = await Registration.create({
      workshop: workshop._id, attendeeName: attendeeName.trim(), attendeeEmail: email, registeredBy: req.user._id
    });
    const populated = await Registration.findById(registration._id)
      .populate('registeredBy', 'name email role')
      .populate('workshop', 'code title startsAt');
    res.status(201).json(populated);
  } catch (err) {
    if (claimedWorkshopId) await Workshop.updateOne({ _id: claimedWorkshopId, activeCount: { $gt: 0 } }, { $inc: { activeCount: -1 } }).catch(() => {});
    if (err.code === 11000) return res.status(409).json({ message: 'This attendee already has an active registration for this workshop.' });
    next(err);
  }
});

router.patch('/:id/cancel', allowRoles('Manager', 'Staff'), async (req, res, next) => {
  try {
    const registration = await Registration.findOneAndUpdate(
      { _id: req.params.id, status: 'Active' },
      { $set: { status: 'Cancelled', cancelledBy: req.user._id, cancelledAt: new Date() } },
      { new: true }
    );
    if (!registration) {
      const existing = await Registration.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Registration not found.' });
      return res.status(409).json({ message: 'This registration has already been cancelled.' });
    }
    await Workshop.updateOne({ _id: registration.workshop, activeCount: { $gt: 0 } }, { $inc: { activeCount: -1 } });
    const populated = await Registration.findById(registration._id)
      .populate('registeredBy', 'name email role')
      .populate('cancelledBy', 'name email role')
      .populate('workshop', 'code title startsAt');
    res.json(populated);
  } catch (err) { next(err); }
});

export default router;
