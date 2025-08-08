-- Migration: Remove Sample Data
-- Version: 000002
-- Description: Remove sample data for development and testing

-- Delete sample orders
DELETE FROM orders WHERE order_number IN (
    'ORD-001',
    'ORD-002', 
    'ORD-003',
    'ORD-004',
    'ORD-005'
);

-- Delete sample users
DELETE FROM users WHERE email IN (
    'admin@devops-e2e.com',
    'user@devops-e2e.com',
    'john.doe@example.com',
    'jane.smith@example.com',
    'bob.wilson@example.com'
);
