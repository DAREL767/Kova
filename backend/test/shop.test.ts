import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { spawnSync } from 'node:child_process';

process.env.MONGODB_URI = 'mongodb://127.0.0.1/kova-test';
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
process.env.COOKIE_SAME_SITE = 'strict';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/app.js');
const { User } = await import('../src/modules/auth/model.js');
const { Product } = await import('../src/modules/catalog/model.js');
const { Order } = await import('../src/modules/shop/models.js');
const { productInput, productUpdateInput } = await import('../src/modules/catalog/validation.js');
const { Content } = await import('../src/modules/content/model.js');
let mongo: MongoMemoryReplSet;
test('producción normaliza la barra final del origen y configura cookies entre sitios', () => {
  const environment = {
    ...process.env,
    NODE_ENV: 'production',
    CLIENT_ORIGIN: 'https://kova-ten-omega.vercel.app/',
  };
  delete environment.COOKIE_SAME_SITE;
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      'const {config} = await import("./src/config.ts"); console.log(JSON.stringify({origin:config.CLIENT_ORIGIN,sameSite:config.COOKIE_SAME_SITE}));',
    ],
    {
      cwd: new URL('../', import.meta.url),
      env: environment,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    origin: 'https://kova-ten-omega.vercel.app',
    sameSite: 'none',
  });
});
const productData = {
  name: 'Camisa Kova',
  description: 'Algodón',
  category: 'camisas',
  gender: 'unisex',
  price: 90000,
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
  await Promise.all([User.init(), Product.init(), Order.init(), Content.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('la API es independiente y permite solicitudes con credenciales desde el frontend', async () => {
  await request(app).get('/cuenta').expect(404);
  const missing = await request(app).get('/api/unknown').set('Accept', 'text/html').expect(404);
  assert.equal(missing.body.error, 'Ruta no encontrada');
  const preflight = await request(app)
    .options('/api/auth/login')
    .set('Origin', process.env.CLIENT_ORIGIN!)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type')
    .expect(204);
  assert.equal(preflight.headers['access-control-allow-origin'], process.env.CLIENT_ORIGIN);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
});

test('las colecciones separan ropa y calzado y las recomendaciones excluyen la prenda actual', async () => {
  const api = request(app);
  const clothes = await Product.create({ ...productData, name: 'Prenda de colección' });
  await Product.create({ ...productData, name: 'Calzado de colección', category: 'calzado' });
  await Product.create({ ...productData, name: 'Guayos de colección', category: 'guayos' });
  const inactive = await Product.create({ ...productData, active: false });
  const clothing = await api.get('/api/products/browse?collection=ropa').expect(200);
  assert.ok(clothing.body.items.some((p: any) => p._id === clothes.id));
  assert.ok(
    clothing.body.items.every((p: any) => !['calzado', 'tenis', 'guayos'].includes(p.category)),
  );
  const shoes = await api.get('/api/products?collection=calzado').expect(200);
  assert.ok(shoes.body.length >= 2);
  assert.ok(shoes.body.every((p: any) => ['calzado', 'tenis', 'guayos'].includes(p.category)));
  const related = await api.get(`/api/products/${clothes.id}/suggestions`).expect(200);
  assert.ok(related.body.length > 0);
  assert.ok(related.body.every((p: any) => p._id !== clothes.id && p._id !== inactive.id));
  await Product.deleteMany({
    _id: {
      $in: [
        ...clothing.body.items.map((p: any) => p._id),
        ...shoes.body.map((p: any) => p._id),
        inactive.id,
      ],
    },
  });
});

test('cada variante exige dos imágenes, stock y tallas únicas', () => {
  assert.equal(productInput.safeParse(productData).success, true);
  for (const category of ['guayos', 'camisetas', 'buzos', 'pantalonetas', 'bermudas', 'sacos']) {
    assert.equal(productInput.safeParse({ ...productData, category }).success, true);
  }
  const invalid = structuredClone(productData);
  invalid.variants[0].images.pop();
  assert.equal(productInput.safeParse(invalid).success, false);
  assert.equal(productUpdateInput.safeParse({ ...invalid, revision: 0 }).success, false);
  const secondColor = structuredClone(productData.variants[0]);
  secondColor.key = 'blanco';
  secondColor.images = ['https://example.com/white.jpg'];
  const missingVariantPhoto = { ...productData, variants: [...productData.variants, secondColor] };
  assert.equal(productInput.safeParse(missingVariantPhoto).success, false);
  assert.equal(
    productUpdateInput.safeParse({ ...missingVariantPhoto, revision: 0 }).success,
    false,
  );
  secondColor.images.push('https://example.com/white.jpg');
  assert.equal(productInput.safeParse(missingVariantPhoto).success, false);
  secondColor.images[1] = 'https://example.com/white-back.jpg';
  assert.equal(productInput.safeParse(missingVariantPhoto).success, true);
  invalid.variants[0].images.push('https://example.com/back.jpg');
  invalid.variants[0].sizes[0].stock = 0;
  assert.equal(productInput.safeParse(invalid).success, false);
});

test('permisos, carrito persistente, checkout idempotente y devoluciones', async () => {
  const api = request(app);
  const account = { name: 'Cliente', email: 'customer@example.com', password: 'a-strong-password' };
  await api
    .post('/api/auth/register')
    .send({ ...account, role: 'admin' })
    .expect(400);
  await api.post('/api/auth/register').send(account).expect(201);
  const login = await api
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password })
    .expect(200);
  const token = login.body.token;
  const header = { Authorization: `Bearer ${token}` };
  await api.post('/api/products').set(header).send(productData).expect(403);
  await api.get('/api/products/manage').set(header).expect(403);
  await api.get('/api/auth/staff').set(header).expect(403);
  await api.get('/api/shop/admin/returns').set(header).expect(403);
  await api.put('/api/content').set(header).send({}).expect(403);
  await api.post('/api/media').set(header).expect(403);
  const product = await Product.create(productData);
  await api
    .put('/api/shop/cart')
    .set(header)
    .send({ items: [{ productId: product.id, variantKey: 'negro', size: 'M', quantity: 1 }] })
    .expect(200);
  const cart = await api.get('/api/shop/cart').set(header).expect(200);
  assert.equal(cart.body.items.length, 1);
  await api.post('/api/shop/checkout').set(header).send({ checkoutKey: randomUUID() }).expect(400);
  const payment = { paymentMethod: 'card', checkoutKey: randomUUID() };
  const results = await Promise.all([
    api.post('/api/shop/checkout').set(header).send(payment),
    api.post('/api/shop/checkout').set(header).send(payment),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.equal(results[0].body._id, results[1].body._id);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal((await Product.findById(product.id))!.variants[0].sizes[0].stock, 0);
  assert.equal((await api.get('/api/shop/cart').set(header)).body.items.length, 0);
  await api
    .post(`/api/shop/orders/${results[0].body._id}/return`)
    .set(header)
    .send({ reason: 'Cambio de talla' })
    .expect(200);
  assert.equal((await api.get('/api/shop/returns').set(header)).body.length, 1);
  await User.updateOne({ email: account.email }, { role: 'admin' });
  for (let i = 1; i <= 2; i++) {
    await api
      .post('/api/auth/staff')
      .set(header)
      .send({ ...account, email: `staff${i}@example.com` })
      .expect(201);
  }
  await api
    .post('/api/auth/staff')
    .set(header)
    .send({ ...account, email: 'staff3@example.com' })
    .expect(409);
  await api.post(`/api/shop/admin/returns/${results[0].body._id}/accept`).set(header).expect(200);
  await api.post(`/api/shop/admin/returns/${results[0].body._id}/accept`).set(header).expect(409);
  assert.equal((await Product.findById(product.id))!.variants[0].sizes[0].stock, 1);
  const other = { ...account, email: 'other@example.com' };
  await api.post('/api/auth/register').send(other).expect(201);
  const otherLogin = await api
    .post('/api/auth/login')
    .send({ email: other.email, password: other.password });
  assert.equal(
    (await api.get('/api/shop/orders').set('Authorization', `Bearer ${otherLogin.body.token}`)).body
      .length,
    0,
  );
  const otherHeader = { Authorization: `Bearer ${otherLogin.body.token}` };
  const items = [{ productId: product.id, variantKey: 'negro', size: 'M', quantity: 1 }];
  await api.put('/api/shop/cart').set(header).send({ items }).expect(200);
  await api.put('/api/shop/cart').set(otherHeader).send({ items }).expect(200);
  const competing = await Promise.all([
    api
      .post('/api/shop/checkout')
      .set(header)
      .send({ paymentMethod: 'pse', checkoutKey: randomUUID() }),
    api
      .post('/api/shop/checkout')
      .set(otherHeader)
      .send({ paymentMethod: 'cash', checkoutKey: randomUUID() }),
  ]);
  assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await Product.findById(product.id))!.variants[0].sizes[0].stock, 0);
});

test('sesiones HttpOnly revocables, banners protegidos y límite de personal', async () => {
  const api = request(app);
  const owner = await api
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: 'a-strong-password' })
    .expect(200);
  const ownerHeader = { Authorization: `Bearer ${owner.body.token}` };
  const cookies = owner.headers['set-cookie'] as unknown as string[];
  assert.ok(cookies[0].includes('HttpOnly'));
  assert.ok(cookies[0].includes('SameSite=Strict'));
  await api.get('/api/auth/me').set('Cookie', cookies).expect(200);
  await api
    .put('/api/content')
    .send({ key: 'contactBanner', value: { title: 'Contacto', subtitle: 'Visítanos' } })
    .expect(401);
  const staffLogin = await api
    .post('/api/auth/login')
    .send({ email: 'staff1@example.com', password: 'a-strong-password' })
    .expect(200);
  const staffHeader = { Authorization: `Bearer ${staffLogin.body.token}` };
  await api
    .post('/api/auth/staff')
    .set(staffHeader)
    .send({ name: 'No autorizado', email: 'forbidden@example.com', password: 'a-strong-password' })
    .expect(403);
  for (const key of ['homeBanner', 'contactBanner']) {
    await api
      .put('/api/content')
      .set(staffHeader)
      .send({
        key,
        value: {
          title: `Banner ${key}`,
          subtitle: 'Texto editable',
          href: '/?category=calzado',
          image: 'https://example.com/banner.jpg',
          ctaLabel: 'Explorar',
        },
      })
      .expect(200);
  }
  await api
    .put('/api/content')
    .set(ownerHeader)
    .send({
      key: 'contactBanner',
      value: { title: 'Inválido', subtitle: '', href: '//external.example' },
    })
    .expect(400);
  const content = await api.get('/api/content').expect(200);
  assert.equal(content.body.filter((c: { key: string }) => c.key.endsWith('Banner')).length, 2);
  const staff = await api.get('/api/auth/staff').set(ownerHeader).expect(200);
  assert.equal(staff.body.length, 2);
  assert.equal(staff.body[0].passwordHash, undefined);
  await api.delete(`/api/auth/staff/${staffLogin.body.user.id}`).set(ownerHeader).expect(204);
  await api.get('/api/auth/me').set(staffHeader).expect(401);
  await api
    .post('/api/auth/login')
    .send({ email: 'staff1@example.com', password: 'a-strong-password' })
    .expect(401);
  await api
    .post('/api/auth/staff')
    .set(ownerHeader)
    .send({ name: 'Reemplazo', email: 'replacement@example.com', password: 'a-strong-password' })
    .expect(201);
  await api
    .post('/api/auth/register')
    .set('Origin', 'https://evil.example')
    .send({ name: 'Mal origen', email: 'origin@example.com', password: 'a-strong-password' })
    .expect(403);
  await api.post('/api/auth/logout').set('Cookie', cookies).expect(204);
  await api.get('/api/auth/me').set(ownerHeader).expect(401);
  await api.get('/api/auth/me').set('Cookie', cookies).expect(401);
});

