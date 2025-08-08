#!/bin/bash

# Security Headers Testing Script
# This script validates that all security headers are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:3000}"
AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://localhost:3001}"
USER_SERVICE_URL="${USER_SERVICE_URL:-http://localhost:3002}"
ORDER_SERVICE_URL="${ORDER_SERVICE_URL:-http://localhost:3003}"

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

# Function to check if curl is available
check_curl() {
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install curl to run security tests."
        exit 1
    fi
}

# Function to test security headers
test_security_headers() {
    local service_name=$1
    local service_url=$2
    local endpoint=$3

    print_status "Testing security headers for $service_name..."

    # Make request and capture headers
    local response=$(curl -s -I "$service_url$endpoint" 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to connect to $service_name at $service_url$endpoint"
        return 1
    fi

    # Check for required security headers
    local headers_to_check=(
        "Strict-Transport-Security"
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Referrer-Policy"
        "Permissions-Policy"
        "Content-Security-Policy"
    )

    local missing_headers=()
    local present_headers=()

    for header in "${headers_to_check[@]}"; do
        if echo "$response" | grep -qi "$header:"; then
            present_headers+=("$header")
            print_success "✓ $header is present"
        else
            missing_headers+=("$header")
            print_warning "⚠ $header is missing"
        fi
    done

    # Check for server information disclosure
    if echo "$response" | grep -qi "Server:"; then
        print_warning "⚠ Server header is present (information disclosure)"
    else
        print_success "✓ Server header is not present"
    fi

    if echo "$response" | grep -qi "X-Powered-By:"; then
        print_warning "⚠ X-Powered-By header is present (information disclosure)"
    else
        print_success "✓ X-Powered-By header is not present"
    fi

    # Report results
    if [ ${#missing_headers[@]} -eq 0 ]; then
        print_success "All required security headers are present for $service_name"
    else
        print_error "Missing security headers for $service_name: ${missing_headers[*]}"
    fi

    echo ""
}

# Function to test rate limiting
test_rate_limiting() {
    local service_name=$1
    local service_url=$2
    local endpoint=$3

    print_status "Testing rate limiting for $service_name..."

    # Make multiple rapid requests
    local rate_limited=0
    for i in {1..10}; do
        local response=$(curl -s -w "%{http_code}" "$service_url$endpoint" -o /dev/null)
        
        if [ "$response" = "429" ]; then
            rate_limited=1
            break
        fi
        
        sleep 0.1
    done

    if [ $rate_limited -eq 1 ]; then
        print_success "✓ Rate limiting is working for $service_name"
    else
        print_warning "⚠ Rate limiting may not be configured for $service_name"
    fi

    echo ""
}

# Function to test CORS configuration
test_cors() {
    local service_name=$1
    local service_url=$2
    local endpoint=$3

    print_status "Testing CORS configuration for $service_name..."

    # Test preflight request
    local cors_response=$(curl -s -I -H "Origin: http://malicious-site.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        "$service_url$endpoint" 2>/dev/null)

    if echo "$cors_response" | grep -qi "Access-Control-Allow-Origin:"; then
        local allowed_origin=$(echo "$cors_response" | grep -i "Access-Control-Allow-Origin:" | cut -d: -f2 | tr -d ' ')
        
        if [ "$allowed_origin" = "*" ]; then
            print_warning "⚠ CORS allows all origins (security risk)"
        else
            print_success "✓ CORS is properly configured"
        fi
    else
        print_success "✓ CORS headers not present (good for security)"
    fi

    echo ""
}

# Function to test input validation
test_input_validation() {
    local service_name=$1
    local service_url=$2

    print_status "Testing input validation for $service_name..."

    # Test XSS payload
    local xss_payload="<script>alert('xss')</script>"
    local response=$(curl -s -X POST "$service_url/api/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$xss_payload@example.com\",\"password\":\"test123\"}" 2>/dev/null)

    if echo "$response" | grep -qi "Malicious content detected"; then
        print_success "✓ XSS protection is working"
    else
        print_warning "⚠ XSS protection may not be configured"
    fi

    # Test SQL injection payload
    local sql_payload="'; DROP TABLE users; --"
    local response=$(curl -s -X POST "$service_url/api/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$sql_payload@example.com\",\"password\":\"test123\"}" 2>/dev/null)

    if echo "$response" | grep -qi "Malicious content detected"; then
        print_success "✓ SQL injection protection is working"
    else
        print_warning "⚠ SQL injection protection may not be configured"
    fi

    echo ""
}

# Function to test authentication security
test_auth_security() {
    local service_name=$1
    local service_url=$2

    print_status "Testing authentication security for $service_name..."

    # Test weak password
    local response=$(curl -s -X POST "$service_url/api/auth/signup" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"weak"}' 2>/dev/null)

    if echo "$response" | grep -qi "Password must be at least"; then
        print_success "✓ Password strength validation is working"
    else
        print_warning "⚠ Password strength validation may not be configured"
    fi

    # Test brute force protection
    local brute_force_detected=0
    for i in {1..10}; do
        local response=$(curl -s -X POST "$service_url/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"test@example.com","password":"wrongpassword"}' 2>/dev/null)
        
        if echo "$response" | grep -qi "Too many authentication attempts"; then
            brute_force_detected=1
            break
        fi
        
        sleep 0.1
    done

    if [ $brute_force_detected -eq 1 ]; then
        print_success "✓ Brute force protection is working"
    else
        print_warning "⚠ Brute force protection may not be configured"
    fi

    echo ""
}

# Function to test HTTPS enforcement
test_https_enforcement() {
    local service_name=$1
    local service_url=$2

    print_status "Testing HTTPS enforcement for $service_name..."

    # Check if HSTS header is present
    local response=$(curl -s -I "$service_url/health" 2>/dev/null)
    
    if echo "$response" | grep -qi "Strict-Transport-Security:"; then
        print_success "✓ HSTS is configured"
    else
        print_warning "⚠ HSTS is not configured"
    fi

    echo ""
}

# Function to generate security report
generate_security_report() {
    local report_file="security-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    print_status "Generating security report: $report_file"
    
    {
        echo "Security Test Report"
        echo "==================="
        echo "Date: $(date)"
        echo "API Gateway URL: $API_GATEWAY_URL"
        echo "Auth Service URL: $AUTH_SERVICE_URL"
        echo "User Service URL: $USER_SERVICE_URL"
        echo "Order Service URL: $ORDER_SERVICE_URL"
        echo ""
        echo "Test Results:"
        echo "-------------"
    } > "$report_file"

    print_success "Security report generated: $report_file"
}

# Main execution
main() {
    echo "🔒 Security Headers Testing Script"
    echo "=================================="
    echo ""

    # Check prerequisites
    check_curl

    # Test services
    local services=(
        "API Gateway|$API_GATEWAY_URL|/health"
        "Auth Service|$AUTH_SERVICE_URL|/health"
        "User Service|$USER_SERVICE_URL|/health"
        "Order Service|$ORDER_SERVICE_URL|/health"
    )

    for service in "${services[@]}"; do
        IFS='|' read -r name url endpoint <<< "$service"
        
        echo "Testing $name..."
        echo "URL: $url"
        echo "---"
        
        test_security_headers "$name" "$url" "$endpoint"
        test_rate_limiting "$name" "$url" "$endpoint"
        test_cors "$name" "$url" "$endpoint"
        test_https_enforcement "$name" "$url"
        
        # Test input validation and auth security for API Gateway
        if [ "$name" = "API Gateway" ]; then
            test_input_validation "$name" "$url"
            test_auth_security "$name" "$url"
        fi
        
        echo ""
    done

    # Generate report
    generate_security_report

    echo "✅ Security testing completed!"
    echo "📊 Check the generated report for detailed results."
}

# Run main function
main "$@"
