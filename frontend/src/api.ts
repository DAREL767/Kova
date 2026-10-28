export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('kova-session-expired'));
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.details?.[0]?.message ??
        body.error ??
        'No pudimos completar la solicitud. Inténtalo de nuevo.',
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const send = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
