// Centralized error handler
const errorHandler = (err, req, res, next) => {
  console.error("[Error] ");

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected server error occurred.';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  });
};

const notFoundHandler = (req, res, next) => {
  const error = new Error("Resource not found: ");
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
};

module.exports = { errorHandler, notFoundHandler };
