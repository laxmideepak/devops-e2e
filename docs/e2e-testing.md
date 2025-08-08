# End-to-End Testing

This document describes the end-to-end testing setup for the DevOps E2E Platform using Playwright.

## Overview

The platform uses [Playwright](https://playwright.dev/) for comprehensive end-to-end testing. Playwright provides:

- **Cross-browser testing**: Chrome, Firefox, Safari
- **Mobile testing**: Responsive design validation
- **API testing**: Service integration validation
- **Visual testing**: Screenshot and video capture
- **Performance testing**: Load time and resource usage
- **Parallel execution**: Fast test execution

## Test Structure

```
e2e/
├── playwright.config.ts      # Playwright configuration
├── package.json              # Dependencies and scripts
├── tests/                    # Test files
│   ├── auth.spec.ts         # Authentication tests
│   ├── orders.spec.ts       # Order management tests
│   └── api-integration.spec.ts # API integration tests
├── utils/                    # Test utilities
│   ├── global-setup.ts      # Global test setup
│   ├── global-teardown.ts   # Global test cleanup
│   └── test-helpers.ts      # Common test utilities
└── fixtures/                 # Test data and fixtures
```

## Test Categories

### 1. Authentication Tests (`auth.spec.ts`)

Tests user registration, login, logout, and authentication flows:

- **User Registration**: Form validation, password strength, email verification
- **User Login**: Credential validation, error handling, session management
- **Password Reset**: Forgot password flow, email notifications
- **Session Management**: Token refresh, session timeout, concurrent logins
- **Security**: Password strength validation, brute force protection

### 2. Order Management Tests (`orders.spec.ts`)

Tests order creation, management, and processing:

- **Order Creation**: Form validation, item management, address handling
- **Order Management**: Status updates, cancellation, bulk operations
- **Order Search**: Filtering, pagination, export functionality
- **Order Validation**: Permission checks, data consistency
- **Order Notifications**: Status change notifications, alerts

### 3. API Integration Tests (`api-integration.spec.ts`)

Tests service communication and integration:

- **Service Health**: Health check endpoints, service availability
- **API Communication**: Gateway routing, service discovery
- **Authentication**: Token validation, permission checks
- **Error Handling**: Error responses, logging, monitoring
- **Performance**: Rate limiting, circuit breaker functionality

## Test Tags

Tests are categorized using tags for selective execution:

- `@smoke`: Critical path tests for quick validation
- `@auth`: Authentication-related tests
- `@orders`: Order management tests
- `@api`: API integration tests
- `@performance`: Performance and load tests
- `@regression`: Comprehensive regression tests

## Running Tests

### Prerequisites

1. **Install Node.js 18+**
2. **Install dependencies**:
   ```bash
   cd e2e
   npm install
   npx playwright install
   ```

3. **Start services**:
   ```bash
   docker-compose -f infrastructure/docker-compose/docker-compose.yml up -d
   ```

### Local Development

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:smoke
npm run test:auth
npm run test:orders
npm run test:api

# Run with UI mode
npm run test:ui

# Run in debug mode
npm run test:debug

# Run with headed browsers
npm run test:headed
```

### CI/CD Execution

Tests are automatically run in GitHub Actions:

- **On push/PR**: Full test suite
- **Manual trigger**: Selective test execution
- **Parallel execution**: Multiple browsers and test suites
- **Artifact collection**: Screenshots, videos, reports

## Test Configuration

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
```

### Environment Variables

```bash
# Service URLs
API_BASE_URL=http://localhost:3000
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
ORDER_SERVICE_URL=http://localhost:3003

# Test Configuration
CI=true
BASE_URL=http://localhost:3000
```

## Test Utilities

### Test Helpers

```typescript
// utils/test-helpers.ts
export class TestHelpers {
  generateTestUser() // Generate fake user data
  generateTestOrder() // Generate fake order data
  registerUser(userData) // Register user via API
  loginUser(email, password) // Login user via API
  createOrder(orderData) // Create order via API
  assertPageContains(page, text) // Assert page content
  assertElementVisible(page, selector) // Assert element visibility
}
```

### Global Setup/Teardown

```typescript
// utils/global-setup.ts
async function globalSetup() {
  await checkServicesHealth() // Verify all services are running
  await setupTestData() // Initialize test data
  await createTestUser() // Create test user for authentication
}

// utils/global-teardown.ts
async function globalTeardown() {
  await cleanupTestData() // Clean up test data
  await generateTestReport() // Generate test summary
}
```

## Test Data Management

### Test User Creation

```typescript
const testUser = testHelpers.generateTestUser();
// {
//   email: 'test-abc123@example.com',
//   password: 'TestPassword123!',
//   firstName: 'John',
//   lastName: 'Doe'
// }
```

### Test Order Creation

```typescript
const testOrder = testHelpers.generateTestOrder();
// {
//   items: [{ product_id: 1, name: 'Product', quantity: 2, price: 25.99 }],
//   shipping_address: { street: '123 Main St', city: 'Anytown', ... },
//   billing_address: { street: '123 Main St', city: 'Anytown', ... }
// }
```

## Test Patterns

### Page Object Model

```typescript
// Example test structure
test('should login user successfully', async ({ page }) => {
  // Arrange
  const testUser = testHelpers.generateTestUser();
  await testHelpers.registerUser(testUser);
  
  // Act
  await page.goto('/login');
  await testHelpers.fillForm(page, {
    '[data-testid="email-input"]': testUser.email,
    '[data-testid="password-input"]': testUser.password
  });
  await testHelpers.submitForm(page, '[data-testid="login-button"]');
  
  // Assert
  await testHelpers.assertPageContains(page, 'Welcome');
  await expect(page).toHaveURL(/.*dashboard/);
});
```

### API Testing

```typescript
test('should test complete user registration flow', async () => {
  const testUser = testHelpers.generateTestUser();
  
  // Step 1: Register user
  const registerResponse = await testHelpers.registerUser(testUser);
  expect(registerResponse).toHaveProperty('message');
  
  // Step 2: Login user
  const loginResponse = await testHelpers.loginUser(testUser.email, testUser.password);
  expect(loginResponse).toHaveProperty('token');
  
  // Step 3: Get user profile
  const profileResponse = await testHelpers.getUserProfile();
  expect(profileResponse.email).toBe(testUser.email);
});
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on:
  push:
    branches: [main, develop]
    paths: ['e2e/**', 'services/**']
  pull_request:
    branches: [main, develop]
    paths: ['e2e/**', 'services/**']
  workflow_dispatch:
    inputs:
      test_type:
        description: 'Type of tests to run'
        required: true
        default: 'all'
        type: choice
        options: [all, smoke, auth, orders, api]
```

### Workflow Jobs

1. **Setup Services**: Start Docker containers
2. **Install Dependencies**: Install Playwright and browsers
3. **Run E2E Tests**: Execute tests across browsers
4. **Run Parallel Tests**: Execute test suites in parallel
5. **Performance Tests**: Run performance monitoring
6. **Generate Report**: Combine test results
7. **Notify Results**: Report test outcomes
8. **Cleanup**: Stop services and clean artifacts

## Test Reports

### HTML Reports

```bash
# Generate HTML report
npx playwright show-report

# Open report in browser
npm run test:report
```

### JUnit Reports

```bash
# Generate JUnit XML report
npx playwright test --reporter=junit

# Upload to CI/CD system
# Available in test-results/results.xml
```

### Screenshots and Videos

- **Screenshots**: Captured on test failure
- **Videos**: Recorded for failed tests
- **Traces**: Detailed execution traces
- **Artifacts**: Uploaded to GitHub Actions

## Best Practices

### Test Organization

1. **Group related tests**: Use `test.describe()` blocks
2. **Use descriptive names**: Clear test descriptions
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests independent**: No test dependencies
5. **Use data attributes**: `data-testid` for selectors

### Test Data Management

1. **Generate unique data**: Use faker for test data
2. **Clean up after tests**: Remove test data
3. **Use test fixtures**: Reusable test data
4. **Isolate test data**: No shared state between tests

### Error Handling

1. **Handle async operations**: Proper await usage
2. **Validate responses**: Check API response status
3. **Handle timeouts**: Set appropriate timeouts
4. **Log errors**: Detailed error information

### Performance Considerations

1. **Parallel execution**: Run tests in parallel
2. **Browser reuse**: Reuse browser instances
3. **Resource cleanup**: Clean up after tests
4. **Optimize selectors**: Use efficient selectors

## Troubleshooting

### Common Issues

1. **Service not available**:
   ```bash
   # Check service health
   curl http://localhost:3000/health
   curl http://localhost:3001/health
   curl http://localhost:3002/health
   curl http://localhost:3003/health
   ```

2. **Database connection issues**:
   ```bash
   # Run migrations
   ./infrastructure/migrations/scripts/manage-migrations.sh up
   ```

3. **Browser installation issues**:
   ```bash
   # Reinstall browsers
   npx playwright install
   ```

4. **Test timeout issues**:
   ```bash
   # Increase timeout
   npx playwright test --timeout=60000
   ```

### Debug Commands

```bash
# Run tests in debug mode
npx playwright test --debug

# Run specific test
npx playwright test auth.spec.ts

# Show test trace
npx playwright show-trace trace.zip

# Generate test code
npx playwright codegen http://localhost:3000
```

## Monitoring and Metrics

### Test Metrics

- **Test execution time**: Performance tracking
- **Success/failure rates**: Reliability metrics
- **Browser compatibility**: Cross-browser testing
- **API response times**: Service performance

### Alerts and Notifications

- **Test failure alerts**: Immediate notification
- **Performance degradation**: Response time monitoring
- **Service availability**: Health check monitoring
- **Test coverage**: Coverage reporting

## References

- [Playwright Documentation](https://playwright.dev/docs/)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Playwright Configuration](https://playwright.dev/docs/test-configuration)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Docker Compose](https://docs.docker.com/compose/)
