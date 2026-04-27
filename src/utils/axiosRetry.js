/**
 * Axios retry interceptor for handling transient network errors
 * Implements exponential backoff to avoid overwhelming the server
 */

import axios from 'axios';

export function setupAxiosRetry(axiosInstance = axios) {
  const retryConfig = {
    maxRetries: 3,
    retryDelay: (retryCount) => {
      // Exponential backoff: 500ms, 1000ms, 2000ms
      return Math.pow(2, retryCount - 1) * 500;
    },
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrorCodes: ['ECONNABORTED', 'ECONNREFUSED', 'ETIMEDOUT', 'ERR_NETWORK']
  };

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config;

      if (!config) {
        return Promise.reject(error);
      }

      config.retryCount = config.retryCount || 0;

      const isRetryable =
        retryConfig.retryableStatusCodes.includes(error.response?.status) ||
        retryConfig.retryableErrorCodes.includes(error.code);

      const isNotRetried = config.retryCount < retryConfig.maxRetries;

      if (isRetryable && isNotRetried && error.response?.status !== 401) {
        config.retryCount++;
        const delayMs = retryConfig.retryDelay(config.retryCount);

        console.warn(
          `⚠️  Request failed (attempt ${config.retryCount}/${retryConfig.maxRetries}), ` +
          `retrying in ${delayMs}ms: ${error.message}`
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        return axiosInstance(config);
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
}

export default setupAxiosRetry;
