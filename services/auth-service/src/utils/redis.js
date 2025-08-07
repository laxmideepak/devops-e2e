const redis = require('redis');
const logger = require('./logger');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with a individual error
      logger.error('Redis server refused connection');
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands with a individual error
      logger.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      logger.error('Redis max retry attempts reached');
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

client.on('connect', () => {
  logger.info('Connected to Redis');
});

client.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('end', () => {
  logger.info('Redis client disconnected');
});

// Connect to Redis
client.connect().catch((err) => {
  logger.error('Failed to connect to Redis:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  client.quit();
});

process.on('SIGTERM', () => {
  client.quit();
});

module.exports = client;
