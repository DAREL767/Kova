import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

process.env.MONGODB_URI = 'mongodb://127.0.0.1/kova-content-test';
process.env.JWT_SECRET = 'content-test-secret-with-at-least-32-characters';
const { app } = await import('../src/app.js');
const { User } = await import('../src/modules/auth/model.js');
const { Content } = await import('../src/modules/content/model.js');
const { Product } = await import('../src/modules/catalog/model.js');
const { Cart, Order } = await import('../src/modules/shop/models.js');
let mongo: MongoMemoryReplSet;
const tokens: Record<string, string> = {};
let customerId: string;
const productData = {
  name: 'Prenda vigente',
  description: 'Referencia de prueba',
  category: 'camisetas',
  gender: 'unisex',
  price: 50000,
  variants: [
    {
      key: 'negro',
      color: 'Negro',
      hex: '#000000',
      images: ['https://example.com/front.jpg', 'https://example.com/back.jpg'],
      sizes: [{ size: 'M', stock: 1 }],
    },
  ],
};

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Content.init(), Product.init(), Cart.init(), Order.init()]);
  const passwordHash = await bcrypt.hash('test-password-123', 12);
  for (const role of ['admin', 'staff', 'customer']) {
    const account = await User.create({
      name: role,
      email: `${role}@example.com`,
      role,
      ...(role === 'staff' ? { staffSlot: 1 } : {}),
      passwordHash,
    });
    if (role === 'customer') customerId = account.id;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'test-password-123' })
      .expect(200);
    tokens[role] = login.body.token;
  }
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('administrador y personal pueden crear, editar y eliminar secciones con imágenes independientes', async () => {
  const sections = [
    {
      id: 'history',
      title: 'Historia',
      text: 'Primer párrafo.\n\nSegundo párrafo.',
      image: 'https://example.com/history.jpg',
    },
    { id: 'mission', title: 'Misión', text: 'Nuestra misión' },
  ];
  for (const role of ['admin', 'staff']) {
    await request(app)
      .put('/api/content')
      .set('Authorization', `Bearer ${tokens[role]}`)
      .send({ key: 'about', value: { sections } })
      .expect(200);
    const content = await request(app).get('/api/content').expect(200);
    assert.deepEqual(content.body.find((item: any) => item.key === 'about').value, { sections });
  }
  const edited = [
    { ...sections[1], title: 'Misión actualizada', image: 'https://example.com/mission.jpg' },
  ];
  await request(app)
    .put('/api/content')
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ key: 'about', value: { sections: edited } })
    .expect(200);
  const content = await request(app).get('/api/content').expect(200);
  assert.deepEqual(content.body.find((item: any) => item.key === 'about').value.sections, edited);
  await request(app)
    .put('/api/content')
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ key: 'about', value: { sections: [] } })
    .expect(200);
});

test('las secciones validan contenido, imágenes, identificadores y permisos', async () => {
  const valid = { id: 'section-1', title: 'Título', text: 'Contenido' };
  for (const sections of [
    [{ ...valid, title: '' }],
    [{ ...valid, text: '  ' }],
    [{ ...valid, image: 'javascript:alert(1)' }],
    [valid, valid],
    [{ ...valid, id: '<invalid>' }],
    [{ ...valid, role: 'admin' }],
    Array.from({ length: 31 }, (_, index) => ({ ...valid, id: `section-${index}` })),
  ]) {
    await request(app)
      .put('/api/content')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ key: 'about', value: { sections } })
      .expect(400);
  }
  await request(app)
    .put('/api/content')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .send({ key: 'about', value: { sections: [valid] } })
    .expect(403);
  await request(app)
    .put('/api/content')
    .send({ key: 'about', value: { sections: [valid] } })
    .expect(401);
});

test('el formato anterior de Nosotros sigue siendo compatible', async () => {
  const previous = {
    title: 'Historia anterior',
    text: 'Texto que debe conservarse',
    image: 'https://example.com/old.jpg',
  };
  await request(app)
    .put('/api/content')
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ key: 'about', value: previous })
    .expect(200);
  const content = await request(app).get('/api/content').expect(200);
  assert.deepEqual(content.body.find((item: any) => item.key === 'about').value, previous);
});

test('la categoría retirada no se registra ni aparece en catálogo, gestión o recomendaciones', async () => {
  const regular = await Product.create(productData);
  const retired = await Product.collection.insertOne({
    ...productData,
    category: 'pantalones',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const retiredId = retired.insertedId.toString();
  await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ ...productData, category: 'pantalones' })
    .expect(400);
  await request(app)
    .put(`/api/products/${regular.id}`)
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ ...productData, category: 'pantalones', revision: regular.__v })
    .expect(400);
  for (const path of [
    '/api/products',
    '/api/products/browse',
    '/api/products/browse?collection=ropa',
    '/api/products/manage',
  ]) {
    const response = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    const items = Array.isArray(response.body) ? response.body : response.body.items;
    assert.ok(items.every((item: any) => item._id !== retiredId));
  }
  await request(app).get(`/api/products/${retiredId}`).expect(404);
  await request(app).get(`/api/products/${retiredId}/suggestions`).expect(404);
  const suggestions = await request(app).get(`/api/products/${regular.id}/suggestions`).expect(200);
  assert.ok(suggestions.body.every((item: any) => item._id !== retiredId));
  const item = { productId: retiredId, variantKey: 'negro', size: 'M', quantity: 1 };
  await request(app)
    .put('/api/shop/cart')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .send({ items: [item] })
    .expect(409);
  await Cart.create({ userId: customerId, items: [item] });
  await request(app)
    .post('/api/shop/checkout')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .send({ paymentMethod: 'card', checkoutKey: randomUUID() })
    .expect(409);
  assert.equal(await Order.countDocuments(), 0);
  const order = await Order.create({
    userId: customerId,
    checkoutKey: randomUUID(),
    items: [item],
    total: 50000,
    paymentMethod: 'card',
  });
  await request(app)
    .post(`/api/shop/orders/${order.id}/return`)
    .set('Authorization', `Bearer ${tokens.customer}`)
    .send({ reason: 'Devolución histórica' })
    .expect(200);
  await request(app)
    .post(`/api/shop/admin/returns/${order.id}/accept`)
    .set('Authorization', `Bearer ${tokens.admin}`)
    .expect(200);
  assert.equal((await Order.findById(order.id))!.status, 'returned');
  assert.equal((await Product.findById(retiredId))!.variants[0].sizes[0].stock, 1);
});
