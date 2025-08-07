const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Health check endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check with database connectivity
router.get('/detailed', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      service: 'order-service',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'unknown',
        nats: 'unknown'
      }
    };

    // Check database connectivity
    try {
      const db = require('../models/database');
      await db.query('SELECT 1');
      healthStatus.checks.database = 'healthy';
    } catch (error) {
      logger.error('Database health check failed:', error);
      healthStatus.checks.database = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    // Check NATS connectivity
    try {
      const nats = require('../utils/nats');
      healthStatus.checks.nats = nats.isConnected() ? 'healthy' : 'unhealthy';
      if (!nats.isConnected()) {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      logger.error('NATS health check failed:', error);
      healthStatus.checks.nats = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'order-service',
      error: error.message
    });
  }
});

module.exports = router;
