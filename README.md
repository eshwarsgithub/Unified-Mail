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

### Free Options (No Credit Card)
- **[Replit](./REPLIT_DEPLOY.md)** - 100% free, no card required (goes to sleep after inactivity)

### Paid Options (Better for Production)
See [DEPLOYMENT_OPTIONS.md](./DEPLOYMENT_OPTIONS.md) for detailed guides:
- **Railway** - $5/month (easiest, recommended)
- **Render** - $7/month (requires card even for free tier)
- **DigitalOcean** - $12/month
- **VPS** - $20/month (full control)

### OAuth Setup
See [OAUTH_SETUP.md](./OAUTH_SETUP.md) for Google Gmail integration setup.
