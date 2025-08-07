const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Optional authentication middleware - doesn't fail if no token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'access') {
      return next();
    }
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token in optional auth:', error.message);
    next();
  }
};

// Required authentication middleware - fails if no valid token
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid JWT token in the Authorization header'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'access') {
      return res.status(401).json({ 
        error: 'Invalid token type',
        message: 'Access token required, not refresh token'
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your access token has expired. Please refresh your token.'
      });
    }
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or malformed'
    });
  }
};

// Role-based authorization middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide a valid JWT token'
      });
    }

    if (!req.user.role || req.user.role !== role) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Role '${role}' is required to access this resource`
      });
    }

    next();
  };
};

// Admin authorization middleware
const requireAdmin = requireRole('admin');

module.exports = {
  optionalAuth,
  requireAuth,
  requireRole,
  requireAdmin
};
