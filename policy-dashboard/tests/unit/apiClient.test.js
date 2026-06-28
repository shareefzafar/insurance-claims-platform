import { jest } from '@jest/globals';
import { ApiClient, HttpError } from '../../src/utils/apiClient.js';

// Fake timers for most tests — switched to real for the retry test
jest.useFakeTimers();

describe('ApiClient', () => {
  let client;

  beforeEach(() => {
    client       = new ApiClient({ baseUrl: 'http://localhost:8080', timeoutMs: 1000 });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  function mockResponse(data, status = 200) {
    global.fetch.mockResolvedValue({
      ok:         status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json:       async () => ({ data, status, message: 'OK' }),
    });
  }

  function mockError(status) {
    global.fetch.mockResolvedValue({
      ok:         false,
      status,
      statusText: 'Error',
      json:       async () => ({ message: 'Error' }),
    });
  }

  // ── get ────────────────────────────────────────────────────────────────────

  test('get() resolves with response data', async () => {
    mockResponse({ id: 'CLM-001', status: 'SUBMITTED' });
    const result = await client.get('/claims/CLM-001');
    expect(result).toEqual({ id: 'CLM-001', status: 'SUBMITTED' });
  });

  test('get() sends Authorization header when token present', async () => {
    const tokenClient = new ApiClient({
      baseUrl:  'http://localhost:8080',
      getToken: () => 'test-jwt-token',
    });
    mockResponse({ id: 'CLM-001' });
    await tokenClient.get('/claims/CLM-001');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/claims/CLM-001',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-jwt-token' }),
      })
    );
  });

  test('get() does NOT send Authorization header when no token', async () => {
    mockResponse({ id: 'CLM-001' });
    await client.get('/claims/CLM-001');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/claims/CLM-001',
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      })
    );
  });

  // ── post ───────────────────────────────────────────────────────────────────

  test('post() sends JSON body with correct method', async () => {
    mockResponse({ id: 'CLM-NEW' }, 201);
    const body = { policyId: 'POL-001', amount: 500 };
    await client.post('/claims', body);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/claims',
      expect.objectContaining({
        method: 'POST',
        body:   JSON.stringify(body),
      })
    );
  });

  // ── put ────────────────────────────────────────────────────────────────────

  test('put() sends correct method and body', async () => {
    mockResponse({ id: 'CLM-001', status: 'APPROVED' });
    await client.put('/claims/CLM-001/approve', {});
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/claims/CLM-001/approve',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  // ── errors ─────────────────────────────────────────────────────────────────

  test('throws HttpError for 404 response', async () => {
    mockError(404);
    await expect(client.get('/claims/MISSING')).rejects.toThrow(HttpError);
  });

  test('throws HttpError with correct status code', async () => {
    mockError(403);
    try {
      await client.get('/claims/FORBIDDEN');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(403);
    }
  });

  test('throws HttpError for 500 response', async () => {
    mockError(500);
    await expect(client.get('/claims')).rejects.toThrow(HttpError);
  });

  // ── retry ──────────────────────────────────────────────────────────────────

  test('retries on 503 and succeeds on second attempt', async () => {
    // Switch to real timers — fake timers block async retry sleep()
    jest.useRealTimers();

    global.fetch
      .mockResolvedValueOnce({
        ok: false, status: 503, statusText: 'Service Unavailable',
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        json: async () => ({ data: { id: 'CLM-001' }, status: 200, message: 'OK' }),
      });

    // Small baseDelayMs so the retry fires in ~100ms — well within 10s timeout
    const fastClient = new ApiClient({
      baseUrl:    'http://localhost:8080',
      timeoutMs:  5000,
      getToken:   () => null,
    });

    const result = await fastClient.get('/claims/CLM-001');

    expect(result).toEqual({ id: 'CLM-001' });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Restore fake timers for subsequent tests
    jest.useFakeTimers();
  }, 10000);

  test('does NOT retry on 404 — not retryable', async () => {
    mockError(404);
    await expect(client.get('/claims/MISSING')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1); // no retry
  });

  test('does NOT retry on 403 — not retryable', async () => {
    mockError(403);
    await expect(client.get('/claims/FORBIDDEN')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // ── HttpError helpers ──────────────────────────────────────────────────────

  test('HttpError.isRetryable is true for 503', () => {
    expect(new HttpError(503, 'Service Unavailable').isRetryable).toBe(true);
  });

  test('HttpError.isRetryable is true for 429 (rate limited)', () => {
    expect(new HttpError(429, 'Too Many Requests').isRetryable).toBe(true);
  });

  test('HttpError.isRetryable is false for 404', () => {
    expect(new HttpError(404, 'Not Found').isRetryable).toBe(false);
  });

  test('HttpError.isRetryable is false for 500', () => {
    expect(new HttpError(500, 'Internal Server Error').isRetryable).toBe(false);
  });

  test('HttpError message includes status code', () => {
    const err = new HttpError(404, 'Not Found');
    expect(err.message).toContain('404');
    expect(err.message).toContain('Not Found');
  });
});
