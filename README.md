go# 🚀 DevOps E2E Platform

A comprehensive end-to-end DevOps platform demonstrating modern microservices architecture with full CI/CD pipeline, monitoring, and security practices.

## 📋 Project Overview

This platform showcases a complete DevOps ecosystem with:
- **Microservices Architecture**: API Gateway, Auth Service, User Service, Order Service
- **Container Orchestration**: Kubernetes with Helm charts
- **CI/CD Pipeline**: GitHub Actions with automated testing and deployment
- **Monitoring Stack**: Prometheus, Grafana, Loki, Tempo
- **Security**: OWASP compliance, vulnerability scanning, pod security standards
- **Database**: PostgreSQL with pgVector for vector operations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │   Auth Service  │    │  User Service   │
│   (Node.js)     │    │   (Node.js)     │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Order Service  │
                    │   (Node.js)     │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (with pgVector)│
                    └─────────────────┘
```

## 🛠️ Technology Stack

### Backend Services
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Authentication**: JWT with refresh tokens
- **Database**: PostgreSQL 15+ with pgVector extension
- **Caching**: Redis (for session management)

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **Package Management**: Helm charts
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana, Loki, Tempo

### Security
- **Vulnerability Scanning**: Trivy, Snyk
- **Code Analysis**: CodeQL, Semgrep
- **Pod Security**: OWASP compliance
- **Network Policies**: Kubernetes network policies

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Kubernetes cluster (minikube/kind)
- Node.js 18+
- PostgreSQL 15+

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/laxmideepak/devops-e2e.git
   cd devops-e2e
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the database**
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Install dependencies and start services**
   ```bash
   # Install dependencies for all services
   npm run install:all
   
   # Start all services in development mode
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm run test:all
   ```

### Production Deployment

1. **Set up Kubernetes cluster**
   ```bash
   kind create cluster --name devops-e2e
   ```

2. **Deploy with Helm**
   ```bash
   helm install devops-e2e ./helm/
   ```

3. **Access the platform**
   - API Gateway: http://localhost:3000
   - Grafana: http://localhost:3001
   - Prometheus: http://localhost:9090

## 📊 Monitoring & Observability

### Metrics Dashboard
- **DORA Metrics**: Lead time, deployment frequency, change failure rate
- **Application Metrics**: Response times, error rates, throughput
- **Infrastructure Metrics**: CPU, memory, disk usage

### Logging
- **Centralized Logging**: Loki for log aggregation
- **Distributed Tracing**: Tempo for request tracing
- **Alerting**: Prometheus alertmanager

## 🔒 Security Features

- **OWASP Top 10 Compliance**: Security headers, input validation
- **Pod Security Standards**: Restricted security context
- **Network Policies**: Isolated service communication
- **Vulnerability Scanning**: Automated security checks in CI/CD

## 🧪 Testing Strategy

- **Unit Tests**: Jest for service testing
- **Integration Tests**: Service-to-service testing
- **E2E Tests**: Playwright for full user journey testing
- **Performance Tests**: Load testing with Artillery
- **Code Coverage**: Automated coverage reporting with Codecov
  - [![API Gateway Coverage](https://codecov.io/gh/laxmideepak/devops-e2e/branch/main/graph/badge.svg?flag=api-gateway)](https://codecov.io/gh/laxmideepak/devops-e2e?flag=api-gateway)
  - [![Auth Service Coverage](https://codecov.io/gh/laxmideepak/devops-e2e/branch/main/graph/badge.svg?flag=auth-service)](https://codecov.io/gh/laxmideepak/devops-e2e?flag=auth-service)
  - [![User Service Coverage](https://codecov.io/gh/laxmideepak/devops-e2e/branch/main/graph/badge.svg?flag=user-service)](https://codecov.io/gh/laxmideepak/devops-e2e?flag=user-service)
  - [![Order Service Coverage](https://codecov.io/gh/laxmideepak/devops-e2e/branch/main/graph/badge.svg?flag=order-service)](https://codecov.io/gh/laxmideepak/devops-e2e?flag=order-service)

## 📈 CI/CD Pipeline

### Automated Workflows
1. **Code Quality**: Linting, formatting, security scanning
2. **Testing**: Unit, integration, and E2E tests
3. **Code Coverage**: Automated coverage reporting and analysis
4. **Security**: Vulnerability scanning, dependency analysis
5. **Build**: Multi-platform Docker images
6. **Deploy**: Blue-green deployment to Kubernetes

### Deployment Strategy
- **Blue-Green Deployment**: Zero-downtime deployments
- **Canary Releases**: Gradual traffic shifting
- **Rollback**: Automatic rollback on health check failures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/laxmideepak/devops-e2e/issues)
- **Documentation**: [Wiki](https://github.com/laxmideepak/devops-e2e/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/laxmideepak/devops-e2e/discussions)

---

**Last Updated**: August 7, 2025  
**Version**: 1.0.0  
**Status**: 🟡 In Development
