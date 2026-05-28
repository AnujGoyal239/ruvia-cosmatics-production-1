import { apiUrl } from '../constants';
import {
  validateResponse,
  handleValidationError,
} from '../utils/responseValidator';
import { withCsrf } from './csrf';

/**
 * Error thrown when an API response fails schema validation.
 *
 * Thrown by ApiClient.request / postFormData when the caller supplied
 * an `options.schema` (a Zod schema) and the parsed JSON response does
 * not match that schema. The original (unvalidated) data is exposed
 * via the `data` property for debugging or fallback handling.
 */
export class ResponseValidationError extends Error {
  constructor(message, { endpoint, data } = {}) {
    super(message);
    this.name = 'ResponseValidationError';
    this.endpoint = endpoint;
    this.data = data;
  }
}

/**
 * Centralized API client with error handling, retry logic, and
 * optional response schema validation.
 *
 * Schema validation is opt-in: pass a Zod schema via `options.schema`
 * to any request method to validate the response before returning it.
 * When validation fails, the error is logged and a
 * `ResponseValidationError` is thrown so callers cannot accidentally
 * use a malformed response shape.
 *
 * Requirements: 14
 */
class ApiClient {
  constructor() {
    this.baseURL = apiUrl('');
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Validate parsed response data against an optional Zod schema.
   *
   * If no schema is provided, the data is returned as-is. On
   * validation failure, the error is logged via handleValidationError
   * and a ResponseValidationError is thrown.
   *
   * @param {unknown} data - Parsed JSON response.
   * @param {import('zod').ZodSchema | undefined} schema - Optional schema.
   * @param {string} endpoint - Endpoint for error context/logging.
   * @returns Validated data (or original data if no schema given).
   */
  _validate(data, schema, endpoint) {
    if (!schema) {
      return data;
    }

    const result = validateResponse(data, schema);
    if (!result.isValid) {
      const errorMessage = result.error || 'Unknown validation error';
      handleValidationError(errorMessage, `apiClient ${endpoint}`);
      throw new ResponseValidationError(
        `Response validation failed for ${endpoint}: ${errorMessage}`,
        { endpoint, data }
      );
    }

    return result.data;
  }

  /**
   * Generic request method with retry logic and optional response
   * schema validation.
   *
   * @param {string} endpoint - Endpoint path or absolute URL.
   * @param {object} [options] - Fetch options. May include a
   *   `schema` (Zod schema) to validate the parsed response against.
   * @param {number} [retries=2] - Retry count for 5xx/network errors.
   */
  async request(endpoint, options = {}, retries = 2) {
    const url = endpoint.startsWith('http') ? endpoint : apiUrl(endpoint);
    // Pull schema out so it isn't forwarded as a fetch option.
    const { schema, ...fetchOptions } = options;

    for (let i = 0; i <= retries; i++) {
      try {
        // withCsrf merges credentials: "include" and the X-CSRF-Token
        // header (read from the XSRF-TOKEN cookie) for mutating requests.
        // GET / HEAD / OPTIONS pass through unchanged.
        const response = await fetch(
          url,
          withCsrf({
            ...this.defaultOptions,
            ...fetchOptions,
            headers: {
              ...this.defaultOptions.headers,
              ...fetchOptions.headers,
            },
          })
        );

        if (!response.ok) {
          const error = await this.handleError(response);

          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }

          // Retry on server errors (5xx)
          if (i === retries) {
            throw error;
          }

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          continue;
        }

        const data = await response.json();
        return this._validate(data, schema, endpoint);
      } catch (error) {
        // Validation failures are deterministic given the response
        // shape and must not be retried or wrapped as network errors.
        if (error instanceof ResponseValidationError) {
          throw error;
        }

        // Network error or other exception
        if (i === retries) {
          throw new Error(`Network error: ${error.message}`);
        }

        // Exponential backoff for network errors
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  /**
   * Handle API errors
   */
  async handleError(response) {
    let errorMessage = 'An error occurred';

    try {
      const data = await response.json();
      errorMessage = data.message || data.error || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    error.response = response;
    return error;
  }

  /**
   * GET request. Pass `options.schema` to validate the response.
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request. Pass `options.schema` to validate the response.
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request. Pass `options.schema` to validate the response.
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request. Pass `options.schema` to validate the response.
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * POST request with FormData (for file uploads). Pass
   * `options.schema` to validate the response.
   */
  async postFormData(endpoint, formData, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : apiUrl(endpoint);
    const { schema, ...fetchOptions } = options;

    try {
      const response = await fetch(
        url,
        withCsrf({
          ...fetchOptions,
          method: 'POST',
          body: formData,
          // Don't set Content-Type for FormData - browser sets it with boundary
        })
      );

      if (!response.ok) {
        const error = await this.handleError(response);
        throw error;
      }

      const data = await response.json();
      return this._validate(data, schema, endpoint);
    } catch (error) {
      // Surface validation errors to callers without wrapping.
      if (error instanceof ResponseValidationError) {
        throw error;
      }
      throw new Error(`Network error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export convenience methods
export const api = {
  get: (endpoint, options) => apiClient.get(endpoint, options),
  post: (endpoint, data, options) => apiClient.post(endpoint, data, options),
  put: (endpoint, data, options) => apiClient.put(endpoint, data, options),
  delete: (endpoint, options) => apiClient.delete(endpoint, options),
  postFormData: (endpoint, formData, options) =>
    apiClient.postFormData(endpoint, formData, options),
};

export default api;
