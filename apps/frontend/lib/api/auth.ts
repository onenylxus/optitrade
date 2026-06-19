import type { AuthenticatedUserResponse, ApiError } from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error('Environment variable NEXT_PUBLIC_BACKEND_URL is not defined');
}

function detailMessage(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === 'object' && entry && 'msg' in entry) {
          return String((entry as { msg: unknown }).msg);
        }
        return String(entry);
      })
      .join('; ');
  }

  return 'Request failed';
}

async function requestWithAuth<T>(
  path: string,
  firebaseIdToken: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body != null ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${firebaseIdToken}`,
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { detail?: unknown };
    throw {
      code: `HTTP_${response.status}`,
      message: errorData.detail != null ? detailMessage(errorData.detail) : response.statusText,
    } as ApiError;
  }

  return (await response.json()) as T;
}

export async function loadBackendAuthProfile(
  firebaseIdToken: string,
): Promise<AuthenticatedUserResponse> {
  return requestWithAuth<AuthenticatedUserResponse>('/api/v1/auth/me', firebaseIdToken, {
    method: 'GET',
  });
}

export async function syncBackendAuthSession(
  firebaseIdToken: string,
): Promise<AuthenticatedUserResponse> {
  return requestWithAuth<AuthenticatedUserResponse>('/api/v1/auth/session', firebaseIdToken, {
    method: 'POST',
  });
}
