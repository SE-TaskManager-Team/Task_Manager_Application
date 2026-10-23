 // Centralized error handler
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
    ? err.statusCode
    : 500;

  const errorCode = err.code || (
    statusCode === 500
      ? 'INTERNAL_SERVER_ERROR'
      : 'REQUEST_ERROR'
  );

  // Keep detailed errors in server logs, not in production responses.
  console.error('[Error]', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    timestamp: new Date().toISOString()
  });

  const message = statusCode >= 500
    ? 'An unexpected server error occurred.'
    : err.message || 'The request could not be completed.';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message
    }
  });
};

const notFoundHandler = (req, res, next) => {
  const error = new Error('Resource not found.');
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
};

module.exports = { errorHandler, notFoundHandler };
