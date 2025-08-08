# Database Migrations

This document describes the database migration system for the DevOps E2E Platform.

## Overview

The platform uses [golang-migrate](https://github.com/golang-migrate/migrate) for database schema management. Migrations are versioned SQL files that allow for safe, reversible database schema changes.

## Migration Structure

```
infrastructure/migrations/
├── scripts/                    # SQL migration files
│   ├── 000001_create_initial_schema.up.sql
│   ├── 000001_create_initial_schema.down.sql
│   ├── 000002_add_sample_data.up.sql
│   ├── 000002_add_sample_data.down.sql
│   └── manage-migrations.sh   # Migration management script
├── kubernetes/                 # Kubernetes migration job
│   └── migration-job.yaml
└── helm/                      # Helm chart templates
    └── migration-job.yaml
```

## Migration Files

### Naming Convention

Migration files follow the pattern: `{version}_{description}.{up|down}.sql`

- `version`: Sequential number (e.g., 000001, 000002)
- `description`: Human-readable description (e.g., create_initial_schema)
- `up`: Migration to apply changes
- `down`: Migration to rollback changes

### File Structure

Each migration should have both `.up.sql` and `.down.sql` files:

```sql
-- Migration: Create Initial Schema
-- Version: 000001
-- Description: Create initial database schema for DevOps E2E Platform

-- Your SQL statements here
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    -- ... other columns
);
```

## Available Migrations

### 000001: Create Initial Schema

Creates the foundational database schema:

- **Tables**: `users`, `orders`, `audit_logs`, `refresh_tokens`
- **Extensions**: `pgVector` for vector operations
- **Indexes**: Performance indexes on key columns
- **Triggers**: Automatic `updated_at` timestamp updates
- **Functions**: Audit logging and timestamp management

### 000002: Add Sample Data

Inserts sample data for development and testing:

- **Users**: 5 sample users with different states
- **Orders**: 5 sample orders with various statuses
- **Data**: Realistic test data for all scenarios

## Local Development

### Prerequisites

1. Install golang-migrate:
   ```bash
   go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
   ```

2. Ensure PostgreSQL is running:
   ```bash
   docker-compose up -d postgres
   ```

### Using the Management Script

The `manage-migrations.sh` script provides easy migration management:

```bash
# Make script executable
chmod +x infrastructure/migrations/scripts/manage-migrations.sh

# Run all pending migrations
./infrastructure/migrations/scripts/manage-migrations.sh up

# Rollback last migration
./infrastructure/migrations/scripts/manage-migrations.sh down

# Rollback multiple migrations
./infrastructure/migrations/scripts/manage-migrations.sh down 2

# Check migration status
./infrastructure/migrations/scripts/manage-migrations.sh status

# Create new migration
./infrastructure/migrations/scripts/manage-migrations.sh create add_user_profile

# Validate migration files
./infrastructure/migrations/scripts/manage-migrations.sh validate

# Check database connection
./infrastructure/migrations/scripts/manage-migrations.sh check
```

### Manual Migration Commands

Direct golang-migrate commands:

```bash
# Set database URL
export DATABASE_URL="postgres://postgres:devops-e2e-password@localhost:5432/devops_e2e?sslmode=disable"

# Run migrations
migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" up

# Check status
migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" version

# Rollback
migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" down 1

# Force version
migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" force 2
```

## Kubernetes Deployment

### Migration Job

The platform includes a Kubernetes Job for running migrations:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: database-migration
spec:
  template:
    spec:
      containers:
      - name: migration
        image: migrate/migrate:latest
        command:
        - migrate
        - "-path=/migrations"
        - "-database"
        - "postgres://postgres:password@postgresql:5432/devops_e2e?sslmode=disable"
        - "up"
```

### Running in Kubernetes

```bash
# Apply migration job
kubectl apply -f infrastructure/migrations/kubernetes/migration-job.yaml

# Check job status
kubectl get jobs database-migration

# View logs
kubectl logs job/database-migration

# Clean up
kubectl delete job database-migration
```

## Helm Integration

### Configuration

Migrations are configured in `values.yaml`:

```yaml
migrations:
  enabled: true
  image:
    repository: migrate/migrate
    tag: "latest"
  resources:
    requests:
      memory: "64Mi"
      cpu: "50m"
    limits:
      memory: "128Mi"
      cpu: "100m"
  timeout: 300
  hooks:
    preInstall: true
    preUpgrade: true
    hookWeight: -5
    deletePolicy: "before-hook-creation,hook-succeeded"
```

### Helm Hooks

Migrations run automatically as Helm hooks:

- **pre-install**: Run before chart installation
- **pre-upgrade**: Run before chart upgrades
- **hook-weight**: -5 (runs before other components)
- **delete-policy**: Clean up after successful execution

### Deploying with Helm

```bash
# Install with migrations
helm install devops-e2e ./infrastructure/helm

# Upgrade with migrations
helm upgrade devops-e2e ./infrastructure/helm

# Check migration status
kubectl get jobs -l component=migration
```

## CI/CD Integration

### GitHub Actions Workflow

The platform includes automated migration workflows:

- **Validation**: Checks migration file integrity
- **Local Testing**: Tests migrations in CI environment
- **Staging Deployment**: Runs migrations on staging environment
- **Production Deployment**: Runs migrations on production environment
- **Manual Execution**: Manual migration triggers

### Workflow Triggers

- **Automatic**: On push to `main` or `develop` branches
- **Path-based**: Only when migration files change
- **Manual**: Manual workflow dispatch with environment selection

### Environment Protection

- **Staging**: Automatic deployment on `develop` branch
- **Production**: Automatic deployment on `main` branch
- **Manual**: Protected environments with approval gates

## Best Practices

### Creating New Migrations

1. **Use the management script**:
   ```bash
   ./infrastructure/migrations/scripts/manage-migrations.sh create add_new_feature
   ```

2. **Follow naming conventions**:
   - Use descriptive names
   - Include version numbers
   - Create both up and down migrations

3. **Write reversible migrations**:
   - Every change should be reversible
   - Test both up and down migrations
   - Use `IF EXISTS` and `IF NOT EXISTS` clauses

4. **Include documentation**:
   ```sql
   -- Migration: Add User Profile
   -- Version: 000003
   -- Description: Add user profile table with avatar support
   ```

### Testing Migrations

1. **Local testing**:
   ```bash
   ./infrastructure/migrations/scripts/manage-migrations.sh validate
   ```

2. **Database testing**:
   ```bash
   # Test up migration
   migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" up
   
   # Test down migration
   migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" down 1
   ```

3. **Integration testing**:
   - Test with application code
   - Verify data integrity
   - Check application functionality

### Production Considerations

1. **Backup before migrations**:
   ```bash
   pg_dump -h localhost -U postgres devops_e2e > backup.sql
   ```

2. **Test in staging first**:
   - Always test migrations in staging
   - Verify rollback procedures
   - Monitor application health

3. **Monitor migration execution**:
   ```bash
   kubectl logs job/database-migration -f
   ```

4. **Have rollback plan**:
   - Document rollback procedures
   - Test rollback scenarios
   - Keep backup strategies

## Troubleshooting

### Common Issues

1. **Migration already applied**:
   ```bash
   migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" force 2
   ```

2. **Database connection issues**:
   ```bash
   ./infrastructure/migrations/scripts/manage-migrations.sh check
   ```

3. **Kubernetes job failures**:
   ```bash
   kubectl describe job database-migration
   kubectl logs job/database-migration
   ```

4. **Helm hook failures**:
   ```bash
   helm get hooks devops-e2e
   kubectl get events --sort-by='.lastTimestamp'
   ```

### Debugging Commands

```bash
# Check migration status
migrate -path ./infrastructure/migrations/scripts -database "$DATABASE_URL" version

# Validate migration files
./infrastructure/migrations/scripts/manage-migrations.sh validate

# Test database connection
psql -h localhost -U postgres -d devops_e2e -c "SELECT version();"

# Check Kubernetes resources
kubectl get jobs,pods -l component=migration
```

## Security Considerations

1. **Database credentials**: Use Kubernetes secrets for database passwords
2. **Network policies**: Restrict migration job network access
3. **RBAC**: Use service accounts with minimal permissions
4. **Audit logging**: Log all migration operations
5. **Backup verification**: Verify backups before migrations

## Monitoring and Alerting

### Metrics to Monitor

- Migration execution time
- Migration success/failure rates
- Database connection health
- Schema version consistency

### Alerts to Configure

- Migration job failures
- Long-running migrations
- Database connection issues
- Schema version mismatches

## References

- [golang-migrate Documentation](https://github.com/golang-migrate/migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [Helm Hooks](https://helm.sh/docs/chart_hooks/)