test('imágenes, calzado compatible, paginación y edición sin perder stock ni devoluciones', async () => {
  const api = request(app);
  const owner = await api
    .post('/api/auth/login')
    .send({ email: 'customer@example.com', password: 'a-strong-password' })
    .expect(200);
  const ownerHeader = { Authorization: `Bearer ${owner.body.token}` };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
    'base64',
  );
  await api.post('/api/media').attach('image', png, 'ref.png').expect(401);
  await api
    .post('/api/media')
    .set(ownerHeader)
    .attach('image', Buffer.from('<script>alert(1)</script>'), 'fake.png')
    .expect(400);
  const upload = await api
    .post('/api/media')
    .set(ownerHeader)
    .attach('image', png, 'ref.png')
    .expect(201);
  const image = await api.get(upload.body.url).expect(200);
  assert.ok(image.headers['content-type'].startsWith('image/png'));
  assert.equal(image.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.deepEqual(image.body, png);
  const data = {
    ...structuredClone(productData),
    category: 'tenis',
    variants: [
      {
        ...structuredClone(productData.variants[0]),
        images: [upload.body.url, 'https://example.com/angle.jpg'],
      },
      {
        ...structuredClone(productData.variants[0]),
        key: 'blanco',
        color: 'Blanco',
        hex: '#ffffff',
      },
    ],
  };
  const created = await api.post('/api/products').set(ownerHeader).send(data).expect(201);
  assert.equal(created.body.category, 'calzado');
  const productId = created.body._id;
  const footwear = await api
    .get('/api/products/browse?category=calzado&gender=hombre&limit=1&seed=0.4')
    .expect(200);
  assert.equal(footwear.body.items[0]._id, productId);
  assert.equal(footwear.body.total, 1);
  const legacy = await api.get('/api/products?category=tenis&gender=mujer').expect(200);
  assert.equal(legacy.body[0].category, 'calzado');
  const shopper = { name: 'Comprador', email: 'edge@example.com', password: 'a-strong-password' };
  await api.post('/api/auth/register').send(shopper).expect(201);
  const session = await api
    .post('/api/auth/login')
    .send({ email: shopper.email, password: shopper.password })
    .expect(200);
  const header = { Authorization: `Bearer ${session.body.token}` };
  await api
    .put('/api/shop/cart')
    .set(header)
    .send({ items: [{ productId, variantKey: 'negro', size: 'M', quantity: 1 }] })
    .expect(200);
  const order = await api
    .post('/api/shop/checkout')
    .set(header)
    .send({ paymentMethod: 'pse', checkoutKey: randomUUID() })
    .expect(201);
  await api
    .put(`/api/products/${productId}`)
    .set(ownerHeader)
    .send({ ...data, revision: created.body.__v })
    .expect(409);
  const latest = await api.get(`/api/products/${productId}`).expect(200);
  await api
    .put(`/api/products/${productId}`)
    .set(ownerHeader)
    .send({ ...data, variants: [data.variants[1]], revision: latest.body.__v })
    .expect(200);
  await api
    .post(`/api/shop/orders/${order.body._id}/return`)
    .set(header)
    .send({ reason: 'Cambio de talla' })
    .expect(200);
  await api.post(`/api/shop/admin/returns/${order.body._id}/accept`).set(ownerHeader).expect(200);
  const restored = await Product.findById(productId);
  assert.equal(restored!.variants.find((v) => v.key === 'negro')!.sizes[0].stock, 1);
  assert.equal(restored!.variants.find((v) => v.key === 'negro')!.images[0], upload.body.url);
  const staleCartProduct = await Product.create({ ...productData, name: 'Referencia agotada' });
  const otherProduct = await Product.create({ ...productData, name: 'Otra referencia' });
  const items = [staleCartProduct, otherProduct].map((p) => ({
    productId: p.id,
    variantKey: 'negro',
    size: 'M',
    quantity: 1,
  }));
  await api.put('/api/shop/cart').set(header).send({ items }).expect(200);
  await Product.updateMany(
    { _id: { $in: [staleCartProduct._id, otherProduct._id] } },
    { active: false },
  );
  await api
    .put('/api/shop/cart')
    .set(header)
    .send({ items: [items[1]] })
    .expect(200);
  await api.put('/api/shop/cart').set(header).send({ items: [] }).expect(200);
  const browse = await api.get('/api/products/browse?limit=1&seed=0.1').expect(200);
  const next = await api.get('/api/products/browse?limit=1&seed=0.1&page=2').expect(200);
  assert.notEqual(browse.body.items[0]._id, next.body.items[0]._id);
});

