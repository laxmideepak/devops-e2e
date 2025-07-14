const request = require('supertest');
const app = require('../src/index');

describe('API Gateway', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('api-gateway');
      expect(res.body.version).toBe('1.0.0');
    });
  });

  describe('GET /ready', () => {
    it('should return ready status', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.service).toBe('api-gateway');
    });
  });

  describe('GET /api/status', () => {
    it('should return API status', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('API Gateway is running');
      expect(res.body.services).toBeDefined();
      expect(res.body.version).toBe('1.0.0');
    });
  });

  describe('GET /', () => {
    it('should return welcome message', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Welcome to DevOps E2E Platform API Gateway');
      expect(res.body.endpoints).toBeDefined();
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for non-existent routes', async () => {
      const res = await request(app).get('/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
}); 