const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

/**
 * Security middleware configuration
 * Implements OWASP security headers and other security measures
 */
const securityMiddleware = {
  /**
   * Configure Helmet for security headers
   */
  helmet: helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    // X-Content-Type-Options
    noSniff: true,
    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },
    // X-XSS-Protection
    xssFilter: true,
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    // Permissions Policy
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },
    // Remove X-Powered-By header
    hidePoweredBy: true,
    // Disable IE's XSS filter
    ieNoOpen: true
  }),

  /**
   * Configure CORS
   */
  cors: cors({
    origin: process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400 // 24 hours
  }),

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    // General rate limit
    general: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }),

    // Strict rate limit for auth endpoints
    auth: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 requests per windowMs
      message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }),

    // API rate limit
    api: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many API requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    })
  },

  /**
   * Additional security headers middleware
   */
  additionalHeaders: (req, res, next) => {
    // Remove server information
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Add request ID for tracking
    req.requestId = req.headers['x-request-id'] || 
                   req.headers['x-correlation-id'] || 
                   `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    res.setHeader('X-Request-ID', req.requestId);

    next();
  },

  /**
   * Request validation middleware
   */
  validateRequest: (req, res, next) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    const requestBody = JSON.stringify(req.body);
    const requestQuery = JSON.stringify(req.query);
    const requestParams = JSON.stringify(req.params);

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestBody) || pattern.test(requestQuery) || pattern.test(requestParams)) {
        return res.status(400).json({
          error: 'Malicious content detected',
          requestId: req.requestId
        });
      }
    }

    next();
  },

  /**
   * Input sanitization middleware
   */
  sanitizeInput: (req, res, next) => {
    // Sanitize request body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Remove potential XSS vectors
          req.body[key] = req.body[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        }
      });
    }

    next();
  },

  /**
   * Error handling middleware
   */
  errorHandler: (err, req, res, next) => {
    // Log error with request ID
    console.error(`[${req.requestId}] Error:`, err);

    // Don't expose internal errors to client
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;

    res.status(statusCode).json({
      error: message,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Security logging middleware
   */
  securityLogging: (req, res, next) => {
    const startTime = Date.now();

    // Log request
    console.log(`[${req.requestId}] ${req.method} ${req.path} - ${req.ip}`);

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
      
      console.log(`[${req.requestId}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
      
      // Log security events
      if (res.statusCode === 401 || res.statusCode === 403) {
        console.warn(`[${req.requestId}] Security event: ${res.statusCode} for ${req.ip}`);
      }
    });

    next();
  }
};

module.exports = securityMiddleware;
