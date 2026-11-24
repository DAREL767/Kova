import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

process.env.MONGODB_URI = 'mongodb://127.0.0.1/kova-staff-test';
process.env.JWT_SECRET = 'staff-test-secret-with-at-least-32-characters';
const { app } = await import('../src/app.js');
const { User } = await import('../src/modules/auth/model.js');
let mongo: MongoMemoryReplSet;
let passwordHash: string;
let ownerId: string;
let staffId: string;
let customerId: string;
let ownerToken: string;
let staffToken: string;
let customerToken: string;
const password = 'original-password-123';

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await User.init();
  passwordHash = await bcrypt.hash(password, 12);
});
beforeEach(async () => {
  await User.deleteMany({});
  const [owner, staff, customer] = await User.create([
    { name: 'Owner', username: 'test-owner', role: 'admin', passwordHash },
    { name: 'Personal', email: 'staff@example.com', role: 'staff', staffSlot: 1, passwordHash },
    { name: 'Cliente', email: 'customer@example.com', role: 'customer', passwordHash },
  ]);
  ownerId = owner.id;
  staffId = staff.id;
  customerId = customer.id;
  async function login(email: string) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.token as string;
  }
  [ownerToken, staffToken, customerToken] = await Promise.all([
    login('test-owner'),
    login('staff@example.com'),
    login('customer@example.com'),
  ]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('el administrador edita el nombre sin cambiar la contraseña ni cerrar la sesión del personal', async () => {
  const updated = await request(app)
    .patch(`/api/auth/staff/${staffId}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Nuevo nombre' })
    .expect(200);
  assert.equal(updated.body.name, 'Nuevo nombre');
  assert.equal(updated.body.email, 'staff@example.com');
  assert.equal(updated.body.passwordHash, undefined);
  assert.equal(updated.body.tokenVersion, undefined);
  const stored = await User.findById(staffId).select('+passwordHash +tokenVersion');
  assert.equal(stored!.passwordHash, passwordHash);
  assert.equal(stored!.tokenVersion, 0);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${staffToken}`).expect(200);
});

test('el cambio de credenciales revoca sesiones previas y permite entrar con las nuevas', async () => {
  await request(app)
    .patch(`/api/auth/staff/${staffId}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email: 'new-staff@example.com', password: 'replacement-password-123' })
    .expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${staffToken}`).expect(401);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ownerToken}`).expect(200);
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'staff@example.com', password })
    .expect(401);
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'new-staff@example.com', password })
    .expect(401);
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'new-staff@example.com', password: 'replacement-password-123' })
    .expect(200);
  assert.equal(login.body.user.role, 'staff');
  const stored = await User.findById(staffId).select('+passwordHash +tokenVersion');
  assert.ok(await bcrypt.compare('replacement-password-123', stored!.passwordHash));
  assert.equal(stored!.staffSlot, 1);
  assert.equal(stored!.tokenVersion, 1);
});

test('solo el administrador modifica personal activo; no puede usar esta ruta para cambiar otros roles', async () => {
  await request(app).patch(`/api/auth/staff/${staffId}`).send({ name: 'Intruso' }).expect(401);
  for (const token of [staffToken, customerToken]) {
    await request(app)
      .patch(`/api/auth/staff/${staffId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Intruso' })
      .expect(403);
  }
  for (const id of [ownerId, customerId, new mongoose.Types.ObjectId().toString()]) {
    await request(app)
      .patch(`/api/auth/staff/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Inválido' })
      .expect(404);
  }
  await User.updateOne({ _id: staffId }, { active: false });
  await request(app)
    .patch(`/api/auth/staff/${staffId}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Inactivo' })
    .expect(404);
});

test('rechaza datos inválidos y correos duplicados sin alterar las credenciales anteriores', async () => {
  for (const input of [
    {},
    { role: 'admin' },
    { passwordHash: 'untrusted' },
    { name: '' },
    { email: 'invalid' },
    { password: '' },
    { password: 'short' },
    { password: 'é'.repeat(40) },
  ]) {
    await request(app)
      .patch(`/api/auth/staff/${staffId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(input)
      .expect(400);
  }
  await request(app)
    .patch(`/api/auth/staff/${staffId}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email: 'customer@example.com' })
    .expect(409);
  const stored = await User.findById(staffId).select('+passwordHash +tokenVersion');
  assert.equal(stored!.email, 'staff@example.com');
  assert.equal(stored!.passwordHash, passwordHash);
  assert.equal(stored!.tokenVersion, 0);
});
