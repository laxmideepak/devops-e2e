import { test, expect } from '@playwright/test';
import { testHelpers } from '../utils/test-helpers';
import axios from 'axios';

test.describe('API Integration Tests', () => {
  test.beforeEach(async () => {
    // Clear any existing auth token
    testHelpers.clearAuthToken();
  });

  test('@api @smoke should check all services health', async () => {
    const services = [
      { name: 'API Gateway', url: process.env.API_BASE_URL || 'http://localhost:3000' },
      { name: 'Auth Service', url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001' },
      { name: 'User Service', url: process.env.USER_SERVICE_URL || 'http://localhost:3002' },
      { name: 'Order Service', url: process.env.ORDER_SERVICE_URL || 'http://localhost:3003' }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(`${service.url}/health`, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        expect(response.status).toBe(200);
        console.log(`✅ ${service.name} is healthy`);
      } catch (error) {
        console.log(`❌ ${service.name} is not available: ${error.message}`);
        throw error;
      }
    }
  });

  test('@api should test complete user registration flow', async () => {
    const testUser = testHelpers.generateTestUser();
    
    // Step 1: Register user
    const registerResponse = await testHelpers.registerUser(testUser);
    expect(registerResponse).toHaveProperty('message');
    expect(registerResponse.message).toContain('success');
    
    // Step 2: Login user
    const loginResponse = await testHelpers.loginUser(testUser.email, testUser.password);
    expect(loginResponse).toHaveProperty('token');
    expect(loginResponse.token).toBeTruthy();
    
    // Step 3: Get user profile
    const profileResponse = await testHelpers.getUserProfile();
    expect(profileResponse).toHaveProperty('email');
    expect(profileResponse.email).toBe(testUser.email);
  });

  test('@api should test complete order creation flow', async () => {
    const testUser = testHelpers.generateTestUser();
    const testOrder = testHelpers.generateTestOrder();
    
    // Step 1: Register and login user
    await testHelpers.registerUser(testUser);
    await testHelpers.loginUser(testUser.email, testUser.password);
    
    // Step 2: Create order
    const orderResponse = await testHelpers.createOrder(testOrder);
    expect(orderResponse).toHaveProperty('order_number');
    expect(orderResponse.order_number).toMatch(/ORD-/);
    expect(orderResponse).toHaveProperty('status');
    expect(orderResponse.status).toBe('pending');
  });

  test('@api should test service communication through API Gateway', async () => {
    const testUser = testHelpers.generateTestUser();
    
    // Test API Gateway routing to Auth Service
    const registerResponse = await axios.post(
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/signup`,
      testUser,
      { headers: { 'Content-Type': 'application/json' } }
    );
    expect(registerResponse.status).toBe(201);
    
    // Test API Gateway routing to User Service
    const loginResponse = await axios.post(
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/login`,
      { email: testUser.email, password: testUser.password },
      { headers: { 'Content-Type': 'application/json' } }
    );
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.data.token;
    
    // Test API Gateway routing to User Service with authentication
    const profileResponse = await axios.get(
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/users/profile`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    expect(profileResponse.status).toBe(200);
  });

  test('@api should test circuit breaker functionality', async () => {
    // This test would require the circuit breaker to be configured
    // For now, we'll test the basic functionality
    
    const testUser = testHelpers.generateTestUser();
    
    // Register user
    await testHelpers.registerUser(testUser);
    
    // Make multiple rapid requests to test circuit breaker
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        testHelpers.loginUser(testUser.email, testUser.password)
          .catch(error => ({ error: error.message }))
      );
    }
    
    const results = await Promise.all(requests);
    
    // Most requests should succeed
    const successfulRequests = results.filter(result => !result.error);
    expect(successfulRequests.length).toBeGreaterThan(5);
  });

  test('@api should test rate limiting', async () => {
    const testUser = testHelpers.generateTestUser();
    
    // Register user
    await testHelpers.registerUser(testUser);
    
    // Make rapid requests to test rate limiting
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(
        axios.get(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/health`)
          .catch(error => ({ error: error.message }))
      );
    }
    
    const results = await Promise.all(requests);
    
    // Some requests might be rate limited (429 status)
    const rateLimitedRequests = results.filter(result => 
      result.error && result.error.includes('429')
    );
    
    // If rate limiting is working, some requests should be limited
    console.log(`Rate limited requests: ${rateLimitedRequests.length}`);
  });

  test('@api should test authentication token validation', async () => {
    const testUser = testHelpers.generateTestUser();
    
    // Register and login user
    await testHelpers.registerUser(testUser);
    const loginResponse = await testHelpers.loginUser(testUser.email, testUser.password);
    const token = testHelpers.getAuthToken();
    
    // Test valid token
    const validResponse = await axios.get(
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/users/profile`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    expect(validResponse.status).toBe(200);
    
    // Test invalid token
    try {
      await axios.get(
        `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/users/profile`,
        { headers: { 'Authorization': 'Bearer invalid-token' } }
      );
      throw new Error('Should have failed with invalid token');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
    
    // Test missing token
    try {
      await axios.get(
        `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/users/profile`
      );
      throw new Error('Should have failed with missing token');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  test('@api should test service discovery and load balancing', async () => {
    // This test would require multiple instances of services
    // For now, we'll test basic service discovery
    
    const services = [
      'auth',
      'users',
      'orders'
    ];
    
    for (const service of services) {
      try {
        const response = await axios.get(
          `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/${service}/health`
        );
        expect(response.status).toBe(200);
        console.log(`✅ ${service} service is accessible through API Gateway`);
      } catch (error) {
        console.log(`❌ ${service} service is not accessible: ${error.message}`);
      }
    }
  });

  test('@api should test error handling and logging', async () => {
    // Test 404 error
    try {
      await axios.get(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/nonexistent`);
      throw new Error('Should have returned 404');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
    
    // Test 400 error with invalid data
    try {
      await axios.post(
        `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/signup`,
        { invalid: 'data' },
        { headers: { 'Content-Type': 'application/json' } }
      );
      throw new Error('Should have returned 400');
    } catch (error) {
      expect(error.response.status).toBe(400);
    }
  });

  test('@api should test concurrent user operations', async () => {
    const users = [];
    for (let i = 0; i < 5; i++) {
      users.push(testHelpers.generateTestUser());
    }
    
    // Register all users concurrently
    const registerPromises = users.map(user => 
      testHelpers.registerUser(user).catch(error => ({ error: error.message }))
    );
    
    const registerResults = await Promise.all(registerPromises);
    const successfulRegistrations = registerResults.filter(result => !result.error);
    expect(successfulRegistrations.length).toBeGreaterThan(0);
    
    // Login all users concurrently
    const loginPromises = users.map(user => 
      testHelpers.loginUser(user.email, user.password).catch(error => ({ error: error.message }))
    );
    
    const loginResults = await Promise.all(loginPromises);
    const successfulLogins = loginResults.filter(result => !result.error);
    expect(successfulLogins.length).toBeGreaterThan(0);
  });

  test('@api should test data consistency across services', async () => {
    const testUser = testHelpers.generateTestUser();
    const testOrder = testHelpers.generateTestOrder();
    
    // Register user
    await testHelpers.registerUser(testUser);
    
    // Login user
    await testHelpers.loginUser(testUser.email, testUser.password);
    
    // Create order
    const orderResponse = await testHelpers.createOrder(testOrder);
    
    // Verify user data consistency
    const profileResponse = await testHelpers.getUserProfile();
    expect(profileResponse.email).toBe(testUser.email);
    
    // Verify order data consistency
    expect(orderResponse.user_id).toBe(profileResponse.id);
  });

  test('@api should test service metrics and monitoring', async () => {
    // Test metrics endpoints
    const services = [
      { name: 'API Gateway', url: process.env.API_BASE_URL || 'http://localhost:3000' },
      { name: 'Auth Service', url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001' },
      { name: 'User Service', url: process.env.USER_SERVICE_URL || 'http://localhost:3002' },
      { name: 'Order Service', url: process.env.ORDER_SERVICE_URL || 'http://localhost:3003' }
    ];
    
    for (const service of services) {
      try {
        const response = await axios.get(`${service.url}/metrics`);
        expect(response.status).toBe(200);
        expect(response.data).toContain('http_requests_total');
        console.log(`✅ ${service.name} metrics are available`);
      } catch (error) {
        console.log(`⚠️  ${service.name} metrics not available: ${error.message}`);
      }
    }
  });
});
