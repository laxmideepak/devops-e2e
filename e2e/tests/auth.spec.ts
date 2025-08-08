import { test, expect } from '@playwright/test';
import { testHelpers } from '../utils/test-helpers';

test.describe('Authentication Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await testHelpers.waitForPageReady(page);
  });

  test('@smoke @auth should display login form', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Assert login form elements are visible
    await testHelpers.assertElementVisible(page, '[data-testid="login-form"]');
    await testHelpers.assertElementVisible(page, '[data-testid="email-input"]');
    await testHelpers.assertElementVisible(page, '[data-testid="password-input"]');
    await testHelpers.assertElementVisible(page, '[data-testid="login-button"]');
  });

  test('@auth should register new user successfully', async ({ page }) => {
    const testUser = testHelpers.generateTestUser();
    
    // Navigate to registration page
    await page.goto('/register');
    
    // Fill registration form
    await testHelpers.fillForm(page, {
      '[data-testid="email-input"]': testUser.email,
      '[data-testid="password-input"]': testUser.password,
      '[data-testid="confirm-password-input"]': testUser.password,
      '[data-testid="first-name-input"]': testUser.firstName,
      '[data-testid="last-name-input"]': testUser.lastName
    });
    
    // Submit form
    await testHelpers.submitForm(page, '[data-testid="register-button"]');
    
    // Wait for registration to complete
    await testHelpers.waitForApiCall(page, '/api/auth/signup');
    
    // Assert success message
    await testHelpers.assertPageContains(page, 'Registration successful');
    
    // Verify user is redirected to login or dashboard
    await expect(page).toHaveURL(/.*(login|dashboard)/);
  });

  test('@auth should login user successfully', async ({ page }) => {
    const testUser = testHelpers.generateTestUser();
    
    // First register the user
    await testHelpers.registerUser(testUser);
    
    // Navigate to login page
    await page.goto('/login');
    
    // Fill login form
    await testHelpers.fillForm(page, {
      '[data-testid="email-input"]': testUser.email,
      '[data-testid="password-input"]': testUser.password
    });
    
    // Submit form
    await testHelpers.submitForm(page, '[data-testid="login-button"]');
    
    // Wait for login to complete
    await testHelpers.waitForApiCall(page, '/api/auth/login');
    
    // Assert successful login
    await testHelpers.assertPageContains(page, 'Welcome');
    
    // Verify user is redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('@auth should show error for invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Fill login form with invalid credentials
    await testHelpers.fillForm(page, {
      '[data-testid="email-input"]': 'invalid@example.com',
      '[data-testid="password-input"]': 'wrongpassword'
    });
    
    // Submit form
    await testHelpers.submitForm(page, '[data-testid="login-button"]');
    
    // Wait for error response
    await testHelpers.waitForApiCall(page, '/api/auth/login');
    
    // Assert error message
    await testHelpers.assertPageContains(page, 'Invalid credentials');
  });

  test('@auth should validate form fields', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');
    
    // Try to submit empty form
    await testHelpers.submitForm(page, '[data-testid="register-button"]');
    
    // Assert validation errors
    await testHelpers.assertPageContains(page, 'Email is required');
    await testHelpers.assertPageContains(page, 'Password is required');
    
    // Fill invalid email
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await testHelpers.submitForm(page, '[data-testid="register-button"]');
    
    // Assert email validation error
    await testHelpers.assertPageContains(page, 'Invalid email format');
    
    // Fill weak password
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'weak');
    await testHelpers.submitForm(page, '[data-testid="register-button"]');
    
    // Assert password validation error
    await testHelpers.assertPageContains(page, 'Password must be at least 8 characters');
  });

  test('@auth should logout user successfully', async ({ page }) => {
    const testUser = testHelpers.generateTestUser();
    
    // Register and login user
    await testHelpers.registerUser(testUser);
    await testHelpers.loginUser(testUser.email, testUser.password);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Click logout button
    await page.click('[data-testid="logout-button"]');
    
    // Wait for logout to complete
    await testHelpers.waitForApiCall(page, '/api/auth/logout');
    
    // Assert user is logged out
    await testHelpers.assertPageContains(page, 'Login');
    
    // Verify user is redirected to login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('@auth should handle password reset flow', async ({ page }) => {
    // Navigate to password reset page
    await page.goto('/forgot-password');
    
    // Fill email for password reset
    await testHelpers.fillForm(page, {
      '[data-testid="email-input"]': 'test@example.com'
    });
    
    // Submit password reset request
    await testHelpers.submitForm(page, '[data-testid="reset-password-button"]');
    
    // Wait for password reset request
    await testHelpers.waitForApiCall(page, '/api/auth/forgot-password');
    
    // Assert success message
    await testHelpers.assertPageContains(page, 'Password reset email sent');
  });

  test('@auth should refresh token automatically', async ({ page }) => {
    const testUser = testHelpers.generateTestUser();
    
    // Register and login user
    await testHelpers.registerUser(testUser);
    await testHelpers.loginUser(testUser.email, testUser.password);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Simulate token expiration by waiting
    await page.waitForTimeout(5000);
    
    // Try to access protected resource
    await page.goto('/profile');
    
    // Assert user is still logged in (token was refreshed)
    await testHelpers.assertPageContains(page, 'Profile');
  });

  test('@auth should handle concurrent login attempts', async ({ page, context }) => {
    const testUser = testHelpers.generateTestUser();
    
    // Register user
    await testHelpers.registerUser(testUser);
    
    // Create multiple browser contexts
    const context1 = await context.browser()?.newContext();
    const context2 = await context.browser()?.newContext();
    
    if (!context1 || !context2) {
      test.skip('Could not create multiple contexts');
      return;
    }
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Login on first page
    await page1.goto('/login');
    await testHelpers.fillForm(page1, {
      '[data-testid="email-input"]': testUser.email,
      '[data-testid="password-input"]': testUser.password
    });
    await testHelpers.submitForm(page1, '[data-testid="login-button"]');
    
    // Login on second page
    await page2.goto('/login');
    await testHelpers.fillForm(page2, {
      '[data-testid="email-input"]': testUser.email,
      '[data-testid="password-input"]': testUser.password
    });
    await testHelpers.submitForm(page2, '[data-testid="login-button"]');
    
    // Both should be successful
    await testHelpers.assertPageContains(page1, 'Welcome');
    await testHelpers.assertPageContains(page2, 'Welcome');
    
    await context1.close();
    await context2.close();
  });

  test('@auth should validate password strength', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');
    
    // Test weak password
    await testHelpers.fillForm(page, {
      '[data-testid="email-input"]': 'test@example.com',
      '[data-testid="password-input"]': 'weak',
      '[data-testid="confirm-password-input"]': 'weak'
    });
    
    await testHelpers.submitForm(page, '[data-testid="register-button"]');
    await testHelpers.assertPageContains(page, 'Password is too weak');
    
    // Test strong password
    await testHelpers.fillForm(page, {
      '[data-testid="password-input"]': 'StrongPassword123!',
      '[data-testid="confirm-password-input"]': 'StrongPassword123!'
    });
    
    await testHelpers.submitForm(page, '[data-testid="register-button"]');
    // Should not show password strength error
    await expect(page.locator('text=Password is too weak')).not.toBeVisible();
  });

  test('@auth should handle session timeout', async ({ page }) => {
    const testUser = testHelpers.generateTestUser();
    
    // Register and login user
    await testHelpers.registerUser(testUser);
    await testHelpers.loginUser(testUser.email, testUser.password);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Simulate session timeout (this would require backend configuration)
    // For now, we'll just test the UI behavior
    await page.evaluate(() => {
      // Simulate token expiration
      localStorage.removeItem('token');
    });
    
    // Try to access protected resource
    await page.goto('/profile');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*login/);
  });
});
