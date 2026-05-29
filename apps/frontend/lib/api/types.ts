/**
 * Types for API calls
 */

export interface HelloRequest {
  name: string;
}

export interface HelloBatchRequest {
  names: string[];
}

export interface HelloPatchRequest {
  suffix: string;
}

export interface HelloResponse {
  message: string;
}

export interface HelloStreamResponse {
  messages: string[];
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
}

export interface AuthenticatedUserResponse {
  uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  provider_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
}

export interface ApiError {
  code: string;
  message: string;
}
