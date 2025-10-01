# Unified Mail Platform

A comprehensive, production-ready unified mail viewing platform that aggregates messages from multiple mail providers (Gmail, Office365, IMAP, ProtonMail) into a single interface for support analyst teams.

## Architecture Overview

```
┌─────────────────┐
│  React Frontend │ ← Analyst Web UI
└────────┬────────┘
         │ HTTPS/JWT
         ▼
┌─────────────────────────┐
│  Express API Gateway    │ ← REST API, Auth, RBAC
└────────┬────────────────┘
         │
    ┌────┴────┬──────────┬───────────┐
    ▼         ▼          ▼           ▼
┌──────┐ ┌──────┐ ┌─────────┐ ┌───────────┐
│ PG DB│ │Redis │ │  Vault  │ │  MinIO/S3 │
└──────┘ └───┬──┘ └─────────┘ └───────────┘
             │ Bull Queues
             ▼
    ┌────────────────────┐
    │  Worker Services   │
    │ - Gmail Sync       │
    │ - O365 Sync        │
    │ - IMAP Sync        │
    │ - Search Indexer   │
    │ - Outbound Sender  │
    └────────────────────┘
```

## Features

- **Multi-Provider Support**: Gmail, Office365, IMAP/POP3, ProtonMail Bridge
- **OAuth 2.0 Authentication**: Secure token management for Gmail and Microsoft accounts
- **Unified Inbox**: Single interface for all email accounts
- **Full-Text Search**: Elasticsearch-powered search with filters
- **Thread Management**: Intelligent email threading
- **Reply/Forward**: Send emails via appropriate provider
- **RBAC**: Role-based access control for analysts
- **Audit Logging**: Complete activity tracking
- **Encryption**: End-to-end security with Vault credential storage
- **Scalable**: Queue-based architecture with horizontal scaling

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+
- Redis 7+

### Development Setup

```bash
cd unified-mail-platform
docker-compose up -d
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Visit `http://localhost:3001` for the UI

## Project Structure

```
unified-mail-platform/
├── backend/
│   ├── src/
│   │   ├── api/          # Express routes
│   │   ├── workers/      # Queue workers
│   │   ├── services/     # Business logic
│   │   ├── adapters/     # Provider adapters
│   │   ├── models/       # Database models
│   │   └── utils/        # Utilities
│   ├── migrations/       # DB migrations
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom hooks
│   │   ├── store/        # Zustand state
│   │   └── api/          # API client
│   └── public/
├── infrastructure/
│   ├── docker-compose.yml
│   ├── k8s/              # Kubernetes manifests
│   ├── terraform/        # Cloud infrastructure
│   └── monitoring/       # Prometheus/Grafana
└── docs/
    ├── api-spec.yaml     # OpenAPI spec
    ├── deployment.md
    └── security.md
```

## Documentation

- [API Documentation](./docs/api-spec.yaml)
- [Deployment Guide](./docs/deployment.md)
- [Security Guidelines](./docs/security.md)
- [Provider Integration](./docs/providers.md)

## License

MIT License - See LICENSE file
