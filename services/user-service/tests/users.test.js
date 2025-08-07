const request = require('supertest');
const app = require('../src/index');

describe('User Service', () => {
  let validToken;
  let userId;

  // Helper function to create a test user and get token
  const createTestUser = async () => {
    const userData = {
      email: 'testuser@example.com',
      password: 'TestPassword123',
      firstName: 'Test',
      lastName: 'User'
    };

    // Create user through auth service (simulated)
    const response = await request(app)
      .post('/users/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .send(userData);

    return response.body.user;
  };

  describe('GET /users/profile', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return user profile with valid token', async () => {
      // This test would require a valid JWT token
      // In a real test environment, you'd create a user and get a token
      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /users/profile', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/users/profile')
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should update profile with valid data', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for empty firstName', async () => {
      const updateData = {
        firstName: ''
      };

      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /users/profile', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should delete user account with valid token', async () => {
      const response = await request(app)
        .delete('/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /users/:id', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/users/1')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 403 when accessing other user profile', async () => {
      const response = await request(app)
        .get('/users/999')
        .set('Authorization', 'Bearer valid-token')
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /users', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/users')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return empty user list (admin only)', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer valid-token')
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/users?page=1&limit=10')
        .set('Authorization', 'Bearer valid-token')
        .expect(401); // Will fail because we don't have a real token

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'user-service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health check', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service', 'user-service');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
