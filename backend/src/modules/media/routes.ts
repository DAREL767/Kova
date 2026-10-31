import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { authenticate, permit } from '../auth/middleware.js';
import { HttpError } from '../../shared/http.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
});
const { GridFSBucket, ObjectId } = mongoose.mongo;
function bucket() {
  if (!mongoose.connection.db) throw new HttpError(503, 'Almacenamiento no disponible');
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'images' });
}
function imageType(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  throw new HttpError(400, 'Solo se permiten imágenes PNG, JPEG o WebP');
}
export const media = Router();
media.post(
  '/',
  authenticate,
  permit('admin', 'staff'),
  rateLimit({ windowMs: 60000, limit: 30 }),
  upload.single('image'),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Selecciona una imagen');
    const mime = imageType(req.file.buffer);
    const stream = bucket().openUploadStream(randomUUID(), {
      metadata: { mime, uploadedBy: req.user!.id },
    });
    await new Promise<void>((resolve, reject) => {
      stream.once('finish', resolve);
      stream.once('error', reject);
      stream.end(req.file!.buffer);
    });
    res.status(201).json({ url: `/api/media/${stream.id.toString()}` });
  },
);
media.get('/:id', async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(String(req.params.id)))
    throw new HttpError(404, 'Imagen no encontrada');
  const storage = bucket();
  const id = new ObjectId(String(req.params.id));
  const [file] = await storage.find({ _id: id }).limit(1).toArray();
  if (!file) throw new HttpError(404, 'Imagen no encontrada');
  res.setHeader('Content-Type', String(file.metadata?.mime ?? 'application/octet-stream'));
  res.setHeader('Content-Length', file.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // Catalog images are public and may be embedded by the separately hosted frontend.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  const stream = storage.openDownloadStream(id);
  stream.on('error', (error) => {
    if (res.headersSent) res.destroy();
    else next(error);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});
