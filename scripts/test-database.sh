#!/bin/bash

# Test PostgreSQL Database Setup
# This script verifies that PostgreSQL with pgVector is working correctly

set -e

echo "🔍 Testing PostgreSQL Database Setup..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec devops-e2e-postgres pg_isready -U postgres; do
    echo "PostgreSQL is not ready yet..."
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Test basic connection
echo "🔍 Testing basic database connection..."
docker exec devops-e2e-postgres psql -U postgres -d devops_e2e -c "SELECT version();"

# Test pgVector extension
echo "🔍 Testing pgVector extension..."
docker exec devops-e2e-postgres psql -U postgres -d devops_e2e -c "
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'vector';
"

# Test vector operations
echo "🔍 Testing vector operations..."
docker exec devops-e2e-postgres psql -U postgres -d devops_e2e -c "
CREATE TABLE IF NOT EXISTS test_vectors (
    id SERIAL PRIMARY KEY,
    embedding vector(10),
    description TEXT
);

INSERT INTO test_vectors (embedding, description) VALUES
    ('[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]'::vector, 'Test vector 1'),
    ('[1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]'::vector, 'Test vector 2');

SELECT 
    id,
    description,
    embedding <=> '[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]'::vector as distance
FROM test_vectors
ORDER BY embedding <=> '[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]'::vector;

DROP TABLE test_vectors;
"

# Test main tables
echo "🔍 Testing main application tables..."
docker exec devops-e2e-postgres psql -U postgres -d devops_e2e -c "
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'orders', 'audit_logs')
ORDER BY table_name, ordinal_position;
"

# Test sample data
echo "🔍 Testing sample data..."
docker exec devops-e2e-postgres psql -U postgres -d devops_e2e -c "
SELECT 'Users count:' as info, COUNT(*) as count FROM users
UNION ALL
SELECT 'Orders count:' as info, COUNT(*) as count FROM orders
UNION ALL
SELECT 'Audit logs count:' as info, COUNT(*) as count FROM audit_logs;
"

echo "✅ Database setup test completed successfully!"
echo "🎉 PostgreSQL with pgVector is working correctly!"
