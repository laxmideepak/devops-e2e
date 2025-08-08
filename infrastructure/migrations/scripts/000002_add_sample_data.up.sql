-- Migration: Add Sample Data
-- Version: 000002
-- Description: Add sample data for development and testing

-- Insert sample users
INSERT INTO users (email, password_hash, first_name, last_name, is_active, email_verified) VALUES
    ('admin@devops-e2e.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJ8KqG', 'Admin', 'User', true, true),
    ('user@devops-e2e.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJ8KqG', 'Test', 'User', true, true),
    ('john.doe@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJ8KqG', 'John', 'Doe', true, true),
    ('jane.smith@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJ8KqG', 'Jane', 'Smith', true, true),
    ('bob.wilson@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJ8KqG', 'Bob', 'Wilson', true, false)
ON CONFLICT (email) DO NOTHING;

-- Insert sample orders
INSERT INTO orders (user_id, order_number, status, total_amount, items, shipping_address, billing_address) VALUES
    (1, 'ORD-001', 'completed', 99.99, '[{"product_id": 1, "name": "Sample Product", "quantity": 1, "price": 99.99}]', '{"street": "123 Main St", "city": "Anytown", "state": "CA", "zip": "12345"}', '{"street": "123 Main St", "city": "Anytown", "state": "CA", "zip": "12345"}'),
    (2, 'ORD-002', 'pending', 149.99, '[{"product_id": 2, "name": "Another Product", "quantity": 2, "price": 74.99}]', '{"street": "456 Oak Ave", "city": "Somewhere", "state": "NY", "zip": "67890"}', '{"street": "456 Oak Ave", "city": "Somewhere", "state": "NY", "zip": "67890"}'),
    (3, 'ORD-003', 'shipped', 299.99, '[{"product_id": 3, "name": "Premium Product", "quantity": 1, "price": 299.99}]', '{"street": "789 Pine Rd", "city": "Elsewhere", "state": "TX", "zip": "11111"}', '{"street": "789 Pine Rd", "city": "Elsewhere", "state": "TX", "zip": "11111"}'),
    (4, 'ORD-004', 'processing', 199.99, '[{"product_id": 4, "name": "Special Product", "quantity": 3, "price": 66.66}]', '{"street": "321 Elm St", "city": "Nowhere", "state": "FL", "zip": "22222"}', '{"street": "321 Elm St", "city": "Nowhere", "state": "FL", "zip": "22222"}'),
    (5, 'ORD-005', 'cancelled', 79.99, '[{"product_id": 5, "name": "Basic Product", "quantity": 1, "price": 79.99}]', '{"street": "654 Maple Dr", "city": "Anywhere", "state": "WA", "zip": "33333"}', '{"street": "654 Maple Dr", "city": "Anywhere", "state": "WA", "zip": "33333"}')
ON CONFLICT (order_number) DO NOTHING;
