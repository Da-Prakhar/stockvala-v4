/**
 * Standardized response format
 */

/**
 * Format success response
 * @param {any} data - Response data
 * @param {string} message - Response message
 * @returns {Object} Formatted response
 */
export const successResponse = (data = null, message = 'Success') => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
};

/**
 * Format error response
 * @param {string} message - Error message
 * @param {any} error - Error details
 * @returns {Object} Formatted error response
 */
export const errorResponse = (message = 'Error', error = null) => {
  return {
    success: false,
    message,
    error,
    timestamp: new Date().toISOString()
  };
};

/**
 * Format paginated response
 * @param {Array} data - Response data
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {string} message - Response message
 * @returns {Object} Formatted paginated response
 */
export const paginatedResponse = (data, total, page, limit, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    message,
    timestamp: new Date().toISOString()
  };
};

export default {
  successResponse,
  errorResponse,
  paginatedResponse
};
