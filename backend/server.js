
require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`[Server] Liveness check available at: http://localhost:${PORT}/api/health/live`);
    console.log(`[Server] Readiness check available at: http://localhost:${PORT}/api/health/ready`);
  });

  let shuttingDown = false;

  async function shutdown(signal)   "perf": "node scripts/performance-check.js"  if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[Server] ${signal} received. Closing server...`);

    const forceExit = setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out.');
      process.exit(1);
    }, 10000);

    forceExit.unref();

    server.close(async (error) => {
      try {
        await mongoose.disconnect();

        if (error) {
          console.error('[Server] Error closing HTTP server:', error.message);
          process.exitCode = 1;
        } else {
          console.log('[Server] HTTP server and database connection closed.');
        }
      } catch (disconnectError) {
        console.error(
          '[Server] Error closing database connection:',
          disconnectError.message
        );
        process.exitCode = 1;
      } finally {
        clearTimeout(forceExit);
      }
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('[Server] Startup failed:', error.message);
  process.exitCode = 1;
});
