import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { User } from './model.js';
import { HttpError } from '../../shared/http.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('kova_session='))
    ?.slice('kova_session='.length);
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? cookie;
  if (!token) throw new HttpError(401, 'Inicia sesión');
  let subject: string;
  let version: number;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    if (
      typeof payload === 'string' ||
      !payload.sub ||
      !/^[a-f\d]{24}$/i.test(payload.sub) ||
      typeof payload.ver !== 'number'
    )
      throw new Error();
    subject = payload.sub;
    version = payload.ver;
  } catch {
    throw new HttpError(401, 'Sesión inválida o vencida');
  }
  const user = await User.findById(subject).select('+tokenVersion');
  if (!user || user.active === false || (user.tokenVersion ?? 0) !== version)
    throw new HttpError(401, 'Sesión inválida');
  req.user = { id: user.id, role: user.role };
  next();
};
export const permit =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, 'Acceso denegado');
    next();
  };
