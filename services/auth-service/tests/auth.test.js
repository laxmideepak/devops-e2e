const request = require('supertest');
const app = require('../src/index');

describe('Auth Service', () => {
  describe('POST /auth/signup', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('firstName', userData.firstName);
      expect(response.body.user).toHaveProperty('lastName', userData.lastName);
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
    });

    it('should return 400 for weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 409 for existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'TestPassword123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // First signup
      await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      // Second signup with same email
      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'User already exists');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const userData = {
        email: 'login@example.com',
        password: 'TestPassword123',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      // Create user first
      await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      // Login
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'TestPassword123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const userData = {
        email: 'refresh@example.com',
        password: 'TestPassword123',
        firstName: 'Refresh',
        lastName: 'User'
      };

      // Create user and get tokens
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      const refreshToken = signupResponse.body.tokens.refreshToken;

      // Refresh tokens
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Tokens refreshed successfully');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Refresh token is required');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid refresh token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid refresh token', async () => {
      const userData = {
        email: 'logout@example.com',
        password: 'TestPassword123',
        firstName: 'Logout',
        lastName: 'User'
      };

      // Create user and get tokens
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      const refreshToken = signupResponse.body.tokens.refreshToken;

      // Logout
      const response = await request(app)
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logout successful');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Refresh token is required');
    });
  });

  describe('POST /auth/verify', () => {
    it('should verify valid access token', async () => {
      const userData = {
        email: 'verify@example.com',
        password: 'TestPassword123',
        firstName: 'Verify',
        lastName: 'User'
      };

      // Create user and get tokens
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      const accessToken = signupResponse.body.tokens.accessToken;

      // Verify token
      const response = await request(app)
        .post('/auth/verify')
        .send({ token: accessToken })
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', userData.email);
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Token is required');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'auth-service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});
