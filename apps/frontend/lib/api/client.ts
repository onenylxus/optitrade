/**
 * REST API Client for backend
 * Handles communication with FastAPI backend
 */

import { HelloRequest, HelloResponse, HealthResponse, ApiError } from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * Make a fetch request with error handling
 */
async function fetchWithErrorHandling<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        code: `HTTP_${response.status}`,
        message: errorData.detail || response.statusText,
      } as ApiError;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      throw error;
    }
    throw {
      code: 'FETCH_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    } as ApiError;
  }
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<HealthResponse> {
  return fetchWithErrorHandling<HealthResponse>(`${BACKEND_URL}/health`);
}

/**
 * Say hello via REST API with JSON body
 */
export async function sayHelloRest(request: HelloRequest): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>(`${BACKEND_URL}/api/v1/hello`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Say hello via REST API with path parameter
 */
export async function sayHelloRestPath(name: string): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>(
    `${BACKEND_URL}/api/v1/hello/${encodeURIComponent(name)}`,
  );
}

/**
 * Say hello via gRPC (through Next.js API proxy)
 */
export async function sayHelloGrpc(request: HelloRequest): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>('/api/grpc/hello', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