test('el administrador interno inicia por usuario sin correo y el registro público conserva sus reglas', async () => {
  const admin = await User.findOne({ role: 'admin' }).select('+passwordHash');
  assert.ok(admin);
  const original = { email: admin.email, passwordHash: admin.passwordHash };
  try {
    await User.updateOne(
      { _id: admin.id },
      {
        $set: { username: 'demo-owner', passwordHash: await bcrypt.hash('demo-pass', 12) },
        $unset: { email: 1 },
      },
    );
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Demo-Owner', password: 'demo-pass' })
      .expect(200);
    assert.equal(login.body.user.role, 'admin');
    assert.equal(login.body.user.email, undefined);
    await request(app)
      .get('/api/products/manage')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'Demo-Owner', password: 'incorrect' })
      .expect(401);
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cliente', email: 'demo-owner', password: 'demo-pass' })
      .expect(400);
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cliente', email: 'short@example.com', password: 'demo-pass' })
      .expect(400);
  } finally {
    await User.updateOne({ _id: admin.id }, { $set: original, $unset: { username: 1 } });
  }
});

test('las tres cuentas internas comparten edición y solo el administrador desactiva personal', async () => {
  const accounts = await User.find({ role: { $in: ['admin', 'staff'] }, active: true });
  assert.equal(accounts.length, 3);
  assert.equal(accounts.filter((account) => account.role === 'admin').length, 1);
  const target = accounts.find((account) => account.role === 'staff')!;
  for (const account of accounts) {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'a-strong-password' })
      .expect(200);
    const api = request(app);
    const header = { Authorization: `Bearer ${login.body.token}` };
    await api.get('/api/products/manage').set(header).expect(200);
    const created = await api
      .post('/api/products')
      .set(header)
      .send({ ...productData, name: `Edición ${account.role}` })
      .expect(201);
    await api
      .put(`/api/products/${created.body._id}`)
      .set(header)
      .send({ ...productData, name: 'Prenda actualizada', revision: created.body.__v })
      .expect(200);
    await api.delete(`/api/products/${created.body._id}`).set(header).expect(204);
    for (const key of ['homeBanner', 'contactBanner']) {
      await api
        .put('/api/content')
        .set(header)
        .send({ key, value: { title: 'Banner editable', subtitle: 'Prueba de permisos' } })
        .expect(200);
    }
    await api.put('/api/content').set(header).send({ key: 'carousel', value: [] }).expect(200);
    await api
      .put('/api/content')
      .set(header)
      .send({ key: 'about', value: { title: 'Nosotros', text: 'Contenido editable' } })
      .expect(200);
    await api
      .post('/api/media')
      .set(header)
      .attach(
        'image',
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
          'base64',
        ),
        'permission.png',
      )
      .expect(201);
    await api.get('/api/shop/admin/returns').set(header).expect(200);
    if (account.role === 'staff') {
      await api.delete(`/api/auth/staff/${target.id}`).set(header).expect(403);
      assert.equal((await User.findById(target.id))!.active, true);
    }
  }
});

