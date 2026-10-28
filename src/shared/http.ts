import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import mongoose from 'mongoose';
import { MulterError } from 'multer';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
export const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Datos inválidos', details: error.issues });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof MulterError) {
    res
      .status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({
        error:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen no puede superar 8 MB'
            : 'Carga una sola imagen por solicitud',
      });
    return;
  }
  if (error instanceof mongoose.Error.VersionError) {
    res
      .status(409)
      .json({ error: 'El inventario cambió. Recarga los datos e inténtalo de nuevo.' });
    return;
  }
  if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  if (error?.code === 11000) {
    res.status(409).json({ error: 'El registro ya existe' });
    return;
  }
  if (error?.status === 400) {
    res.status(400).json({ error: 'Solicitud inválida' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
};
