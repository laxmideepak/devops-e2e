const CircuitBreaker = require('opossum');
const logger = require('./logger');

class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.defaultOptions = {
      timeout: 60000, // 60 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 300000, // 5 minutes
      volumeThreshold: 10
    };
  }

  // Get or create circuit breaker for a service
  getBreaker(serviceName, fn, options = {}) {
    if (!this.breakers.has(serviceName)) {
      const breakerOptions = { ...this.defaultOptions, ...options };
      const breaker = new CircuitBreaker(fn, breakerOptions);
      
      // Add event listeners for monitoring
      breaker.on('open', () => {
        logger.warn(`Circuit breaker for ${serviceName} is now OPEN`);
      });
      
      breaker.on('close', () => {
        logger.info(`Circuit breaker for ${serviceName} is now CLOSED`);
      });
      
      breaker.on('halfOpen', () => {
        logger.info(`Circuit breaker for ${serviceName} is now HALF_OPEN`);
      });
      
      breaker.on('fallback', (result) => {
        logger.warn(`Circuit breaker fallback triggered for ${serviceName}:`, result);
      });
      
      breaker.on('success', () => {
        logger.debug(`Circuit breaker success for ${serviceName}`);
      });
      
      breaker.on('timeout', () => {
        logger.warn(`Circuit breaker timeout for ${serviceName}`);
      });
      
      breaker.on('reject', () => {
        logger.warn(`Circuit breaker reject for ${serviceName}`);
      });
      
      this.breakers.set(serviceName, breaker);
    }
    
    return this.breakers.get(serviceName);
  }

  // Create a circuit breaker for HTTP requests
  createHttpBreaker(serviceName, baseURL) {
    const axios = require('axios');
    const instance = axios.create({ baseURL });
    
    const httpFunction = async (config) => {
      return await instance(config);
    };
    
    return this.getBreaker(serviceName, httpFunction);
  }

  // Get status of all circuit breakers
  getStatus() {
    const status = {};
    for (const [serviceName, breaker] of this.breakers) {
      status[serviceName] = {
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: breaker.stats,
        options: breaker.options
      };
    }
    return status;
  }

  // Get health status for monitoring
  getHealthStatus() {
    const health = {
      overall: 'healthy',
      services: {}
    };

    for (const [serviceName, breaker] of this.breakers) {
      const isHealthy = !breaker.opened || breaker.halfOpen;
      
      health.services[serviceName] = {
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        healthy: isHealthy,
        stats: breaker.stats
      };

      if (!isHealthy) {
        health.overall = 'degraded';
      }
    }

    return health;
  }

  // Reset circuit breaker for a service
  reset(serviceName) {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.close();
      logger.info(`Circuit breaker for ${serviceName} has been reset`);
    }
  }

  // Close all circuit breakers
  closeAll() {
    for (const [serviceName, breaker] of this.breakers) {
      breaker.close();
    }
    logger.info('All circuit breakers have been closed');
  }
}

// Create singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = circuitBreakerManager;
