#!/bin/bash

# DevOps E2E Platform Monitoring Setup Script
# This script sets up and tests the observability stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to wait for service to be ready
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            print_success "$service is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: $service not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service failed to start within expected time"
    return 1
}

# Function to test Prometheus
test_prometheus() {
    print_status "Testing Prometheus..."
    
    if curl -s "http://localhost:9090/api/v1/status/config" > /dev/null; then
        print_success "Prometheus is responding"
        
        # Check if targets are being scraped
        local targets=$(curl -s "http://localhost:9090/api/v1/targets" | jq '.data.activeTargets | length')
        print_status "Active targets: $targets"
        
        return 0
    else
        print_error "Prometheus is not responding"
        return 1
    fi
}

# Function to test Grafana
test_grafana() {
    print_status "Testing Grafana..."
    
    if curl -s "http://localhost:3001/api/health" > /dev/null; then
        print_success "Grafana is responding"
        
        # Check datasources
        local datasources=$(curl -s "http://admin:admin@localhost:3001/api/datasources" | jq 'length')
        print_status "Configured datasources: $datasources"
        
        return 0
    else
        print_error "Grafana is not responding"
        return 1
    fi
}

# Function to test Loki
test_loki() {
    print_status "Testing Loki..."
    
    if curl -s "http://localhost:3100/ready" > /dev/null; then
        print_success "Loki is responding"
        
        # Check if Loki is ready
        local ready=$(curl -s "http://localhost:3100/ready")
        if [ "$ready" = "ready" ]; then
            print_success "Loki is ready"
        else
            print_warning "Loki is not ready yet"
        fi
        
        return 0
    else
        print_error "Loki is not responding"
        return 1
    fi
}

# Function to test Tempo
test_tempo() {
    print_status "Testing Tempo..."
    
    if curl -s "http://localhost:3200/ready" > /dev/null; then
        print_success "Tempo is responding"
        
        # Check if Tempo is ready
        local ready=$(curl -s "http://localhost:3200/ready")
        if [ "$ready" = "ready" ]; then
            print_success "Tempo is ready"
        else
            print_warning "Tempo is not ready yet"
        fi
        
        return 0
    else
        print_error "Tempo is not responding"
        return 1
    fi
}

# Function to test OpenTelemetry Collector
test_otel() {
    print_status "Testing OpenTelemetry Collector..."
    
    if curl -s "http://localhost:13133" > /dev/null; then
        print_success "OpenTelemetry Collector is responding"
        
        # Check health endpoint
        local health=$(curl -s "http://localhost:13133" | jq '.status')
        print_status "Health status: $health"
        
        return 0
    else
        print_error "OpenTelemetry Collector is not responding"
        return 1
    fi
}

# Function to generate test metrics
generate_test_metrics() {
    print_status "Generating test metrics..."
    
    # Generate some test HTTP requests to create metrics
    for i in {1..10}; do
        curl -s "http://localhost:3000/health" > /dev/null
        curl -s "http://localhost:3001/health" > /dev/null
        curl -s "http://localhost:3002/health" > /dev/null
        curl -s "http://localhost:3003/health" > /dev/null
        sleep 0.5
    done
    
    print_success "Test metrics generated"
}

# Function to show monitoring URLs
show_monitoring_urls() {
    print_status "Monitoring Stack URLs:"
    echo ""
    echo "📊 Grafana Dashboard: http://localhost:3001"
    echo "   Username: admin"
    echo "   Password: admin"
    echo ""
    echo "📈 Prometheus: http://localhost:9090"
    echo ""
    echo "📝 Loki (Logs): http://localhost:3100"
    echo ""
    echo "🔍 Tempo (Traces): http://localhost:3200"
    echo ""
    echo "📡 OpenTelemetry Collector: http://localhost:13133"
    echo ""
}

# Main execution
main() {
    print_status "Setting up DevOps E2E Platform Monitoring Stack..."
    
    # Start the monitoring services
    print_status "Starting monitoring services..."
    docker-compose up -d prometheus grafana loki tempo otel-collector
    
    # Wait for services to be ready
    wait_for_service "Prometheus" 9090
    wait_for_service "Grafana" 3001
    wait_for_service "Loki" 3100
    wait_for_service "Tempo" 3200
    wait_for_service "OpenTelemetry Collector" 13133
    
    # Test services
    test_prometheus
    test_grafana
    test_loki
    test_tempo
    test_otel
    
    # Generate test metrics
    generate_test_metrics
    
    # Show monitoring URLs
    show_monitoring_urls
    
    print_success "Monitoring stack setup completed!"
    print_status "You can now access the monitoring dashboards using the URLs above."
}

# Execute main function
main "$@"
