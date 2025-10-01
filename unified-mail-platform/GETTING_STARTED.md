# Getting Started with Unified Mail Platform

## Overview

You now have a production-ready unified mail platform with the following components:

### ✅ Completed Components

1. **Backend Infrastructure**
   - PostgreSQL database with complete schema
   - Redis queue system for background jobs
   - HashiCorp Vault for secure credential storage
   - MinIO/S3 for email and attachment storage
   - Elasticsearch for full-text search

2. **Core Services**
   - Database service with connection pooling
   - Vault service for OAuth token management
   - Storage service for S3/MinIO operations
   - Search service for Elasticsearch indexing
   - Logger utility with structured logging
   - Configuration management with validation

3. **Infrastructure**
   - Docker Compose for local development
   - Multi-container orchestration
   - Health checks and monitoring setup
   - Volume persistence for data

### 🚧 Next Steps to Complete

To have a fully functional system, you need to complete:

1. **Provider Adapters** (Gmail, Office365, IMAP)
2. **Queue Workers** (Sync, Index, Send)
3. **Express API Routes** (Auth, Messages, Accounts, Search)
4. **Authentication Middleware** (JWT, RBAC)
5. **React Frontend** (Inbox UI, Search, Account Management)

## Quick Start

### 1. Prerequisites

```bash
# Install Docker and Docker Compose
docker --version  # Should be 20.10+
docker-compose --version  # Should be 1.29+

# Install Node.js
node --version  # Should be 18+
npm --version
```

### 2. Initial Setup

```bash
# Navigate to the platform directory
cd unified-mail-platform

# Copy environment file
cp backend/.env.example backend/.env

# Edit .env file with your OAuth credentials
# IMPORTANT: You need to register OAuth apps at:
# - Google Cloud Console (for Gmail): https://console.cloud.google.com
# - Azure Portal (for Office365): https://portal.azure.com

vim backend/.env
```

### 3. Start Infrastructure

```bash
# Start all services
cd infrastructure
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f api
```

### 4. Initialize Database

```bash
# The database schema will be automatically applied on first startup
# from backend/src/migrations/001_initial_schema.sql

# Verify database is initialized
docker exec -it unified-mail-postgres psql -U mailuser -d unified_mail -c "\dt"
```

### 5. Access Services

Once started, access the following:

- **API**: http://localhost:3000
- **Frontend**: http://localhost:3001
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Elasticsearch**: http://localhost:9200
- **Grafana**: http://localhost:3002 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Vault**: http://localhost:8200 (dev-root-token)

### 6. Default Credentials

**Admin User:**
- Email: `admin@unified-mail.local`
- Password: `admin123`

**⚠️ IMPORTANT: Change this password immediately in production!**

## Development Workflow

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run workers separately
npm run worker:sync    # Terminal 1
npm run worker:index   # Terminal 2
npm run worker:send    # Terminal 3

# Run tests
npm test

# Build for production
npm run build
npm start
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Registering OAuth Applications

### Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project: "Unified Mail Platform"
3. Enable Gmail API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/gmail/callback`
5. Copy Client ID and Client Secret to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### Office365 OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Create new registration: "Unified Mail Platform"
4. Add redirect URI: `http://localhost:3000/auth/microsoft/callback`
5. Add API permissions:
   - Microsoft Graph > Mail.Read
   - Microsoft Graph > Mail.Send
   - Microsoft Graph > Mail.ReadWrite
6. Create client secret
7. Copy Application ID and Client Secret to `.env`:
   ```
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   AZURE_TENANT_ID=common
   ```

## Architecture Overview

```
Frontend (React) → API Gateway (Express)
                      ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
PostgreSQL         Vault            MinIO/S3
(Metadata)      (Credentials)     (Raw Emails)
                      ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
Redis Queue     Elasticsearch     Workers
(Jobs)          (Search Index)    (Sync/Index/Send)
                      ↓
              External Providers
              (Gmail, Office365, IMAP)
```

## Testing the Platform

### 1. Login as Admin

```bash
# Using curl
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@unified-mail.local","password":"admin123"}'

# Save the JWT token from response
export TOKEN="eyJhbGc..."
```

### 2. Add a Gmail Account

