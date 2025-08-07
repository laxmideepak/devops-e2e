const { connect } = require('nats');
const logger = require('./logger');

class NatsClient {
  constructor() {
    this.nc = null;
    this.js = null;
    this.connected = false;
  }

  async connect() {
    try {
      const servers = process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'];
      
      this.nc = await connect({
        servers,
        timeout: 5000,
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000
      });

      this.js = this.nc.jetstream();
      this.connected = true;

      logger.info('Connected to NATS server');

      // Handle connection events
      this.nc.closed().then(() => {
        logger.info('NATS connection closed');
        this.connected = false;
      });

      this.nc.addEventListener('error', (err) => {
        logger.error('NATS connection error:', err);
      });

      this.nc.addEventListener('reconnect', () => {
        logger.info('NATS reconnected');
        this.connected = true;
      });

    } catch (error) {
      logger.error('Failed to connect to NATS:', error);
      this.connected = false;
    }
  }

  async publish(subject, data) {
    if (!this.connected || !this.js) {
      logger.warn('NATS not connected, skipping event publish');
      return false;
    }

    try {
      const payload = JSON.stringify({
        id: require('uuid').v4(),
        timestamp: new Date().toISOString(),
        data
      });

      await this.js.publish(subject, Buffer.from(payload));
      logger.info(`Published event to ${subject}`, { eventId: payload.id });
      return true;
    } catch (error) {
      logger.error(`Failed to publish event to ${subject}:`, error);
      return false;
    }
  }

  async publishOrderCreated(orderData) {
    return this.publish('order.created', {
      orderId: orderData.id,
      userId: orderData.user_id,
      orderNumber: orderData.order_number,
      status: orderData.status,
      totalAmount: orderData.total_amount,
      items: orderData.items
    });
  }

  async publishOrderUpdated(orderData) {
    return this.publish('order.updated', {
      orderId: orderData.id,
      userId: orderData.user_id,
      orderNumber: orderData.order_number,
      status: orderData.status,
      totalAmount: orderData.total_amount,
      items: orderData.items
    });
  }

  async publishOrderCancelled(orderData) {
    return this.publish('order.cancelled', {
      orderId: orderData.id,
      userId: orderData.user_id,
      orderNumber: orderData.order_number,
      status: orderData.status
    });
  }

  async disconnect() {
    if (this.nc) {
      await this.nc.drain();
      this.nc.close();
      this.connected = false;
      logger.info('NATS connection closed');
    }
  }

  isConnected() {
    return this.connected;
  }
}

// Create singleton instance
const natsClient = new NatsClient();

// Connect on module load
natsClient.connect().catch(err => {
  logger.error('Failed to connect to NATS on startup:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await natsClient.disconnect();
});

process.on('SIGTERM', async () => {
  await natsClient.disconnect();
});

module.exports = natsClient;
