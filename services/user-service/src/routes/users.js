const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const logger = require('../utils/logger');
const db = require('../models/database');

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
const validateUserUpdate = [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('email').optional().isEmail().normalizeEmail()
];

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT id, email, first_name, last_name, created_at, updated_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        firstName: user.rows[0].first_name,
        lastName: user.rows[0].last_name,
        createdAt: user.rows[0].created_at,
        updatedAt: user.rows[0].updated_at
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, validateUserUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { firstName, lastName, email } = req.body;
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramCount}`);
      updateValues.push(firstName);
      paramCount++;
    }

    if (lastName) {
      updateFields.push(`last_name = $${paramCount}`);
      updateValues.push(lastName);
      paramCount++;
    }

    if (email) {
      // Check if email is already taken by another user
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      updateFields.push(`email = $${paramCount}`);
      updateValues.push(email);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(req.userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, created_at, updated_at
    `;

    const updatedUser = await db.query(query, updateValues);

    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile updated', { userId: req.userId });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.rows[0].id,
        email: updatedUser.rows[0].email,
        firstName: updatedUser.rows[0].first_name,
        lastName: updatedUser.rows[0].last_name,
        createdAt: updatedUser.rows[0].created_at,
        updatedAt: updatedUser.rows[0].updated_at
      }
    });
  } catch (error) {
    logger.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // For now, only allow users to access their own profile
    // In a real application, you'd check admin permissions
    if (id !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await db.query(
      'SELECT id, email, first_name, last_name, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        firstName: user.rows[0].first_name,
        lastName: user.rows[0].last_name,
        createdAt: user.rows[0].created_at,
        updatedAt: user.rows[0].updated_at
      }
    });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List users (admin only - pagination support)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // For now, return empty list - in a real app, you'd check admin permissions
    // and return the actual user list
    res.json({
      users: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0
      }
    });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user account
router.delete('/profile', authenticateToken, async (req, res) => {
  try {
    const deletedUser = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [req.userId]
    );

    if (deletedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User account deleted', { userId: req.userId });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Delete user account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
