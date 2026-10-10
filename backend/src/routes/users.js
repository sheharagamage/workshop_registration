import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, allowRoles('Admin'));

router.get('/', async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('name email role createdAt');
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim() || !email?.trim() || !password || password.length < 8 || !['Admin', 'Manager', 'Staff'].includes(role)) {
      return res.status(400).json({ message: 'Name, valid email, password (at least 8 characters), and role are required.' });
    }
    const user = await User.create({
      name: name.trim(), email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12), role
    });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
  } catch (err) { next(err); }
});

export default router;
