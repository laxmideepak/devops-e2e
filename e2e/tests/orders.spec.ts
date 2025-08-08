import { test, expect } from '@playwright/test';
import { testHelpers } from '../utils/test-helpers';

test.describe('Order Management Tests', () => {
  let testUser: any;
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create test user and login
    testUser = testHelpers.generateTestUser();
    await testHelpers.registerUser(testUser);
    const loginResponse = await testHelpers.loginUser(testUser.email, testUser.password);
    authToken = testHelpers.getAuthToken();
    
    // Navigate to the application
    await page.goto('/');
    await testHelpers.waitForPageReady(page);
  });

  test('@smoke @orders should display order creation form', async ({ page }) => {
    // Navigate to order creation page
    await page.goto('/orders/new');
    
    // Assert order form elements are visible
    await testHelpers.assertElementVisible(page, '[data-testid="order-form"]');
    await testHelpers.assertElementVisible(page, '[data-testid="shipping-address"]');
    await testHelpers.assertElementVisible(page, '[data-testid="billing-address"]');
    await testHelpers.assertElementVisible(page, '[data-testid="create-order-button"]');
  });

  test('@orders should create new order successfully', async ({ page }) => {
    const testOrder = testHelpers.generateTestOrder();
    
    // Navigate to order creation page
    await page.goto('/orders/new');
    
    // Fill order form
    await testHelpers.fillForm(page, {
      '[data-testid="shipping-street"]': testOrder.shipping_address.street,
      '[data-testid="shipping-city"]': testOrder.shipping_address.city,
      '[data-testid="shipping-state"]': testOrder.shipping_address.state,
      '[data-testid="shipping-zip"]': testOrder.shipping_address.zip,
      '[data-testid="billing-street"]': testOrder.billing_address.street,
      '[data-testid="billing-city"]': testOrder.billing_address.city,
      '[data-testid="billing-state"]': testOrder.billing_address.state,
      '[data-testid="billing-zip"]': testOrder.billing_address.zip
    });
    
    // Add items to order
    for (let i = 0; i < testOrder.items.length; i++) {
      const item = testOrder.items[i];
      await page.click('[data-testid="add-item-button"]');
      await testHelpers.fillForm(page, {
        `[data-testid="item-name-${i}"]`: item.name,
        `[data-testid="item-quantity-${i}"]`: item.quantity.toString(),
        `[data-testid="item-price-${i}"]`: item.price.toString()
      });
    }
    
    // Submit order
    await testHelpers.submitForm(page, '[data-testid="create-order-button"]');
    
    // Wait for order creation to complete
    await testHelpers.waitForApiCall(page, '/api/orders');
    
    // Assert success message
    await testHelpers.assertPageContains(page, 'Order created successfully');
    
    // Verify order number is displayed
    await testHelpers.assertPageContains(page, 'ORD-');
  });

  test('@orders should display order list', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    await testHelpers.createOrder(testOrder);
    
    // Navigate to orders list
    await page.goto('/orders');
    
    // Assert orders list is visible
    await testHelpers.assertElementVisible(page, '[data-testid="orders-list"]');
    
    // Assert order details are displayed
    await testHelpers.assertPageContains(page, 'ORD-');
    await testHelpers.assertPageContains(page, testOrder.items[0].name);
  });

  test('@orders should view order details', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    const orderResponse = await testHelpers.createOrder(testOrder);
    
    // Navigate to order details
    await page.goto(`/orders/${orderResponse.order_number}`);
    
    // Assert order details are visible
    await testHelpers.assertElementVisible(page, '[data-testid="order-details"]');
    await testHelpers.assertElementVisible(page, '[data-testid="order-status"]');
    await testHelpers.assertElementVisible(page, '[data-testid="order-items"]');
    await testHelpers.assertElementVisible(page, '[data-testid="order-total"]');
    
    // Assert order information is correct
    await testHelpers.assertPageContains(page, orderResponse.order_number);
    await testHelpers.assertPageContains(page, testOrder.items[0].name);
  });

  test('@orders should update order status', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    const orderResponse = await testHelpers.createOrder(testOrder);
    
    // Navigate to order details
    await page.goto(`/orders/${orderResponse.order_number}`);
    
    // Click update status button
    await page.click('[data-testid="update-status-button"]');
    
    // Select new status
    await page.selectOption('[data-testid="status-select"]', 'processing');
    
    // Submit status update
    await testHelpers.submitForm(page, '[data-testid="save-status-button"]');
    
    // Wait for status update
    await testHelpers.waitForApiCall(page, `/api/orders/${orderResponse.order_number}`);
    
    // Assert status is updated
    await testHelpers.assertPageContains(page, 'Processing');
  });

  test('@orders should cancel order', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    const orderResponse = await testHelpers.createOrder(testOrder);
    
    // Navigate to order details
    await page.goto(`/orders/${orderResponse.order_number}`);
    
    // Click cancel order button
    await page.click('[data-testid="cancel-order-button"]');
    
    // Confirm cancellation
    await page.click('[data-testid="confirm-cancel-button"]');
    
    // Wait for cancellation to complete
    await testHelpers.waitForApiCall(page, `/api/orders/${orderResponse.order_number}/cancel`);
    
    // Assert order is cancelled
    await testHelpers.assertPageContains(page, 'Cancelled');
  });

  test('@orders should validate order form', async ({ page }) => {
    // Navigate to order creation page
    await page.goto('/orders/new');
    
    // Try to submit empty form
    await testHelpers.submitForm(page, '[data-testid="create-order-button"]');
    
    // Assert validation errors
    await testHelpers.assertPageContains(page, 'Shipping address is required');
    await testHelpers.assertPageContains(page, 'At least one item is required');
    
    // Fill invalid shipping address
    await testHelpers.fillForm(page, {
      '[data-testid="shipping-street"]': '',
      '[data-testid="shipping-city"]': '',
      '[data-testid="shipping-state"]': '',
      '[data-testid="shipping-zip"]': 'invalid-zip'
    });
    
    await testHelpers.submitForm(page, '[data-testid="create-order-button"]');
    
    // Assert address validation errors
    await testHelpers.assertPageContains(page, 'Street address is required');
    await testHelpers.assertPageContains(page, 'City is required');
    await testHelpers.assertPageContains(page, 'Valid ZIP code is required');
  });

  test('@orders should calculate order total correctly', async ({ page }) => {
    // Navigate to order creation page
    await page.goto('/orders/new');
    
    // Add items to order
    const items = [
      { name: 'Product 1', quantity: 2, price: 10.00 },
      { name: 'Product 2', quantity: 1, price: 25.50 }
    ];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await page.click('[data-testid="add-item-button"]');
      await testHelpers.fillForm(page, {
        `[data-testid="item-name-${i}"]`: item.name,
        `[data-testid="item-quantity-${i}"]`: item.quantity.toString(),
        `[data-testid="item-price-${i}"]`: item.price.toString()
      });
    }
    
    // Assert total is calculated correctly
    const expectedTotal = (2 * 10.00) + (1 * 25.50); // 45.50
    await testHelpers.assertPageContains(page, `$${expectedTotal.toFixed(2)}`);
  });

  test('@orders should handle order search and filtering', async ({ page }) => {
    // Create multiple test orders
    const orders = [];
    for (let i = 0; i < 3; i++) {
      const testOrder = testHelpers.generateTestOrder();
      const orderResponse = await testHelpers.createOrder(testOrder);
      orders.push(orderResponse);
    }
    
    // Navigate to orders list
    await page.goto('/orders');
    
    // Search for specific order
    await page.fill('[data-testid="order-search"]', orders[0].order_number);
    await page.click('[data-testid="search-button"]');
    
    // Assert only the searched order is displayed
    await testHelpers.assertPageContains(page, orders[0].order_number);
    await expect(page.locator(`text=${orders[1].order_number}`)).not.toBeVisible();
    await expect(page.locator(`text=${orders[2].order_number}`)).not.toBeVisible();
    
    // Filter by status
    await page.selectOption('[data-testid="status-filter"]', 'pending');
    await page.click('[data-testid="filter-button"]');
    
    // Assert only pending orders are displayed
    await testHelpers.assertPageContains(page, 'Pending');
  });

  test('@orders should handle order pagination', async ({ page }) => {
    // Create many test orders (this would be done via API in real scenario)
    // For now, we'll test the pagination UI
    
    // Navigate to orders list
    await page.goto('/orders');
    
    // Assert pagination controls are visible
    await testHelpers.assertElementVisible(page, '[data-testid="pagination"]');
    
    // Click next page
    await page.click('[data-testid="next-page-button"]');
    
    // Assert page number is updated
    await testHelpers.assertPageContains(page, 'Page 2');
    
    // Click previous page
    await page.click('[data-testid="prev-page-button"]');
    
    // Assert back to first page
    await testHelpers.assertPageContains(page, 'Page 1');
  });

  test('@orders should export order data', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    await testHelpers.createOrder(testOrder);
    
    // Navigate to orders list
    await page.goto('/orders');
    
    // Click export button
    await page.click('[data-testid="export-orders-button"]');
    
    // Wait for download to start
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;
    
    // Assert file is downloaded
    expect(download.suggestedFilename()).toMatch(/orders.*\.csv/);
  });

  test('@orders should handle order notifications', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    const orderResponse = await testHelpers.createOrder(testOrder);
    
    // Navigate to order details
    await page.goto(`/orders/${orderResponse.order_number}`);
    
    // Enable notifications for this order
    await page.click('[data-testid="enable-notifications-button"]');
    
    // Assert notification is enabled
    await testHelpers.assertPageContains(page, 'Notifications enabled');
    
    // Update order status to trigger notification
    await page.click('[data-testid="update-status-button"]');
    await page.selectOption('[data-testid="status-select"]', 'shipped');
    await testHelpers.submitForm(page, '[data-testid="save-status-button"]');
    
    // Assert notification is displayed
    await testHelpers.assertPageContains(page, 'Order status updated');
  });

  test('@orders should validate order permissions', async ({ page }) => {
    // Create a test order first
    const testOrder = testHelpers.generateTestOrder();
    const orderResponse = await testHelpers.createOrder(testOrder);
    
    // Try to access order with different user (simulate by clearing token)
    testHelpers.clearAuthToken();
    
    // Navigate to order details
    await page.goto(`/orders/${orderResponse.order_number}`);
    
    // Should be redirected to login or show access denied
    await expect(page).toHaveURL(/.*(login|access-denied)/);
  });

  test('@orders should handle order bulk operations', async ({ page }) => {
    // Create multiple test orders
    const orders = [];
    for (let i = 0; i < 3; i++) {
      const testOrder = testHelpers.generateTestOrder();
      const orderResponse = await testHelpers.createOrder(testOrder);
      orders.push(orderResponse);
    }
    
    // Navigate to orders list
    await page.goto('/orders');
    
    // Select multiple orders
    for (const order of orders) {
      await page.check(`[data-testid="order-checkbox-${order.order_number}"]`);
    }
    
    // Click bulk action button
    await page.click('[data-testid="bulk-actions-button"]');
    
    // Select bulk update status
    await page.click('[data-testid="bulk-update-status"]');
    await page.selectOption('[data-testid="bulk-status-select"]', 'processing');
    await testHelpers.submitForm(page, '[data-testid="bulk-save-button"]');
    
    // Wait for bulk update to complete
    await testHelpers.waitForApiCall(page, '/api/orders/bulk-update');
    
    // Assert all orders are updated
    await testHelpers.assertPageContains(page, 'Processing');
  });
});
