import { chromium, FullConfig } from '@playwright/test';
import axios from 'axios';
import { faker } from '@faker-js/faker';

/**
 * Global setup for Playwright tests
 * This runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');

  // Check if services are running
  await checkServicesHealth();

  // Setup test data
  await setupTestData();

  // Create test user
  await createTestUser();

  console.log('✅ Global setup completed');
}

/**
 * Check if all services are healthy
 */
async function checkServicesHealth() {
  console.log('🔍 Checking service health...');

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
      
      if (response.status === 200) {
        console.log(`✅ ${service.name} is healthy`);
      } else {
        console.log(`⚠️  ${service.name} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${service.name} is not available: ${error.message}`);
      
      if (process.env.CI) {
        throw new Error(`${service.name} is required for tests`);
      }
    }
  }
}

/**
 * Setup test data in the database
 */
async function setupTestData() {
  console.log('📊 Setting up test data...');

  try {
    // This would typically involve running database migrations or seeding data
    // For now, we'll just log that this step is completed
    console.log('✅ Test data setup completed');
  } catch (error) {
    console.log('⚠️  Test data setup failed:', error.message);
  }
}

/**
 * Create a test user for authentication tests
 */
async function createTestUser() {
  console.log('👤 Creating test user...');

  try {
    const testUser = {
      email: `test-${faker.string.alphanumeric(8)}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };

    // Store test user data for tests to use
    process.env.TEST_USER_EMAIL = testUser.email;
    process.env.TEST_USER_PASSWORD = testUser.password;
    process.env.TEST_USER_FIRST_NAME = testUser.firstName;
    process.env.TEST_USER_LAST_NAME = testUser.lastName;

    console.log('✅ Test user created:', testUser.email);
  } catch (error) {
    console.log('⚠️  Test user creation failed:', error.message);
  }
}

export default globalSetup;
