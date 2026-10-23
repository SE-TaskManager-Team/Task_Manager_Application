
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Liveness: confirms that the application process is responding.
router.get('/health/live', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString()
    }
  });
});

// Readiness: confirms that the application can access MongoDB.
router.get('/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      database: ready ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    }
  });
});

// Existing health endpoint retained for compatibility.
router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  let dbStatusText = 'disconnected';

  if (dbStatus === 1) dbStatusText = 'connected';
  else if (dbStatus === 2) dbStatusText = 'connecting';

  const isHealthy = dbStatus === 1;

  res.status(isHealthy ? 200 : 503).json({
    success: true,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatusText,
        readyState: dbStatus
      },
      uptime: process.uptime()
    }
  });
});

module.exports = router;