test('Vercel recibe CORS con credenciales y supera la validación de origen en escrituras', async () => {
  const origin = 'https://kova-ten-omega.vercel.app';
  for (const path of ['/api/auth/login', '/api/products', '/api/content', '/api/media']) {
    const preflight = await request(app)
      .options(path)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    assert.equal(preflight.headers['access-control-allow-origin'], origin);
    assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
    assert.match(preflight.headers.vary, /Origin/);
  }
  // A validation error confirms the trusted request reached the login handler.
  const login = await request(app)
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({})
    .expect(400);
  assert.equal(login.headers['access-control-allow-origin'], origin);
  const rejected = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'https://kova-ten-omega.vercel.app.evil.example')
    .send({})
    .expect(403);
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  const untrustedPreflight = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'https://another-site.vercel.app')
    .set('Access-Control-Request-Method', 'POST');
  assert.equal(untrustedPreflight.headers['access-control-allow-origin'], undefined);
});

test('los banners simples admiten imagen y texto sin botones para las tres cuentas internas', async () => {
  const accounts = await User.find({ role: { $in: ['admin', 'staff'] }, active: true });
  for (const account of accounts) {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'a-strong-password' })
      .expect(200);
    const header = { Authorization: `Bearer ${login.body.token}` };
    for (const key of ['accessBanner', 'aboutBanner']) {
      const value = {
        title: 'Banner simple',
        subtitle: 'Texto editable',
        image: 'https://example.com/banner.jpg',
      };
      await request(app).put('/api/content').set(header).send({ key, value }).expect(200);
      await request(app)
        .put('/api/content')
        .set(header)
        .send({ key, value: { ...value, ctaLabel: 'No permitido' } })
        .expect(400);
      const content = await request(app).get('/api/content').expect(200);
      assert.deepEqual(content.body.find((item: any) => item.key === key).value, value);
    }
  }
  await request(app)
    .put('/api/content')
    .send({ key: 'accessBanner', value: { title: 'X', subtitle: '' } })
    .expect(401);
});

