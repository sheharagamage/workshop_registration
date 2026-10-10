import { Router } from 'express';
import Workshop from '../models/Workshop.js';
import Registration from '../models/Registration.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && ['Scheduled', 'Completed', 'Cancelled'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.startsAt = {};
      if (req.query.from) filter.startsAt.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) filter.startsAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    if (req.query.available === 'true') filter.$expr = { $lt: ['$activeCount', '$capacity'] };
    const workshops = await Workshop.find(filter).sort({ startsAt: 1 });
    res.json(workshops.map(w => ({ ...w.toJSON(), seatsAvailable: Math.max(0, w.capacity - w.activeCount) })));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) return res.status(404).json({ message: 'Workshop not found.' });
    res.json({ ...workshop.toJSON(), seatsAvailable: Math.max(0, workshop.capacity - workshop.activeCount) });
  } catch (err) { next(err); }
});

router.post('/', allowRoles('Manager'), async (req, res, next) => {
  try {
    const { code, title, instructor, startsAt, capacity, status, location, description } = req.body;
    if (!code?.trim() || !title?.trim() || !instructor?.trim() || !startsAt || !Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number.isNaN(new Date(startsAt).getTime())) {
      return res.status(400).json({ message: 'Code, title, instructor, valid date/time, and capacity (at least 1) are required.' });
    }
    const workshop = await Workshop.create({ code, title, instructor, startsAt, capacity: Number(capacity), status, location, description });
    res.status(201).json(workshop);
  } catch (err) { next(err); }
});

router.patch('/:id', allowRoles('Manager'), async (req, res, next) => {
  try {
    const allowed = ['title', 'instructor', 'startsAt', 'capacity', 'status', 'location', 'description'];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
    if (updates.capacity !== undefined) {
      updates.capacity = Number(updates.capacity);
      if (!Number.isInteger(updates.capacity) || updates.capacity < 1) {
        return res.status(400).json({ message: 'Capacity must be a positive whole number.' });
      }
    }
    if (updates.startsAt !== undefined && Number.isNaN(new Date(updates.startsAt).getTime())) {
      return res.status(400).json({ message: 'Please provide a valid workshop date and time.' });
    }

    // Keep capacity validation in the atomic update itself. This prevents an edit
    // from lowering capacity below activeCount while a registration claims a seat.
    const filter = { _id: req.params.id };
    if (updates.capacity !== undefined) {
      filter.$expr = { $lte: ['$activeCount', updates.capacity] };
    }
    const workshop = await Workshop.findOneAndUpdate(filter, { $set: updates }, {
      new: true, runValidators: true
    });
    if (!workshop) {
      const exists = await Workshop.findById(req.params.id).select('_id activeCount');
      if (!exists) return res.status(404).json({ message: 'Workshop not found.' });
      return res.status(409).json({ message: 'Capacity cannot be lower than the number of active registrations.' });
    }
    res.json(workshop);
  } catch (err) { next(err); }
});

router.get('/:id/registrations', async (req, res, next) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) return res.status(404).json({ message: 'Workshop not found.' });
    const registrations = await Registration.find({ workshop: workshop._id })
      .populate('registeredBy', 'name email role')
      .populate('cancelledBy', 'name email role')
      .sort({ registeredAt: -1 });
    res.json(registrations);
  } catch (err) { next(err); }
});

export default router;
