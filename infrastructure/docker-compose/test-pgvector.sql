-- Test pgVector Extension
-- This script verifies that pgVector is properly installed and working

-- Check if pgVector extension is available
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'vector';

-- Create a test table with vector column
CREATE TABLE IF NOT EXISTS test_vectors (
    id SERIAL PRIMARY KEY,
    embedding vector(384),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO test_vectors (embedding, description) VALUES
    ('[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]'::vector, 'Test vector 1'),
    ('[1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]'::vector, 'Test vector 2');

-- Test vector similarity search
SELECT 
    id,
    description,
    embedding <=> '[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]'::vector as distance
FROM test_vectors
ORDER BY embedding <=> '[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]'::vector
LIMIT 5;

-- Clean up test data
DROP TABLE IF EXISTS test_vectors;

-- Show success message
SELECT 'pgVector extension is working correctly!' as status;
