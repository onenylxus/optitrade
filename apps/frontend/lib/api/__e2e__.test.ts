/**
 * E2E API Integration Test
 * Run this to verify all API calls work correctly
 * Usage: npx vitest lib/api/__e2e__.test.ts --run
 */

import { describe, it, expect } from 'vitest';
import { checkHealth, sayHelloRest, sayHelloRestPath, sayHelloGrpc } from './client';

describe('E2E API Integration Tests', () => {
  describe('Setup Verification', () => {
    it('should verify backend is accessible', async () => {
      // This test verifies the backend is running
      const health = await checkHealth();
      expect(health.status).toBe('healthy');
    });
  });

  describe('REST API Full Flow', () => {
    it('should perform complete REST workflow', async () => {
      // Test 1: Health check
      const health = await checkHealth();
      expect(health.status).toBe('healthy');

      // Test 2: POST request
      const postResponse = await sayHelloRest({ name: 'Frontend' });
      expect(postResponse.message).toContain('Frontend');

      // Test 3: Path parameter GET request
      const pathResponse = await sayHelloRestPath('NextJS');
      expect(pathResponse.message).toContain('NextJS');
    });
  });

  describe('gRPC API Full Flow', () => {
    it('should perform complete gRPC workflow', async () => {
      const response = await sayHelloGrpc({ name: 'NextJS-gRPC' });
      expect(response.message).toContain('NextJS-gRPC');
    });
  });

  describe('Cross-Protocol Consistency', () => {
    it('should return identical results from REST and gRPC', async () => {
      const testName = 'ConsistencyCheck';

      const restResponse = await sayHelloRest({ name: testName });
      const grpcResponse = await sayHelloGrpc({ name: testName });

      expect(restResponse.message).toBe(grpcResponse.message);
      expect(restResponse.message).toBe(`Hello, ${testName}!`);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = [
        sayHelloRest({ name: 'User1' }),
        sayHelloRest({ name: 'User2' }),
        sayHelloGrpc({ name: 'User3' }),
        sayHelloGrpc({ name: 'User4' }),
      ];

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(4);
      expect(responses[0].message).toBe('Hello, User1!');
      expect(responses[1].message).toBe('Hello, User2!');
      expect(responses[2].message).toBe('Hello, User3!');
      expect(responses[3].message).toBe('Hello, User4!');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode characters', async () => {
      const unicodeName = '😀 Unicode 🎉';
      const response = await sayHelloRest({ name: unicodeName });
      expect(response.message).toContain(unicodeName);
    });

    it('should handle long names', async () => {
      const longName = 'A'.repeat(100);
      const response = await sayHelloRest({ name: longName });
      expect(response.message).toContain(longName);
    });

    it('should handle special characters in path', async () => {
      const specialName = 'Test-123_ABC';
      const response = await sayHelloRestPath(specialName);
      expect(response.message).toContain(specialName);
    });
  });
});
