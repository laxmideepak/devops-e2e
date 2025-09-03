// Jest setup file for API Gateway
// This file runs before each test

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-secret-key';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock Prometheus metrics
jest.mock('prom-client', () => ({
  register: {
    metrics: jest.fn(),
    contentType: 'text/plain',
  },
  Counter: jest.fn(() => ({
    inc: jest.fn(),
  })),
  Histogram: jest.fn(() => ({
    observe: jest.fn(),
  })),
  Gauge: jest.fn(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
  })),
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn(),
}));

// Mock Axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Mock Circuit Breaker
jest.mock('opossum', () => {
  return jest.fn().mockImplementation(() => ({
    fire: jest.fn(),
    fallback: jest.fn(),
    on: jest.fn(),
    stats: {
      fires: 0,
      fallbacks: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      totalCount: 0,
    },
  }));
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock request
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    url: '/',
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  }),
  
  // Helper to create mock response
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  },
  
  // Helper to create mock next function
  createMockNext: () => jest.fn(),
};
