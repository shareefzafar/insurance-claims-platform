/**
 * ApiClient — fetch wrapper with retry, timeout, auth header injection.
 * Demonstrates: closures, async/await, error handling, retry pattern.
 */

export class HttpError extends Error {
  constructor(status, message, body = null) {
    super(`HTTP ${status}: ${message}`);
    this.name       = 'HttpError';
    this.status     = status;
    this.body       = body;
    this.isRetryable = status === 503 || status === 429;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, { maxAttempts = 3, baseDelayMs = 100, isRetryable = () => true } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === maxAttempts) break;
      await sleep(baseDelayMs * Math.pow(2, attempt - 1)); // exponential backoff
    }
  }
  throw lastError;
}

export class ApiClient {
  constructor({ baseUrl, timeoutMs = 10_000, getToken = () => null } = {}) {
    this.baseUrl   = baseUrl;
    this.timeoutMs = timeoutMs;
    this.getToken  = getToken; // closure — called fresh on each request
  }

  async _request(method, path, body) {
    const url     = `${this.baseUrl}${path}`;
    const token   = this.getToken();
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return retry(async () => {
      // Race request against timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
      );
      const fetchPromise = fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new HttpError(response.status, response.statusText, errorBody);
      }

      if (response.status === 204) return null;
      const json = await response.json();
      return json.data ?? json; // unwrap { data: ... } envelope if present
    }, {
      isRetryable: (err) => err instanceof HttpError && err.isRetryable,
    });
  }

  get(path)          { return this._request('GET',    path); }
  post(path, body)   { return this._request('POST',   path, body); }
  put(path, body)    { return this._request('PUT',    path, body); }
  delete(path)       { return this._request('DELETE', path); }
}

export const apiClient = new ApiClient({
  baseUrl:  '/api/v1',
  getToken: () => sessionStorage.getItem('access_token'),
});
