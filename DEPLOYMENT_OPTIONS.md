# Deployment Options for Unified Mail Platform

## ⚠️ Why Not Vercel?

This application is **NOT compatible with Vercel** because it requires:
- Long-running worker processes (Vercel has 10-60s function timeouts)
- Persistent database connections (PostgreSQL, Redis)
- Infrastructure services (Vault, MinIO, Elasticsearch)
- Background job processing (Bull queues)

Vercel is designed for serverless/JAMstack applications, not full-stack apps with infrastructure dependencies.

## ✅ Recommended Deployment Platforms

### 1. **Railway** (Easiest - Recommended for Quick Deploy)

Railway supports Docker and provides managed PostgreSQL, Redis.

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create new project
railway init

# Deploy
railway up
```

**Configure services in Railway:**
- PostgreSQL (managed)
- Redis (managed)
- Backend service (from Dockerfile)
- Frontend (static build or separate service)

**Estimated Cost:** $5-20/month

---

### 2. **Render** (Good for Full Stack Apps)

```yaml
# render.yaml
services:
  - type: web
    name: unified-mail-backend
    env: docker
    dockerfilePath: ./unified-mail-platform/backend/Dockerfile
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: unified-mail-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: unified-mail-redis
          property: connectionString

  - type: web
    name: unified-mail-frontend
    buildCommand: cd unified-mail-platform/frontend && npm install && npm run build
    startCommand: cd unified-mail-platform/frontend && npm run preview
    envVars:
      - key: VITE_API_URL
        value: https://unified-mail-backend.onrender.com

databases:
  - name: unified-mail-db
    databaseName: unified_mail
    user: mailuser

  - name: unified-mail-redis
    plan: starter
```

**Estimated Cost:** $7-25/month

---

### 3. **DigitalOcean App Platform**

Supports Docker containers and managed databases.

```yaml
# .do/app.yaml
name: unified-mail-platform
services:
  - name: backend
    dockerfile_path: unified-mail-platform/backend/Dockerfile
    envs:
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
      - key: REDIS_URL
        value: ${redis.DATABASE_URL}

  - name: frontend
    build_command: cd unified-mail-platform/frontend && npm install && npm run build
    run_command: cd unified-mail-platform/frontend && npm run preview

databases:
  - name: db
    engine: PG
    production: true

  - name: redis
    engine: REDIS
    production: true
```

**Estimated Cost:** $12-30/month

---

### 4. **AWS ECS/Fargate** (Production Scale)

For enterprise deployment with full control.

**Required Services:**
- ECS/Fargate for containers
- RDS PostgreSQL
- ElastiCache Redis
- S3 for storage
- OpenSearch/Elasticsearch
- Secrets Manager (instead of Vault)

**Estimated Cost:** $50-200+/month

---

### 5. **Docker Compose on VPS** (Most Control)

Deploy to any VPS (DigitalOcean Droplet, Linode, AWS EC2).

```bash
# On your VPS
git clone https://github.com/eshwarsgithub/Unified-Mail.git
cd Unified-Mail/unified-mail-platform

# Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Deploy all services
cd infrastructure
docker-compose up -d

# Deploy backend
cd ../backend
docker build -t unified-mail-backend .
docker run -d --network=infrastructure_default \
  --env-file .env \
  -p 3000:3000 \
  unified-mail-backend

# Deploy frontend (build and serve with nginx)
cd ../frontend
npm install && npm run build
# Serve dist/ with nginx or similar
```

**VPS Requirements:**
- 4GB RAM minimum
- 2 vCPUs
- 50GB storage

**Estimated Cost:** $20-40/month (VPS only)

---

## Quick Deploy: Railway (Recommended)

### Step 1: Prepare Repository

Add `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "unified-mail-platform/backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "npm run dev",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Step 2: Deploy

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `eshwarsgithub/Unified-Mail`
5. Add PostgreSQL database
6. Add Redis database
7. Configure environment variables (copy from `.env.example`)
8. Deploy!

---

## Environment Variables for Production

```bash
# Database (use managed service URLs)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis (use managed service URL)
REDIS_URL=redis://host:6379

# Secrets (generate secure values)
JWT_SECRET=$(openssl rand -hex 32)
VAULT_TOKEN=$(openssl rand -hex 32)

# Storage (use S3 or DigitalOcean Spaces)
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=unified-mail-prod

# OAuth (get from Google/Microsoft)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## Next Steps

1. Choose a deployment platform from the options above
2. Set up managed databases (PostgreSQL, Redis)
3. Configure environment variables
4. Deploy backend and frontend
5. Set up OAuth credentials (Gmail, Microsoft)
6. Configure custom domain (optional)

**Need help?** Check the detailed deployment guide in `unified-mail-platform/DEPLOYMENT_GUIDE.md`
