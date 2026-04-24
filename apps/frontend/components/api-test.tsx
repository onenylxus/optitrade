'use client';

/**
 * API Test Component
 * Allows manual testing of REST and gRPC APIs from the browser
 */

import { useState } from 'react';
import { checkHealth, sayHelloRest, sayHelloRestPath, sayHelloGrpc } from '@/lib/api/client';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  result?: string;
  error?: string;
  duration?: number;
}

export function ApiTestComponent() {
  const [testName, setTestName] = useState('World');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [result, ...prev]);
  };

  const formatForDisplay = (value: unknown): string => {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      const maybeMessage = (value as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Unserializable object]';
      }
    }
    return String(value);
  };

  const runTest = async (testId: string, testName: string, testFn: () => Promise<unknown>) => {
    const result: TestResult = {
      id: testId,
      name: testName,
      status: 'pending',
    };
    addResult(result);

    const startTime = Date.now();

    try {
      const output = await testFn();
      const duration = Date.now() - startTime;

      setResults((prev) =>
        prev.map((r) =>
          r.id === testId
            ? {
                ...r,
                status: 'success',
                result: formatForDisplay(output),
                duration,
              }
            : r,
        ),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      setResults((prev) =>
        prev.map((r) =>
          r.id === testId
            ? {
                ...r,
                status: 'error',
                error: formatForDisplay(error),
                duration,
              }
            : r,
        ),
      );
    }
  };

  const handleHealthCheck = () => {
    runTest('health', 'Health Check', () => checkHealth());
  };

  const handleRestPost = () => {
    runTest(`rest-post-${Date.now()}`, `REST POST - Hello ${testName}`, () =>
      sayHelloRest({ name: testName }),
    );
  };

  const handleRestPath = () => {
    runTest(`rest-path-${Date.now()}`, `REST PATH - Hello ${testName}`, () =>
      sayHelloRestPath(testName),
    );
  };

  const handleGrpcCall = () => {
    runTest(`grpc-${Date.now()}`, `gRPC - Hello ${testName}`, () =>
      sayHelloGrpc({ name: testName }),
    );
  };

  const handleRunAll = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      await runTest('health-all', 'Health Check', () => checkHealth());

      await new Promise((resolve) => setTimeout(resolve, 500));
      await runTest('rest-post-all', `REST POST - Hello ${testName}`, () =>
        sayHelloRest({ name: testName }),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
      await runTest('rest-path-all', `REST PATH - Hello ${testName}`, () =>
        sayHelloRestPath(testName),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
      await runTest('grpc-all', `gRPC - Hello ${testName}`, () => sayHelloGrpc({ name: testName }));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">API Test Dashboard</h2>

        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Name Input</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter name for testing"
            />
          </div>

          {/* Buttons Section */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleHealthCheck}
              disabled={isRunning}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            >
              Health Check
            </button>
            <button
              onClick={handleRestPost}
              disabled={isRunning}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
            >
              REST POST
            </button>
            <button
              onClick={handleRestPath}
              disabled={isRunning}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
            >
              REST PATH
            </button>
            <button
              onClick={handleGrpcCall}
              disabled={isRunning}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-400"
            >
              gRPC Call
            </button>
          </div>

          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 font-semibold"
          >
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold">Test Results</h3>
        {results.length === 0 ? (
          <p className="text-gray-500 italic">No tests run yet</p>
        ) : (
          results.map((result) => (
            <div
              key={result.id}
              className={`rounded-lg p-4 border-l-4 ${
                result.status === 'pending'
                  ? 'bg-yellow-50 border-yellow-500'
                  : result.status === 'success'
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{result.name}</h4>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.status === 'pending'
                        ? 'bg-yellow-200 text-yellow-800'
                        : result.status === 'success'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {result.status.toUpperCase()}
                  </span>
                  {result.duration && (
                    <span className="text-sm text-gray-600">{result.duration}ms</span>
                  )}
                </div>
              </div>

              {result.status === 'pending' && <p className="text-gray-600">Running...</p>}

              {result.result && (
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-48">
                  {result.result}
                </pre>
              )}

              {result.error && (
                <pre className="bg-red-100 p-3 rounded text-sm text-red-800 overflow-auto max-h-48">
                  {result.error}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
