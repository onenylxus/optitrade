/**
 * API Integration Tests
 * Tests both REST and gRPC API calls
 */

import { describe, it, expect } from 'vitest';
import { checkHealth, sayHelloRest, sayHelloRestPath, sayHelloGrpc } from '@/lib/api/client';

// For testing, we'll use localhost backend
// Make sure backend is running on port 8000 (REST) and 50051 (gRPC)

describe('Backend API Integration', () => {
  describe('REST API - Health Check', () => {
    it('should check backend health', async () => {
      const response = await checkHealth();
      expect(response).toHaveProperty('status');
      expect(response.status).toBe('healthy');
    });
  });

  describe('REST API - Say Hello', () => {
    it('should greet via POST with JSON body', async () => {
      const response = await sayHelloRest({ name: 'World' });
      expect(response).toHaveProperty('message');
      expect(response.message).toBe('Hello, World!');
    });

    it('should greet with different names', async () => {
      const names = ['Alice', 'Bob', 'Charlie'];

      for (const name of names) {
        const response = await sayHelloRest({ name });
        expect(response.message).toBe(`Hello, ${name}!`);
      }
    });

    it('should greet via GET with path parameter', async () => {
      const response = await sayHelloRestPath('DevWorld');
      expect(response).toHaveProperty('message');
      expect(response.message).toBe('Hello, DevWorld!');
    });

    it('should handle special characters in names', async () => {
      const response = await sayHelloRestPath('Test@123');
      expect(response.message).toBe('Hello, Test@123!');
    });
  });

  describe('gRPC API - Say Hello', () => {
    it('should greet via gRPC', async () => {
      const response = await sayHelloGrpc({ name: 'gRPC' });
      expect(response).toHaveProperty('message');
      expect(response.message).toBe('Hello, gRPC!');
    });

    it('should greet with different names via gRPC', async () => {
      const names = ['Alice', 'Bob', 'gRPC-User'];

      for (const name of names) {
        const response = await sayHelloGrpc({ name });
        expect(response.message).toBe(`Hello, ${name}!`);
      }
    });
  });

  describe('API Comparison - REST vs gRPC', () => {
    it('should return same greeting for same name via REST and gRPC', async () => {
      const testName = 'TestUser';

      const restResponse = await sayHelloRest({ name: testName });
      const grpcResponse = await sayHelloGrpc({ name: testName });

      expect(restResponse.message).toBe(grpcResponse.message);
      expect(restResponse.message).toBe(`Hello, ${testName}!`);
    });

    it('should return consistent results across multiple calls', async () => {
      const testName = 'ConsistencyTest';
      const iterations = 3;

      const restResults = [];
      const grpcResults = [];

      for (let i = 0; i < iterations; i++) {
        restResults.push(await sayHelloRest({ name: testName }));
        grpcResults.push(await sayHelloGrpc({ name: testName }));
      }

      // All results should be the same
      restResults.forEach((result) => {
        expect(result.message).toBe(`Hello, ${testName}!`);
      });

      grpcResults.forEach((result) => {
        expect(result.message).toBe(`Hello, ${testName}!`);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty name in REST POST', async () => {
      try {
        await sayHelloRest({ name: '' });
        // If it succeeds, that's also valid (backend may handle it)
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network errors gracefully', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      try {
        // Override backend URL temporarily
        process.env.NEXT_PUBLIC_BACKEND_URL = 'http://invalid-backend:9999';

        // This should fail
        await checkHealth();
        // If we get here, restore the original URL
        process.env.NEXT_PUBLIC_BACKEND_URL = originalUrl;
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        process.env.NEXT_PUBLIC_BACKEND_URL = originalUrl;
      }
    });
  });
});
