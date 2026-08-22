# CloudCrafter

CloudCrafter is a cloud-native microservices project built with Node.js, Docker, Kubernetes, LocalStack, and GitOps tooling. It demonstrates microservice deployment, ingress routing, LocalStack S3 + Lambda event triggers, JWT key rotation, monitoring with Prometheus/Loki/Grafana, and CI/CD automation.

## Project Structure

- `services/` — four Node.js microservices:
  - `users/` — authentication, JWT issuance, and verification
  - `events/` — event listing and creation
  - `tickets/` — ticket issuance and receipt generation
  - `notifications/` — notification log endpoint
- `k8s/` — Kubernetes deployment/service manifests and supporting config
- `charts/` — Helm charts for each service and monitoring stack
- `localstack/` — LocalStack Compose config and Lambda source
- `.github/workflows/` — CI pipeline configuration

## Tech Stack

- Node.js 18
- Express
- Docker / Docker Compose
- Kubernetes / Minikube / kubectl
- NGINX Ingress
- LocalStack
- AWS S3 + Lambda (LocalStack-compatible)
- Helm
- Prometheus
- Loki
- Grafana
- GitHub Actions
- Argo CD

## Quick Start

### 1) Install dependencies

From the project root:

```bash
for dir in services/*; do
  if [ -f "$dir/package.json" ]; then
    npm install --prefix "$dir"
  fi
done
```

### 2) Run services locally

Each service listens on its own local port for validation:

- Users: `http://localhost:3001/health`
- Events: `http://localhost:3002/health`
- Tickets: `http://localhost:3003/health`
- Notifications: `http://localhost:3004/health`

Example:

```powershell
cd services\users
$env:PORT = "3001"
node server.js
```

### 3) Start LocalStack

Set your token in PowerShell:

```powershell
$env:LOCALSTACK_AUTH_TOKEN = "ls-..."
```

Then start LocalStack:

```powershell
docker compose -f "localstack\docker-compose.yml" up -d
```

### 4) Create LocalStack resources

```powershell
powershell -ExecutionPolicy Bypass -File "localstack\setup-localstack.ps1"
```

This creates:

- S3 bucket: `cloudcrafter-receipts`
- Lambda: `cloudcrafter-notify`

### 5) Start service stack

Start Notifications and Tickets services with LocalStack enabled:

```powershell
cd services\notifications
$env:PORT = "3004"
node server.js
```

```powershell
cd services\tickets
$env:PORT = "3000"
$env:AWS_ENDPOINT_URL = "http://localhost:4566"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "us-east-1"
node server.js
```

Then test the ticket flow:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/tickets" -Method Post -ContentType "application/json" -Body '{"eventId":1,"userId":7}'
```

If LocalStack is working, the ticket triggers the Lambda and creates a notification.

## Kubernetes

### Apply the base manifests

```powershell
kubectl apply -f k8s\
```

This includes:

- Deployments and Services for users, events, tickets, notifications
- Ingress config
- JWT Secret for the users service
- namespaces manifest

## Helm

Each service includes a Helm chart under `charts/`.

Example dry run:

```powershell
helm template users .\charts\users
```

## Monitoring

The repo includes a monitoring chart with:

- Prometheus
- Loki
- Grafana

This is intended to collect metrics/logs and visualize them together in a unified dashboard.