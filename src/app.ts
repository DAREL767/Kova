import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { auth } from './modules/auth/routes.js';
import { catalog } from './modules/catalog/routes.js';
import { shop } from './modules/shop/routes.js';
import { content } from './modules/content/routes.js';
import { media } from './modules/media/routes.js';
import { errors } from './shared/http.js';
export const app = express();
app.disable('x-powered-by');
app.use(
  helmet(),
  cors({ origin: config.CLIENT_ORIGIN, credentials: true }),
  express.json({ limit: '256kb' }),
  rateLimit({ windowMs: 60000, limit: 200 }),
);
app.get('/health', (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' }),
);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== config.CLIENT_ORIGIN &&
    req.headers.origin !== `${req.protocol}://${req.get('host')}`
  ) {
    res.status(403).json({ error: 'Origen no permitido' });
    return;
  }
  next();
});
app.use('/api/auth', auth);
app.use('/api/products', catalog);
app.use('/api/shop', shop);
app.use('/api/content', content);
app.use('/api/media', media);
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errors);
