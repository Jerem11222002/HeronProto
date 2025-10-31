/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {Object} options - The options object
 * @param {boolean} [options.leading=false] - Specify invoking on the leading edge of the timeout
 * @param {boolean} [options.trailing=true] - Specify invoking on the trailing edge of the timeout
 * @returns {Function} Returns the new debounced function
 */
export const debounce = (func, wait, options = {}) => {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let result;
  let isExecuting = false;

  // Default options
  const { leading = false, trailing = true } = options;

  // Validate inputs
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }

  if (typeof wait !== 'number' || wait < 0) {
    throw new TypeError('Wait must be a positive number');
  }

  const debouncedFunction = function (...args) {
    // Store the context and args for later execution
    lastArgs = args;
    lastThis = this;

    // Function to execute
    const executeFunction = () => {
      if (!trailing && timeoutId) {
        return;
      }

      try {
        isExecuting = true;
        result = func.apply(lastThis, lastArgs);
      } catch (error) {
        console.error('Debounced function execution error:', error);
        throw error;
      } finally {
        isExecuting = false;
        timeoutId = null;
        lastArgs = null;
        lastThis = null;
      }
    };

    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Leading edge execution
    if (leading && !timeoutId) {
      executeFunction();
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      if (trailing && !isExecuting) {
        executeFunction();
      }
      timeoutId = null;
    }, wait);

    return result;
  };

  // Add cancel method
  debouncedFunction.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
      lastThis = null;
    }
  };

  // Add flush method
  debouncedFunction.flush = () => {
    if (timeoutId) {
      const result = func.apply(lastThis, lastArgs);
      debouncedFunction.cancel();
      return result;
    }
  };

  // Add pending check
  debouncedFunction.pending = () => {
    return Boolean(timeoutId);
  };

  return debouncedFunction;
};

export default debounce;