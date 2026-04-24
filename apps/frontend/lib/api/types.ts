/**
 * Types for API calls
 */

export interface HelloRequest {
  name: string;
}

export interface HelloResponse {
  message: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
}

export interface ApiError {
  code: string;
  message: string;
}
