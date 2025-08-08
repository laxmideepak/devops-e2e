import { Page, expect } from '@playwright/test';
import axios from 'axios';
import { faker } from '@faker-js/faker';

/**
 * Test helper utilities for common operations
 */
export class TestHelpers {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate test user data
   */
  generateTestUser() {
    return {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName()
    };
  }

  /**
   * Generate test order data
   */
  generateTestOrder() {
    return {
      items: [
        {
          product_id: faker.number.int({ min: 1, max: 100 }),
          name: faker.commerce.productName(),
          quantity: faker.number.int({ min: 1, max: 5 }),
          price: parseFloat(faker.commerce.price({ min: 10, max: 1000 }))
        }
      ],
      shipping_address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zip: faker.location.zipCode()
      },
      billing_address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zip: faker.location.zipCode()
      }
    };
  }

  /**
   * Register a new user via API
   */
  async registerUser(userData: any) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/signup`, userData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('User registration failed:', error.message);
      throw error;
    }
  }

  /**
   * Login user via API
   */
  async loginUser(email: string, password: string) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email,
        password
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      this.authToken = response.data.token;
      return response.data;
    } catch (error) {
      console.error('User login failed:', error.message);
      throw error;
    }
  }

  /**
   * Create an order via API
   */
  async createOrder(orderData: any) {
    if (!this.authToken) {
      throw new Error('User must be logged in to create an order');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/orders`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Order creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get user profile via API
   */
  async getUserProfile() {
    if (!this.authToken) {
      throw new Error('User must be logged in to get profile');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Get user profile failed:', error.message);
      throw error;
    }
  }

  /**
   * Wait for page to be ready
   */
  async waitForPageReady(page: Page) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Additional wait for any animations
  }

  /**
   * Fill form fields
   */
  async fillForm(page: Page, formData: Record<string, string>) {
    for (const [selector, value] of Object.entries(formData)) {
      await page.fill(selector, value);
    }
  }

  /**
   * Submit form and wait for response
   */
  async submitForm(page: Page, submitSelector: string) {
    await page.click(submitSelector);
    await page.waitForLoadState('networkidle');
  }

  /**
   * Assert API response
   */
  async assertApiResponse(response: any, expectedStatus: number = 200) {
    expect(response.status).toBe(expectedStatus);
  }

  /**
   * Assert page contains text
   */
  async assertPageContains(page: Page, text: string) {
    await expect(page).toContainText(text);
  }

  /**
   * Assert element is visible
   */
  async assertElementVisible(page: Page, selector: string) {
    await expect(page.locator(selector)).toBeVisible();
  }

  /**
   * Assert element is not visible
   */
  async assertElementNotVisible(page: Page, selector: string) {
    await expect(page.locator(selector)).not.toBeVisible();
  }

  /**
   * Take screenshot on failure
   */
  async takeScreenshot(page: Page, name: string) {
    await page.screenshot({ path: `test-results/${name}.png` });
  }

  /**
   * Wait for API call to complete
   */
  async waitForApiCall(page: Page, urlPattern: string) {
    await page.waitForResponse(response => 
      response.url().includes(urlPattern) && response.status() < 400
    );
  }

  /**
   * Get auth token
   */
  getAuthToken() {
    return this.authToken;
  }

  /**
   * Clear auth token
   */
  clearAuthToken() {
    this.authToken = null;
  }
}

/**
 * Create test helper instance
 */
export const testHelpers = new TestHelpers();
