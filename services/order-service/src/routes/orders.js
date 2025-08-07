const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const db = require('../models/database');
const nats = require('../utils/nats');

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Validation middleware
const validateOrderCreate = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Valid product ID is required'),
  body('items.*.name').notEmpty().withMessage('Product name is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('items.*.price').isFloat({ min: 0.01 }).withMessage('Valid price is required'),
  body('shippingAddress').optional().isObject(),
  body('billingAddress').optional().isObject()
];

const validateOrderUpdate = [
  body('status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  body('shippingAddress').optional().isObject(),
  body('billingAddress').optional().isObject()
];

// Helper function to generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
};

// Helper function to calculate total amount
const calculateTotalAmount = (items) => {
  return items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
};

// Create order
router.post('/', authenticateToken, validateOrderCreate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { items, shippingAddress, billingAddress } = req.body;
    const orderNumber = generateOrderNumber();
    const totalAmount = calculateTotalAmount(items);

    // Create order
    const newOrder = await db.query(
      `INSERT INTO orders (user_id, order_number, status, total_amount, items, shipping_address, billing_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, user_id, order_number, status, total_amount, items, shipping_address, billing_address, created_at`,
      [req.userId, orderNumber, 'pending', totalAmount, JSON.stringify(items), 
       JSON.stringify(shippingAddress), JSON.stringify(billingAddress)]
    );

    const order = newOrder.rows[0];

    // Publish order created event
    await nats.publishOrderCreated(order);

    logger.info('Order created successfully', { 
      orderId: order.id, 
      orderNumber: order.order_number,
      userId: req.userId 
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: order.total_amount,
        items: order.items,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        createdAt: order.created_at
      }
    });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [req.userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get orders
    const orders = await db.query(
      `SELECT id, order_number, status, total_amount, items, shipping_address, billing_address, created_at, updated_at 
       FROM orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    res.json({
      orders: orders.rows.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: order.total_amount,
        items: order.items,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await db.query(
      `SELECT id, user_id, order_number, status, total_amount, items, shipping_address, billing_address, created_at, updated_at 
       FROM orders 
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = order.rows[0];

    res.json({
      order: {
        id: orderData.id,
        orderNumber: orderData.order_number,
        status: orderData.status,
        totalAmount: orderData.total_amount,
        items: orderData.items,
        shippingAddress: orderData.shipping_address,
        billingAddress: orderData.billing_address,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at
      }
    });
  } catch (error) {
    logger.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order
router.put('/:id', authenticateToken, validateOrderUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { status, shippingAddress, billingAddress } = req.body;

    // Check if order exists and belongs to user
    const existingOrder = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (existingOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
      paramCount++;
    }

    if (shippingAddress) {
      updateFields.push(`shipping_address = $${paramCount}`);
      updateValues.push(JSON.stringify(shippingAddress));
      paramCount++;
    }

    if (billingAddress) {
      updateFields.push(`billing_address = $${paramCount}`);
      updateValues.push(JSON.stringify(billingAddress));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id, req.userId);

    const query = `
      UPDATE orders 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    const updatedOrder = await db.query(query, updateValues);

    if (updatedOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = updatedOrder.rows[0];

    // Publish order updated event
    await nats.publishOrderUpdated(orderData);

    logger.info('Order updated successfully', { 
      orderId: orderData.id, 
      orderNumber: orderData.order_number,
      userId: req.userId 
    });

    res.json({
      message: 'Order updated successfully',
      order: {
        id: orderData.id,
        orderNumber: orderData.order_number,
        status: orderData.status,
        totalAmount: orderData.total_amount,
        items: orderData.items,
        shippingAddress: orderData.shipping_address,
        billingAddress: orderData.billing_address,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at
      }
    });
  } catch (error) {
    logger.error('Update order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel order
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order exists and belongs to user
    const existingOrder = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (existingOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = existingOrder.rows[0];

    // Only allow cancellation of pending orders
    if (orderData.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Order cannot be cancelled',
        message: 'Only pending orders can be cancelled'
      });
    }

    // Update order status to cancelled
    const cancelledOrder = await db.query(
      `UPDATE orders 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.userId]
    );

    const updatedOrder = cancelledOrder.rows[0];

    // Publish order cancelled event
    await nats.publishOrderCancelled(updatedOrder);

    logger.info('Order cancelled successfully', { 
      orderId: updatedOrder.id, 
      orderNumber: updatedOrder.order_number,
      userId: req.userId 
    });

    res.json({
      message: 'Order cancelled successfully',
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        status: updatedOrder.status,
        totalAmount: updatedOrder.total_amount,
        items: updatedOrder.items,
        shippingAddress: updatedOrder.shipping_address,
        billingAddress: updatedOrder.billing_address,
        createdAt: updatedOrder.created_at,
        updatedAt: updatedOrder.updated_at
      }
    });
  } catch (error) {
    logger.error('Cancel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
