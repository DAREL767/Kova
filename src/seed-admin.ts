import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { credentials } from './modules/auth/routes.js';
import { User } from './modules/auth/model.js';
const input = credentials.parse({
  name: process.env.ADMIN_NAME,
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
await mongoose.connect(config.MONGODB_URI);
try {
  await User.init();
  if (await User.exists({ role: 'admin' })) throw new Error('El administrador ya existe');
  await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: 'admin',
  });
  console.log('Administrador creado');
} finally {
  await mongoose.disconnect();
}
