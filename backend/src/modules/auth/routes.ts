import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { config } from '../../config.js';
import { HttpError, validate } from '../../shared/http.js';
import { User } from './model.js';
import { authenticate, permit } from './middleware.js';

export const credentials = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email().trim().toLowerCase(),
    password: z
      .string()
      .min(12)
      .max(72)
      .refine(
        (value) => Buffer.byteLength(value, 'utf8') <= 72,
        'La contraseña supera los 72 bytes permitidos',
      ),
  })
  .strict();
const publicUser = (u: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
}) => ({ id: u._id.toString(), name: u.name, email: u.email, role: u.role });
export const auth = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || config.COOKIE_SAME_SITE === 'none',
  sameSite: config.COOKIE_SAME_SITE,
  path: '/api',
};
auth.post('/register', authLimit, validate(credentials), async (req, res) => {
  const { password, ...data } = req.body;
  const user = await User.create({
    ...data,
    role: 'customer',
    passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json(publicUser(user));
});
auth.post('/login', authLimit, validate(credentials.omit({ name: true })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email, active: { $ne: false } }).select(
    '+passwordHash +tokenVersion',
  );
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash)))
    throw new HttpError(401, 'Credenciales incorrectas');
  const token = jwt.sign({ ver: user.tokenVersion ?? 0 }, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: '8h',
    algorithm: 'HS256',
  });
  res.cookie('kova_session', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  res.json({ user: publicUser(user), token });
});
auth.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(401, 'Sesión inválida');
  res.json(publicUser(user));
});
auth.post('/logout', authenticate, async (req, res) => {
  await User.updateOne({ _id: req.user!.id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie('kova_session', cookieOptions).sendStatus(204);
});
auth.get('/staff', authenticate, permit('admin'), async (_req, res) => {
  res.json(
    (await User.find({ role: 'staff', active: { $ne: false } }).sort({ staffSlot: 1 })).map(
      publicUser,
    ),
  );
});
auth.post('/staff', authenticate, permit('admin'), validate(credentials), async (req, res) => {
  const occupied = await User.find({ role: 'staff' }).distinct('staffSlot');
  const slot = [1, 2].find((s) => !occupied.includes(s));
  if (!slot) throw new HttpError(409, 'Ya existen las dos cuentas de personal');
  const { password, ...data } = req.body;
  const user = await User.create({
    ...data,
    role: 'staff',
    staffSlot: slot,
    passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json(publicUser(user));
});
auth.delete('/staff/:id', authenticate, permit('admin'), async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'staff', active: { $ne: false } },
    { $set: { active: false }, $unset: { staffSlot: 1 }, $inc: { tokenVersion: 1 } },
  );
  if (!user) throw new HttpError(404, 'Cuenta de personal no encontrada');
  res.sendStatus(204);
});
