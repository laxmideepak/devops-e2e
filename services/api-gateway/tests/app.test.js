const request = require('supertest');
const app = require('../src/index');

// Mock external dependencies
jest.mock('../src/utils/circuitBreaker', () => ({
  createHttpBreaker: jest.fn(() => ({
    fire: jest.fn().mockRejectedValue(new Error('Service unavailable'))
  })),
  getStatus: jest.fn(() => ({
    'auth-service': { state: 'CLOSED', stats: {} },
    'user-service': { state: 'CLOSED', stats: {} },
    'order-service': { state: 'CLOSED', stats: {} }
  })),
  getHealthStatus: jest.fn(() => ({
    overall: 'healthy',
    services: {
      'auth-service': { state: 'CLOSED', healthy: true },
      'user-service': { state: 'CLOSED', healthy: true },
      'order-service': { state: 'CLOSED', healthy: true }
    }
  }))
}));

jest.mock('../src/utils/serviceDiscovery', () => ({
  startHealthChecks: jest.fn(),
  getServiceHealth: jest.fn(() => 'healthy')
}));

describe('API Gateway', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'api-gateway');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Readiness Check', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(503); // Will fail because services aren't running

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service', 'api-gateway');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('API Status', () => {
    it('should return API status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('circuitBreaker');
      expect(response.body).toHaveProperty('health');
    });
  });

  describe('Root Endpoint', () => {
    it('should return welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication Routes', () => {
    it('should handle auth requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(503); // Service unavailable in test environment

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Protected Routes', () => {
    it('should require authentication for user routes', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should require authentication for order routes', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
    });
  });
}); 