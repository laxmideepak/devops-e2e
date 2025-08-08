#!/bin/bash

# DevOps E2E Platform Helm Deployment Script
# This script deploys the complete platform to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="devops-e2e"
RELEASE_NAME="devops-e2e"
CHART_PATH="./infrastructure/helm"
VALUES_FILE="${CHART_PATH}/values.yaml"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        print_error "Helm is not installed. Please install Helm first."
        exit 1
    fi
    
    # Check if we can connect to Kubernetes cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    print_success "Prerequisites check passed!"
}

# Function to create namespace
create_namespace() {
    print_status "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        print_warning "Namespace $NAMESPACE already exists."
    else
        kubectl create namespace $NAMESPACE
        print_success "Namespace $NAMESPACE created successfully!"
    fi
}

# Function to deploy PostgreSQL
deploy_postgresql() {
    print_status "Deploying PostgreSQL with pgVector..."
    
    # Add Bitnami repository if not already added
    if ! helm repo list | grep -q "bitnami"; then
        helm repo add bitnami https://charts.bitnami.com/bitnami
        helm repo update
    fi
    
    # Deploy PostgreSQL
    helm install postgresql bitnami/postgresql \
        --namespace $NAMESPACE \
        --set auth.postgresPassword="devops-e2e-password" \
        --set auth.database="devops_e2e" \
        --set primary.persistence.size=10Gi \
        --set primary.resources.requests.memory=256Mi \
        --set primary.resources.requests.cpu=250m \
        --set primary.resources.limits.memory=1Gi \
        --set primary.resources.limits.cpu=500m \
        --wait --timeout=10m
    
    print_success "PostgreSQL deployed successfully!"
}

# Function to deploy Redis
deploy_redis() {
    print_status "Deploying Redis..."
    
    # Deploy Redis
    helm install redis bitnami/redis \
        --namespace $NAMESPACE \
        --set auth.enabled=false \
        --set master.persistence.size=5Gi \
        --set master.resources.requests.memory=128Mi \
        --set master.resources.requests.cpu=100m \
        --set master.resources.limits.memory=512Mi \
        --set master.resources.limits.cpu=200m \
        --wait --timeout=10m
    
    print_success "Redis deployed successfully!"
}

# Function to deploy the main application
deploy_application() {
    print_status "Deploying DevOps E2E Platform..."
    
    # Deploy the main chart
    helm install $RELEASE_NAME $CHART_PATH \
        --namespace $NAMESPACE \
        --values $VALUES_FILE \
        --wait --timeout=15m
    
    print_success "DevOps E2E Platform deployed successfully!"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    print_status "Deploying monitoring stack..."
    
    # Add Prometheus repository
    if ! helm repo list | grep -q "prometheus-community"; then
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
    fi
    
    # Deploy Prometheus
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace $NAMESPACE \
        --set grafana.enabled=true \
        --set grafana.adminPassword="admin" \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
        --wait --timeout=10m
    
    print_success "Monitoring stack deployed successfully!"
}

# Function to show deployment status
show_status() {
    print_status "Checking deployment status..."
    
    echo ""
    echo "=== POD STATUS ==="
    kubectl get pods -n $NAMESPACE
    
    echo ""
    echo "=== SERVICES ==="
    kubectl get services -n $NAMESPACE
    
    echo ""
    echo "=== INGRESS ==="
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    echo "=== PERSISTENT VOLUMES ==="
    kubectl get pvc -n $NAMESPACE
}

# Function to show access information
show_access_info() {
    print_status "Access Information:"
    
    echo ""
    echo "=== API GATEWAY ==="
    echo "External IP: $(kubectl get service -n $NAMESPACE ${RELEASE_NAME}-api-gateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
    echo "Port: 3000"
    
    echo ""
    echo "=== GRAFANA ==="
    echo "URL: http://$(kubectl get service -n $NAMESPACE prometheus-grafana -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):80"
    echo "Username: admin"
    echo "Password: admin"
    
    echo ""
    echo "=== PROMETHEUS ==="
    echo "URL: http://$(kubectl get service -n $NAMESPACE prometheus-kube-prometheus-prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):9090"
}

# Function to cleanup
cleanup() {
    print_warning "Cleaning up deployment..."
    
    helm uninstall $RELEASE_NAME -n $NAMESPACE || true
    helm uninstall postgresql -n $NAMESPACE || true
    helm uninstall redis -n $NAMESPACE || true
    helm uninstall prometheus -n $NAMESPACE || true
    
    kubectl delete namespace $NAMESPACE || true
    
    print_success "Cleanup completed!"
}

# Main execution
main() {
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            create_namespace
            deploy_postgresql
            deploy_redis
            deploy_application
            deploy_monitoring
            show_status
            show_access_info
            ;;
        "status")
            show_status
            ;;
        "cleanup")
            cleanup
            ;;
        "help")
            echo "Usage: $0 [deploy|status|cleanup|help]"
            echo "  deploy  - Deploy the complete platform (default)"
            echo "  status  - Show deployment status"
            echo "  cleanup - Remove all deployments"
            echo "  help    - Show this help message"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
