#!/bin/bash

# Blue-Green Deployment Traffic Switch Script
# This script switches traffic between blue (stable) and green (preview) environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="default"
CONFIGMAP_NAME="traffic-router-config"
DEPLOYMENT_NAME="traffic-router"

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

# Function to check if environment is healthy
check_environment_health() {
    local environment=$1
    local namespace="devops-e2e-$environment"
    
    print_status "Checking $environment environment health..."
    
    # Check if pods are ready
    local ready_pods=$(kubectl get pods -n $namespace -l app=api-gateway,version=$environment --no-headers | grep -c "Running")
    local total_pods=$(kubectl get pods -n $namespace -l app=api-gateway,version=$environment --no-headers | wc -l)
    
    if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
        print_success "$environment environment is healthy ($ready_pods/$total_pods pods ready)"
        return 0
    else
        print_error "$environment environment is not healthy ($ready_pods/$total_pods pods ready)"
        return 1
    fi
}

# Function to switch traffic to blue
switch_to_blue() {
    print_status "Switching traffic to BLUE (stable) environment..."
    
    # Check blue environment health
    if ! check_environment_health "blue"; then
        print_error "Cannot switch to blue environment - health check failed"
        exit 1
    fi
    
    # Update nginx configuration to route to blue
    kubectl patch configmap $CONFIGMAP_NAME -n $NAMESPACE --patch '{
        "data": {
            "nginx.conf": "events {\n  worker_connections 1024;\n}\n\nhttp {\n  upstream blue {\n    server api-gateway-blue.devops-e2e-blue.svc.cluster.local:3000;\n  }\n\n  upstream green {\n    server api-gateway-green.devops-e2e-green.svc.cluster.local:3000;\n  }\n\n  # Route to blue (stable)\n  upstream active {\n    server api-gateway-blue.devops-e2e-blue.svc.cluster.local:3000;\n  }\n\n  server {\n    listen 80;\n\n    location / {\n      proxy_pass http://active;\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto $scheme;\n    }\n\n    location /health {\n      proxy_pass http://active;\n    }\n\n    location /metrics {\n      proxy_pass http://active;\n    }\n  }\n}"
        }'
    
    # Restart traffic router to pick up new configuration
    kubectl rollout restart deployment $DEPLOYMENT_NAME -n $NAMESPACE
    
    # Wait for rollout to complete
    kubectl rollout status deployment $DEPLOYMENT_NAME -n $NAMESPACE --timeout=60s
    
    print_success "Traffic switched to BLUE environment"
}

# Function to switch traffic to green
switch_to_green() {
    print_status "Switching traffic to GREEN (preview) environment..."
    
    # Check green environment health
    if ! check_environment_health "green"; then
        print_error "Cannot switch to green environment - health check failed"
        exit 1
    fi
    
    # Update nginx configuration to route to green
    kubectl patch configmap $CONFIGMAP_NAME -n $NAMESPACE --patch '{
        "data": {
            "nginx.conf": "events {\n  worker_connections 1024;\n}\n\nhttp {\n  upstream blue {\n    server api-gateway-blue.devops-e2e-blue.svc.cluster.local:3000;\n  }\n\n  upstream green {\n    server api-gateway-green.devops-e2e-green.svc.cluster.local:3000;\n  }\n\n  # Route to green (preview)\n  upstream active {\n    server api-gateway-green.devops-e2e-green.svc.cluster.local:3000;\n  }\n\n  server {\n    listen 80;\n\n    location / {\n      proxy_pass http://active;\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto $scheme;\n    }\n\n    location /health {\n      proxy_pass http://active;\n    }\n\n    location /metrics {\n      proxy_pass http://active;\n    }\n  }\n}"
        }'
    
    # Restart traffic router to pick up new configuration
    kubectl rollout restart deployment $DEPLOYMENT_NAME -n $NAMESPACE
    
    # Wait for rollout to complete
    kubectl rollout status deployment $DEPLOYMENT_NAME -n $NAMESPACE --timeout=60s
    
    print_success "Traffic switched to GREEN environment"
}

# Function to show current traffic status
show_status() {
    print_status "Current deployment status:"
    
    echo ""
    echo "=== BLUE ENVIRONMENT ==="
    kubectl get pods -n devops-e2e-blue -l app=api-gateway,version=blue
    
    echo ""
    echo "=== GREEN ENVIRONMENT ==="
    kubectl get pods -n devops-e2e-green -l app=api-gateway,version=green
    
    echo ""
    echo "=== TRAFFIC ROUTER ==="
    kubectl get pods -n $NAMESPACE -l app=traffic-router
    
    echo ""
    echo "=== CURRENT TRAFFIC ROUTING ==="
    local config=$(kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o jsonpath='{.data.nginx\.conf}')
    if echo "$config" | grep -q "server api-gateway-blue"; then
        echo "🟦 Traffic is currently routed to BLUE (stable) environment"
    elif echo "$config" | grep -q "server api-gateway-green"; then
        echo "🟩 Traffic is currently routed to GREEN (preview) environment"
    else
        echo "❓ Traffic routing status unknown"
    fi
}

# Function to deploy new version to green environment
deploy_to_green() {
    local image_tag=$1
    
    if [ -z "$image_tag" ]; then
        print_error "Please provide an image tag for deployment"
        echo "Usage: $0 deploy-green <image-tag>"
        exit 1
    fi
    
    print_status "Deploying new version to GREEN environment..."
    
    # Update green deployment with new image
    kubectl set image deployment/api-gateway-green api-gateway=ghcr.io/laxmideepak/devops-e2e-api-gateway:$image_tag -n devops-e2e-green
    
    # Wait for rollout to complete
    kubectl rollout status deployment/api-gateway-green -n devops-e2e-green --timeout=300s
    
    # Check health
    if check_environment_health "green"; then
        print_success "New version deployed to GREEN environment successfully"
    else
        print_error "Deployment to GREEN environment failed"
        exit 1
    fi
}

# Function to rollback green environment
rollback_green() {
    print_status "Rolling back GREEN environment..."
    
    kubectl rollout undo deployment/api-gateway-green -n devops-e2e-green
    
    # Wait for rollout to complete
    kubectl rollout status deployment/api-gateway-green -n devops-e2e-green --timeout=300s
    
    if check_environment_health "green"; then
        print_success "GREEN environment rolled back successfully"
    else
        print_error "Rollback of GREEN environment failed"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Blue-Green Deployment Traffic Switch Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  switch-blue          Switch traffic to BLUE (stable) environment"
    echo "  switch-green         Switch traffic to GREEN (preview) environment"
    echo "  status               Show current deployment status"
    echo "  deploy-green <tag>   Deploy new version to GREEN environment"
    echo "  rollback-green       Rollback GREEN environment to previous version"
    echo "  help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 switch-blue"
    echo "  $0 switch-green"
    echo "  $0 deploy-green v1.1.0"
    echo "  $0 status"
}

# Main execution
main() {
    case "${1:-help}" in
        "switch-blue")
            switch_to_blue
            ;;
        "switch-green")
            switch_to_green
            ;;
        "status")
            show_status
            ;;
        "deploy-green")
            deploy_to_green "$2"
            ;;
        "rollback-green")
            rollback_green
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
