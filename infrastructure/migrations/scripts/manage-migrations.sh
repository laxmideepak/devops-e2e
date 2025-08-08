#!/bin/bash

# Database Migration Management Script
# This script manages database migrations using golang-migrate

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIGRATIONS_PATH="./infrastructure/migrations/scripts"
DATABASE_URL="postgres://postgres:devops-e2e-password@localhost:5432/devops_e2e?sslmode=disable"
KUBERNETES_NAMESPACE="default"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if migrate is installed
check_migrate() {
    if ! command -v migrate &> /dev/null; then
        print_error "golang-migrate is not installed. Please install it first."
        echo "Installation: go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest"
        exit 1
    fi
}

# Function to check database connection
check_database() {
    print_status "Checking database connection..."
    
    if migrate -path $MIGRATIONS_PATH -database "$DATABASE_URL" version; then
        print_success "Database connection successful"
        return 0
    else
        print_error "Database connection failed"
        return 1
    fi
}

# Function to run migrations up
migrate_up() {
    print_status "Running migrations up..."
    
    if migrate -path $MIGRATIONS_PATH -database "$DATABASE_URL" up; then
        print_success "Migrations completed successfully"
    else
        print_error "Migrations failed"
        exit 1
    fi
}

# Function to run migrations down
migrate_down() {
    local steps=${1:-1}
    print_status "Running migrations down by $steps steps..."
    
    if migrate -path $MIGRATIONS_PATH -database "$DATABASE_URL" down $steps; then
        print_success "Migrations rolled back successfully"
    else
        print_error "Migration rollback failed"
        exit 1
    fi
}

# Function to force migration version
force_version() {
    local version=$1
    print_status "Forcing migration version to $version..."
    
    if migrate -path $MIGRATIONS_PATH -database "$DATABASE_URL" force $version; then
        print_success "Migration version forced to $version"
    else
        print_error "Failed to force migration version"
        exit 1
    fi
}

# Function to show migration status
show_status() {
    print_status "Migration status:"
    migrate -path $MIGRATIONS_PATH -database "$DATABASE_URL" version
}

# Function to create new migration
create_migration() {
    local name=$1
    
    if [ -z "$name" ]; then
        print_error "Please provide a migration name"
        echo "Usage: $0 create <migration-name>"
        exit 1
    fi
    
    print_status "Creating new migration: $name"
    
    # Create up migration
    local timestamp=$(date +%Y%m%d%H%M%S)
    local up_file="$MIGRATIONS_PATH/${timestamp}_${name}.up.sql"
    local down_file="$MIGRATIONS_PATH/${timestamp}_${name}.down.sql"
    
    echo "-- Migration: $name" > "$up_file"
    echo "-- Version: $timestamp" >> "$up_file"
    echo "-- Description: $name" >> "$up_file"
    echo "" >> "$up_file"
    
    echo "-- Migration: Rollback $name" > "$down_file"
    echo "-- Version: $timestamp" >> "$down_file"
    echo "-- Description: Rollback $name" >> "$down_file"
    echo "" >> "$down_file"
    
    print_success "Created migration files:"
    echo "  Up: $up_file"
    echo "  Down: $down_file"
}

# Function to run migrations in Kubernetes
migrate_kubernetes() {
    print_status "Running migrations in Kubernetes..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Apply the migration job
    kubectl apply -f ./infrastructure/migrations/kubernetes/migration-job.yaml
    
    # Wait for job to complete
    print_status "Waiting for migration job to complete..."
    kubectl wait --for=condition=complete job/database-migration -n $KUBERNETES_NAMESPACE --timeout=300s
    
    # Check job status
    local job_status=$(kubectl get job database-migration -n $KUBERNETES_NAMESPACE -o jsonpath='{.status.succeeded}')
    
    if [ "$job_status" = "1" ]; then
        print_success "Kubernetes migration completed successfully"
        
        # Clean up the job
        kubectl delete job database-migration -n $KUBERNETES_NAMESPACE
    else
        print_error "Kubernetes migration failed"
        
        # Show job logs
        print_status "Migration job logs:"
        kubectl logs job/database-migration -n $KUBERNETES_NAMESPACE
        
        exit 1
    fi
}

# Function to validate migrations
validate_migrations() {
    print_status "Validating migration files..."
    
    # Check if migration files exist
    if [ ! -d "$MIGRATIONS_PATH" ]; then
        print_error "Migrations directory not found: $MIGRATIONS_PATH"
        exit 1
    fi
    
    # Check for paired migration files
    local up_files=$(find $MIGRATIONS_PATH -name "*.up.sql" | sort)
    local down_files=$(find $MIGRATIONS_PATH -name "*.down.sql" | sort)
    
    print_status "Found migration files:"
    echo "Up migrations:"
    echo "$up_files"
    echo ""
    echo "Down migrations:"
    echo "$down_files"
    
    # Validate that each up migration has a corresponding down migration
    for up_file in $up_files; do
        local base_name=$(basename "$up_file" .up.sql)
        local down_file="$MIGRATIONS_PATH/${base_name}.down.sql"
        
        if [ ! -f "$down_file" ]; then
            print_warning "Missing down migration for: $base_name"
        else
            print_success "✓ $base_name has both up and down migrations"
        fi
    done
}

# Function to show help
show_help() {
    echo "Database Migration Management Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  up                    Run all pending migrations"
    echo "  down [steps]          Rollback migrations (default: 1 step)"
    echo "  force <version>       Force migration version"
    echo "  status                Show current migration status"
    echo "  create <name>         Create new migration files"
    echo "  k8s                   Run migrations in Kubernetes"
    echo "  validate              Validate migration files"
    echo "  check                 Check database connection"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 up"
    echo "  $0 down 2"
    echo "  $0 force 2"
    echo "  $0 create add_user_profile"
    echo "  $0 k8s"
    echo "  $0 status"
}

# Main execution
main() {
    case "${1:-help}" in
        "up")
            check_migrate
            check_database
            migrate_up
            ;;
        "down")
            check_migrate
            check_database
            migrate_down "$2"
            ;;
        "force")
            check_migrate
            check_database
            force_version "$2"
            ;;
        "status")
            check_migrate
            check_database
            show_status
            ;;
        "create")
            create_migration "$2"
            ;;
        "k8s")
            migrate_kubernetes
            ;;
        "validate")
            validate_migrations
            ;;
        "check")
            check_migrate
            check_database
            ;;
        "help")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
