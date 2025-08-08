const express = require('express');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');
const circuitBreakerManager = require('./utils/circuitBreaker');
const serviceDiscovery = require('./utils/serviceDiscovery');
const securityMiddleware = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced security middleware
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.cors);
app.use(compression());

// Rate limiting with different limits for different endpoints
app.use(securityMiddleware.rateLimit.general); // General rate limit
app.use('/api/auth', securityMiddleware.rateLimit.auth); // Strict rate limit for auth
app.use('/api', securityMiddleware.rateLimit.api); // API rate limit

// Additional security headers
app.use(securityMiddleware.additionalHeaders);

// Request validation and sanitization
app.use(securityMiddleware.validateRequest);
app.use(securityMiddleware.sanitizeInput);

// Security logging
app.use(securityMiddleware.securityLogging);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'] || require('uuid').v4()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    const healthStatus = {
      status: 'ready',
      service: 'api-gateway',
      checks: {
        auth_service: 'unknown',
        user_service: 'unknown',
        order_service: 'unknown'
      },
      timestamp: new Date().toISOString()
    };

    // Check service health
    const services = [
      { name: 'auth_service', url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001' },
      { name: 'user_service', url: process.env.USER_SERVICE_URL || 'http://user-service:3002' },
      { name: 'order_service', url: process.env.ORDER_SERVICE_URL || 'http://order-service:3003' }
    ];

    for (const service of services) {
      try {
        const response = await require('axios').get(`${service.url}/health`, { timeout: 5000 });
        healthStatus.checks[service.name] = response.status === 200 ? 'healthy' : 'unhealthy';
      } catch (error) {
        logger.error(`Health check failed for ${service.name}:`, error.message);
        healthStatus.checks[service.name] = 'unhealthy';
      }
    }

    const allHealthy = Object.values(healthStatus.checks).every(status => status === 'healthy');
    const statusCode = allHealthy ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'api-gateway',
      error: error.message
    });
  }
});

// Create circuit breakers for each service
const authBreaker = circuitBreakerManager.createHttpBreaker('auth-service', process.env.AUTH_SERVICE_URL || 'http://auth-service:3001');
const userBreaker = circuitBreakerManager.createHttpBreaker('user-service', process.env.USER_SERVICE_URL || 'http://user-service:3002');
const orderBreaker = circuitBreakerManager.createHttpBreaker('order-service', process.env.ORDER_SERVICE_URL || 'http://order-service:3003');

// API routes with authentication and circuit breaker
app.use('/api/auth', authMiddleware.optionalAuth, async (req, res, next) => {
  try {
    const response = await authBreaker.fire({
      method: req.method,
      url: req.url.replace('/api/auth', '/auth'),
      data: req.body,
      headers: req.headers
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Auth service error:', error);
    res.status(503).json({ error: 'Auth service unavailable' });
  }
});

// User service routes (requires authentication)
app.use('/api/users', authMiddleware.requireAuth, async (req, res, next) => {
  try {
    const headers = { ...req.headers };
    if (req.user) {
      headers['X-User-ID'] = req.user.userId;
    }
    
    const response = await userBreaker.fire({
      method: req.method,
      url: req.url.replace('/api/users', '/users'),
      data: req.body,
      headers
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('User service error:', error);
    res.status(503).json({ error: 'User service unavailable' });
  }
});

// Order service routes (requires authentication)
app.use('/api/orders', authMiddleware.requireAuth, async (req, res, next) => {
  try {
    const headers = { ...req.headers };
    if (req.user) {
      headers['X-User-ID'] = req.user.userId;
    }
    
    const response = await orderBreaker.fire({
      method: req.method,
      url: req.url.replace('/api/orders', '/orders'),
      data: req.body,
      headers
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Order service error:', error);
    res.status(503).json({ error: 'Order service unavailable' });
  }
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const circuitBreakerStatus = circuitBreakerManager.getStatus();
    const healthStatus = circuitBreakerManager.getHealthStatus();
    
    res.json({
      message: 'API Gateway is running',
      services: {
        'auth-service': circuitBreakerStatus['auth-service']?.state || 'unknown',
        'user-service': circuitBreakerStatus['user-service']?.state || 'unknown',
        'order-service': circuitBreakerStatus['order-service']?.state || 'unknown',
        'api-gateway': 'healthy'
      },
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      circuitBreaker: circuitBreakerStatus,
      health: healthStatus
    });
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DevOps E2E Platform API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      status: '/api/status',
      auth: '/api/auth/*',
      users: '/api/users/*',
      orders: '/api/orders/*'
    },
    documentation: '/docs',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(securityMiddleware.errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    requestId: req.headers['x-request-id']
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
  logger.info(`📊 Status: http://localhost:${PORT}/api/status`);
});

module.exports = app; 