test('sesiones simultáneas por Bearer funcionan sin cookies y una cuenta no cierra la otra', async () => {
  const accounts = await User.find({ role: 'staff', active: true });
  const sessions = await Promise.all(
    accounts.map(async (account) => {
      const login = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://kova-ten-omega.vercel.app')
        .send({ email: account.email, password: 'a-strong-password' })
        .expect(200);
      return { account, token: login.body.token };
    }),
  );
  for (const session of sessions) {
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${session.token}`)
      .expect(200);
    assert.equal(me.body.id, session.account.id);
    await request(app)
      .get('/api/products/manage')
      .set('Authorization', `Bearer ${session.token}`)
      .expect(200);
  }
  const preflight = await request(app)
    .options('/api/products/manage')
    .set('Origin', 'https://kova-ten-omega.vercel.app')
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .expect(204);
  assert.match(preflight.headers['access-control-allow-headers'], /authorization/i);
  await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${sessions[0].token}`)
    .expect(204);
  await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${sessions[1].token}`)
    .expect(200);
});

test('la revisión pública cambia al editar catálogo y contenido sin exponer datos privados', async () => {
  const before = await request(app).get('/api/updates').expect(200);
  assert.deepEqual(Object.keys(before.body).sort(), ['catalog', 'content']);
  assert.equal(before.headers['cache-control'], 'no-store');
  const product = await Product.create(productData);
  const stamp = new Date(Date.now() + 1000);
  await Product.updateOne(
    { _id: product.id },
    { $set: { updatedAt: stamp } },
    { timestamps: false },
  );
  const catalog = await request(app).get('/api/updates').expect(200);
  assert.notEqual(catalog.body.catalog, before.body.catalog);
  await Content.updateOne(
    { key: 'accessBanner' },
    { $set: { updatedAt: stamp } },
    { timestamps: false },
  );
  const content = await request(app).get('/api/updates').expect(200);
  assert.notEqual(content.body.content, catalog.body.content);
});
