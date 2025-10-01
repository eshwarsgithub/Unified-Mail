# Unified Mail Platform

A production-ready unified mail platform integrating multiple email providers (Gmail, Office365, IMAP, ProtonMail) with advanced features.

## ⚠️ Important: Not Compatible with Vercel

This application requires **long-running processes, persistent databases, and background workers**. It cannot be deployed to Vercel (serverless platform).

**✅ Recommended Platforms:** Railway, Render, DigitalOcean App Platform, AWS ECS, or VPS with Docker

See [DEPLOYMENT_OPTIONS.md](./DEPLOYMENT_OPTIONS.md) for detailed deployment instructions.

## Features

- **Multi-Provider Support**: Gmail, Office365, IMAP, ProtonMail
- **Unified Inbox**: Single interface for all email accounts
- **OAuth Authentication**: Secure authentication flow
- **Message Syncing**: Real-time synchronization
- **Full-Text Search**: Elasticsearch-powered search
- **Thread Management**: Email threading and organization
- **Labels & Folders**: Tag and organize emails
- **Attachments**: Handle file attachments
- **Reply/Forward**: Full email composition
- **Audit Logging**: Complete audit trail

## Documentation

- **[Deployment Options](./DEPLOYMENT_OPTIONS.md)** - How to deploy (Railway, Render, DO, AWS, VPS)
- [Getting Started](./unified-mail-platform/GETTING_STARTED.md) - Local development setup
- [Deployment Guide](./unified-mail-platform/DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [Project Status](./unified-mail-platform/PROJECT_STATUS.md) - Current implementation status
- [Backend Complete](./unified-mail-platform/BACKEND_COMPLETE.md) - Backend features

## Quick Start (Local Development)

```bash
# Clone repository
git clone https://github.com/eshwarsgithub/Unified-Mail.git
cd Unified-Mail/unified-mail-platform

# Setup environment
cd backend
cp .env.example .env
cd ..

# Start infrastructure
cd infrastructure
docker-compose up -d
cd ..

# Run backend
cd backend
npm install
npm run migrate
npm run dev

# Run frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Access at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## Production Deployment

See [DEPLOYMENT_OPTIONS.md](./DEPLOYMENT_OPTIONS.md) for platform-specific deployment guides.

**Quick Deploy to Railway:**
1. Fork this repository
2. Go to [railway.app](https://railway.app)
3. Click "Deploy from GitHub"
4. Add PostgreSQL and Redis services
5. Configure environment variables
6. Deploy!
