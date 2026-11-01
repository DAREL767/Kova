import { test } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map([['kova-token', 'restored-session']]);
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { api, setSessionToken, sessionHeaders, ApiError } = await import('../src/api.ts');

test('la sesión se restaura al recargar y autentica sin depender de cookies', async () => {
  assert.equal(sessionHeaders().Authorization, 'Bearer restored-session');
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer restored-session');
    return Response.json({ id: 'owner', role: 'admin' });
  };
  assert.equal((await api('/auth/me')).id, 'owner');
});

test('el nuevo acceso sustituye el token de la pestaña y lo usa también para subir imágenes', () => {
  setSessionToken('new-session');
  assert.equal(storage.get('kova-token'), 'new-session');
  assert.equal(sessionHeaders().Authorization, 'Bearer new-session');
  setSessionToken('');
  assert.equal(storage.has('kova-token'), false);
  assert.deepEqual(sessionHeaders(), {});
});

test('un error de red conserva la sesión y un 401 revoca el token', async () => {
  setSessionToken('valid-session');
  globalThis.fetch = async () => {
    throw new TypeError('Sin conexión');
  };
  await assert.rejects(api('/shop/cart'), TypeError);
  assert.equal(sessionHeaders().Authorization, 'Bearer valid-session');
  let expired = 0;
  window.addEventListener('kova-session-expired', () => expired++);
  globalThis.fetch = async () => Response.json({ error: 'Sesión vencida' }, { status: 401 });
  await assert.rejects(api('/auth/me'), ApiError);
  assert.equal(expired, 1);
  assert.deepEqual(sessionHeaders(), {});
  await assert.rejects(api('/auth/me'), ApiError);
  assert.equal(expired, 1, 'La visita de un usuario anónimo no muestra una sesión expirada');
});

test('la autenticación sigue disponible en memoria si el navegador bloquea el almacenamiento', () => {
  sessionStorage.setItem = () => {
    throw new Error('Storage bloqueado');
  };
  sessionStorage.removeItem = () => {
    throw new Error('Storage bloqueado');
  };
  setSessionToken('memory-session');
  assert.equal(sessionHeaders().Authorization, 'Bearer memory-session');
  setSessionToken('');
  assert.deepEqual(sessionHeaders(), {});
});
