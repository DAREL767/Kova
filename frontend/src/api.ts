const apiOrigin = (import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '');
if (apiOrigin && !/^https?:\/\/[^/?#]+$/.test(apiOrigin)) {
  throw new Error('VITE_API_URL debe ser el origen del backend, sin /api ni barra final.');
}
export const apiUrl = (path: string) => `${apiOrigin}/api${path}`;
let sessionToken = '';
try {
  sessionToken = sessionStorage.getItem('kova-token') ?? '';
} catch {
  /* Memory-only session when storage is unavailable. */
}
export function setSessionToken(token: string) {
  sessionToken = token;
  try {
    if (token) sessionStorage.setItem('kova-token', token);
    else sessionStorage.removeItem('kova-token');
  } catch {
    /* The current tab can still authenticate using memory. */
  }
}
export const sessionHeaders = (): Record<string, string> =>
  sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};

// Stored image references remain portable; resolve them against the API when reading.
function mapMedia(value: unknown, reading: boolean): unknown {
  if (typeof value === 'string') {
    const prefix = `${apiOrigin}/api/media/`;
    if (reading && /^\/api\/media\/[a-f\d]{24}$/i.test(value)) return `${apiOrigin}${value}`;
    if (
      !reading &&
      apiOrigin &&
      value.startsWith(prefix) &&
      /^[a-f\d]{24}$/i.test(value.slice(prefix.length))
    ) {
      return `/api/media/${value.slice(prefix.length)}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => mapMedia(item, reading));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapMedia(item, reading)]),
    );
  }
  return value;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hadSession = !!sessionToken;
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      setSessionToken('');
      if (path !== '/auth/me' || hadSession)
        window.dispatchEvent(new Event('kova-session-expired'));
    }
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.details?.[0]?.message ??
        body.error ??
        'No pudimos completar la solicitud. Inténtalo de nuevo.',
    );
  }
  if (
    options.method &&
    !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase()) &&
    /^\/(products|content)(\/|$)/.test(path)
  ) {
    window.dispatchEvent(new Event('kova-data-written'));
  }
  return response.status === 204 ? (undefined as T) : (mapMedia(await response.json(), true) as T);
}
export const send = (method: string, body: unknown) => ({
  method,
  body: JSON.stringify(mapMedia(body, false)),
});