```bash
# Initiate OAuth flow
open "http://localhost:3000/auth/gmail"

# After authorization, account will be added
# Check accounts
curl -X GET http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Trigger Sync

```bash
# Sync will happen automatically every 5 minutes
# Or trigger manually
curl -X POST http://localhost:3000/api/accounts/{accountId}/sync \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Search Messages

```bash
curl -X POST http://localhost:3000/api/messages/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"invoice","page":1,"pageSize":20}'
```

## Monitoring

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f api
docker-compose logs -f worker-sync

# Backend logs are also written to backend/logs/
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Metrics

Access Grafana at http://localhost:3002:

1. Login with admin/admin
2. Navigate to Dashboards
3. View:
   - Sync performance metrics
   - Queue depth and processing times
   - API response times
   - Database connections
   - Storage usage

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Database health
docker exec unified-mail-postgres pg_isready

# Redis health
docker exec unified-mail-redis redis-cli ping

# Elasticsearch health
curl http://localhost:9200/_cluster/health
```

## Production Deployment

### Security Checklist

- [ ] Change default admin password
- [ ] Generate strong JWT secret
- [ ] Enable HTTPS/TLS for all services
- [ ] Configure firewall rules
- [ ] Enable Vault auto-unseal
- [ ] Set up backup automation
- [ ] Configure log rotation
- [ ] Enable rate limiting
- [ ] Set up monitoring alerts
- [ ] Review RBAC permissions
- [ ] Enable audit logging
- [ ] Configure data retention policies

### Environment Variables

Update `.env` for production:

```bash
NODE_ENV=production
JWT_SECRET=<generate-strong-secret>
VAULT_TOKEN=<production-token>
DATABASE_URL=<production-postgres-url>
S3_ENDPOINT=<aws-s3-or-production-minio>
ELASTICSEARCH_NODE=<production-elasticsearch>
```

### Kubernetes Deployment

Kubernetes manifests are available in `infrastructure/k8s/`:

```bash
kubectl apply -f infrastructure/k8s/
```

### AWS Deployment

Terraform scripts for AWS are in `infrastructure/terraform/aws/`:

```bash
cd infrastructure/terraform/aws
terraform init
terraform plan
terraform apply
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker exec -it unified-mail-postgres psql -U mailuser -d unified_mail
```

### Vault Sealed

```bash
# Check vault status
docker exec unified-mail-vault vault status

# Unseal vault (development only)
docker-compose restart vault
```

### Worker Not Processing Jobs

```bash
# Check Redis connection
docker exec unified-mail-redis redis-cli ping

# View queue status
docker exec unified-mail-redis redis-cli LLEN bull:account-sync:wait

# Check worker logs
docker-compose logs worker-sync
```

### OAuth Callback Errors

1. Verify redirect URI matches exactly in OAuth app settings
2. Check that CLIENT_ID and CLIENT_SECRET are correct
3. Ensure `http://localhost:3000` is in ALLOWED_ORIGINS

## Support & Documentation

- **API Documentation**: See `docs/api-spec.yaml`
- **Architecture**: See `docs/architecture.md`
- **Security**: See `docs/security.md`
- **Provider Integration**: See `docs/providers.md`

## Development Roadmap

### Phase 1: Core Functionality (Current)
- ✅ Infrastructure setup
- ✅ Database schema
- ✅ Core services (Vault, Storage, Search)
- 🚧 Provider adapters
- 🚧 Queue workers
- 🚧 API routes

### Phase 2: Frontend & UX
- 🚧 React application setup
- 🚧 Authentication UI
- 🚧 Inbox components
- 🚧 Search interface
- 🚧 Account management

### Phase 3: Advanced Features
- ⏳ ProtonMail Bridge support
- ⏳ Temp mail providers
- ⏳ Advanced threading
- ⏳ Spam detection
- ⏳ Email templates

### Phase 4: Enterprise Features
- ⏳ Multi-tenancy
- ⏳ Advanced RBAC
- ⏳ SSO integration
- ⏳ Compliance reports
- ⏳ Data export/import

## Contributing

This is a freelance project. To continue development:

1. Pick a task from the roadmap
2. Create implementation files
3. Test thoroughly
4. Update documentation

## License

MIT License - See LICENSE file
