/**
 * REST API Client for backend
 * Handles communication with FastAPI backend
 */

import type {
  StockChartAnalysisResponse,
  StockChartPatternAnalysisResponse,
  StockChartResponse,
  StockChartSupportResistanceResponse,
} from '@/lib/stock-chart-bridge';
import {
  AuthenticatedUserResponse,
  ApiError,
  HealthResponse,
  HelloBatchRequest,
  HelloPatchRequest,
  HelloRequest,
  HelloResponse,
  HelloStreamResponse,
} from './types';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error('Environment variable NEXT_PUBLIC_BACKEND_URL is not defined');
}

function detailMessage(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (typeof e === 'object' && e && 'msg' in e) {
          return String((e as { msg: unknown }).msg);
        }
        return String(e);
      })
      .join('; ');
  }
  return 'Request failed';
}

/**
 * Make a fetch request with error handling
 */
async function fetchWithErrorHandling<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method ?? 'GET';
  const sendJsonBody = options?.body != null && method !== 'GET' && method !== 'HEAD';

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(sendJsonBody ? { 'Content-Type': 'application/json' } : {}),
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

    return await response.json();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      typeof (error as { code: unknown }).code === 'string' &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
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

export async function sayHelloRestPut(name: string): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>(
    `${BACKEND_URL}/api/v1/hello/${encodeURIComponent(name)}`,
    {
      method: 'PUT',
    },
  );
}

export async function sayHelloRestPatch(
  name: string,
  request: HelloPatchRequest,
): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>(
    `${BACKEND_URL}/api/v1/hello/${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(request),
    },
  );
}

export async function sayHelloRestDelete(name: string): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>(
    `${BACKEND_URL}/api/v1/hello/${encodeURIComponent(name)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function sayHelloRestBatch(request: HelloBatchRequest): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>(`${BACKEND_URL}/api/v1/hello/batch`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
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

export async function sayHelloGrpcServerStream(
  request: HelloRequest,
): Promise<HelloStreamResponse> {
  return fetchWithErrorHandling<HelloStreamResponse>('/api/grpc/server-stream', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function sayHelloGrpcClientStream(request: HelloBatchRequest): Promise<HelloResponse> {
  return fetchWithErrorHandling<HelloResponse>('/api/grpc/client-stream', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function sayHelloGrpcBidirectional(
  request: HelloBatchRequest,
): Promise<HelloStreamResponse> {
  return fetchWithErrorHandling<HelloStreamResponse>('/api/grpc/bidirectional', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get currently authenticated user profile from backend using Firebase ID token.
 */
export async function getAuthenticatedUser(
  firebaseIdToken: string,
): Promise<AuthenticatedUserResponse> {
  return fetchWithErrorHandling<AuthenticatedUserResponse>(`${BACKEND_URL}/api/v1/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${firebaseIdToken}`,
    },
  });
}

export interface GetStockChartParams {
  symbol: string;
  interval: string;
  range?: string;
  from?: string;
  to?: string;
  signal?: AbortSignal;
}

export interface PortfolioAnalysisResponse {
  insight: string;
  riskLabel: string;
  riskTone: 'low' | 'medium' | 'high';
  strategy: PortfolioStrategyAction[];
  signals: PortfolioPositionSignal[];
  modelId: string;
}

export interface PortfolioStrategyAction {
  label: string;
  symbols: string[];
  reason: string;
}

export interface PortfolioSignalLensView {
  bias: string;
  explanation?: string | null;
}

export interface PortfolioPositionSignalLenses {
  technical?: PortfolioSignalLensView | null;
  'day-trade'?: PortfolioSignalLensView | null;
  'buy-and-hold'?: PortfolioSignalLensView | null;
}

export interface PortfolioPositionSignal {
  symbol: string;
  bias: string;
  confidence?: number | null;
  pattern?: string | null;
  status?: string | null;
  explanation?: string | null;
  lenses?: PortfolioPositionSignalLenses | null;
}

/**
 * OHLCV chart series from the FastAPI ``GET /api/stock/chart`` endpoint (FMP-backed).
 */
function stockChartQueryString(params: GetStockChartParams): string {
  const sp = new URLSearchParams();
  sp.set('symbol', params.symbol);
  sp.set('interval', params.interval);
  if (params.range) {
    sp.set('range', params.range);
  }
  if (params.from) {
    sp.set('from', params.from);
  }
  if (params.to) {
    sp.set('to', params.to);
  }
  return sp.toString();
}

export async function getStockChart(params: GetStockChartParams): Promise<StockChartResponse> {
  const q = stockChartQueryString(params);
  return fetchWithErrorHandling<StockChartResponse>(`${BACKEND_URL}/api/stock/chart?${q}`, {
    method: 'GET',
    signal: params.signal,
  });
}

/**
 * AI chart commentary from ``GET /api/ai/widget/stock-chart`` (same query shape as stock chart).
 */
export async function getStockChartAnalysis(
  params: GetStockChartParams,
): Promise<StockChartAnalysisResponse> {
  const q = stockChartQueryString(params);
  return fetchWithErrorHandling<StockChartAnalysisResponse>(
    `${BACKEND_URL}/api/ai/widget/stock-chart?${q}`,
    {
      method: 'GET',
      signal: params.signal,
    },
  );
}

/**
 * Support / resistance overlay levels from ``GET /api/ai/widget/stock-chart/support-resistance``
 * (same query shape as stock chart; ``FMP_API_KEY`` only on the server).
 */
export async function getStockChartSupportResistance(
  params: GetStockChartParams,
): Promise<StockChartSupportResistanceResponse> {
  const q = stockChartQueryString(params);
  return fetchWithErrorHandling<StockChartSupportResistanceResponse>(
    `${BACKEND_URL}/api/ai/widget/stock-chart/support-resistance?${q}`,
    {
      method: 'GET',
      signal: params.signal,
    },
  );
}

export async function getPortfolioAnalysis(
  signal?: AbortSignal,
  snapshot?: unknown,
): Promise<PortfolioAnalysisResponse> {
  return fetchWithErrorHandling<PortfolioAnalysisResponse>(
    `${BACKEND_URL}/api/ai/widget/portfolio`,
    {
      method: snapshot ? 'POST' : 'GET',
      signal,
      ...(snapshot ? { body: JSON.stringify(snapshot) } : {}),
    },
  );
}
/**
 * Chart-pattern overlays and explanation from ``GET /api/ai/widget/stock-chart/patterns``
 * (same query shape as stock chart; ``OPENROUTER_API_KEY`` is optional on the server).
 */
export async function getStockChartPatterns(
  params: GetStockChartParams,
): Promise<StockChartPatternAnalysisResponse> {
  const q = stockChartQueryString(params);
  return fetchWithErrorHandling<StockChartPatternAnalysisResponse>(
    `${BACKEND_URL}/api/ai/widget/stock-chart/patterns?${q}`,
    {
      method: 'GET',
      signal: params.signal,
    },
  );
}
