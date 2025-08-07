const axios = require('axios');
const logger = require('./logger');

class ServiceDiscovery {
  constructor() {
    this.services = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.healthCheckTimeout = 5000; // 5 seconds
    this.initializeServices();
  }

  // Initialize service configurations
  initializeServices() {
    this.services.set('auth-service', {
      url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      healthEndpoint: '/health',
      status: 'unknown',
      lastCheck: null,
      retryCount: 0
    });

    this.services.set('user-service', {
      url: process.env.USER_SERVICE_URL || 'http://user-service:3002',
      healthEndpoint: '/health',
      status: 'unknown',
      lastCheck: null,
      retryCount: 0
    });

    this.services.set('order-service', {
      url: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
      healthEndpoint: '/health',
      status: 'unknown',
      lastCheck: null,
      retryCount: 0
    });

    // Start health check loop
    this.startHealthChecks();
  }

  // Get service URL
  getServiceUrl(serviceName) {
    const service = this.services.get(serviceName);
    return service ? service.url : null;
  }

  // Get service status
  getServiceStatus(serviceName) {
    const service = this.services.get(serviceName);
    return service ? service.status : 'unknown';
  }

  // Get all services status
  getAllServicesStatus() {
    const status = {};
    for (const [name, service] of this.services) {
      status[name] = {
        url: service.url,
        status: service.status,
        lastCheck: service.lastCheck,
        retryCount: service.retryCount
      };
    }
    return status;
  }

  // Check service health
  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      logger.error(`Service ${serviceName} not found in service discovery`);
      return false;
    }

    try {
      const response = await axios.get(`${service.url}${service.healthEndpoint}`, {
        timeout: this.healthCheckTimeout
      });

      if (response.status === 200) {
        service.status = 'healthy';
        service.retryCount = 0;
        logger.debug(`Service ${serviceName} is healthy`);
      } else {
        service.status = 'unhealthy';
        service.retryCount++;
        logger.warn(`Service ${serviceName} returned status ${response.status}`);
      }
    } catch (error) {
      service.status = 'unhealthy';
      service.retryCount++;
      logger.warn(`Service ${serviceName} health check failed:`, error.message);
    }

    service.lastCheck = new Date().toISOString();
    return service.status === 'healthy';
  }

  // Start periodic health checks
  startHealthChecks() {
    setInterval(async () => {
      for (const [serviceName] of this.services) {
        await this.checkServiceHealth(serviceName);
      }
    }, this.healthCheckInterval);

    logger.info('Service discovery health checks started');
  }

  // Manual health check for all services
  async checkAllServicesHealth() {
    const results = {};
    for (const [serviceName] of this.services) {
      results[serviceName] = await this.checkServiceHealth(serviceName);
    }
    return results;
  }

  // Get healthy services
  getHealthyServices() {
    const healthy = [];
    for (const [name, service] of this.services) {
      if (service.status === 'healthy') {
        healthy.push(name);
      }
    }
    return healthy;
  }

  // Get unhealthy services
  getUnhealthyServices() {
    const unhealthy = [];
    for (const [name, service] of this.services) {
      if (service.status === 'unhealthy') {
        unhealthy.push(name);
      }
    }
    return unhealthy;
  }

  // Update service configuration
  updateServiceConfig(serviceName, config) {
    const service = this.services.get(serviceName);
    if (service) {
      Object.assign(service, config);
      logger.info(`Updated configuration for service ${serviceName}`);
    } else {
      logger.error(`Service ${serviceName} not found for configuration update`);
    }
  }

  // Add new service
  addService(name, config) {
    this.services.set(name, {
      url: config.url,
      healthEndpoint: config.healthEndpoint || '/health',
      status: 'unknown',
      lastCheck: null,
      retryCount: 0
    });
    logger.info(`Added new service: ${name}`);
  }

  // Remove service
  removeService(name) {
    if (this.services.delete(name)) {
      logger.info(`Removed service: ${name}`);
    } else {
      logger.warn(`Service ${name} not found for removal`);
    }
  }
}

// Create singleton instance
const serviceDiscovery = new ServiceDiscovery();

module.exports = serviceDiscovery;
