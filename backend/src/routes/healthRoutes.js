const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

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
