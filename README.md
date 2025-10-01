# Unified Mail Platform

A production-ready unified mail platform integrating multiple email providers (Gmail, Office365, IMAP, ProtonMail) with advanced features.

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

See the `unified-mail-platform` directory for complete documentation:

- [Getting Started](./unified-mail-platform/GETTING_STARTED.md)
- [Deployment Guide](./unified-mail-platform/DEPLOYMENT_GUIDE.md)
- [Project Status](./unified-mail-platform/PROJECT_STATUS.md)
- [Backend Complete](./unified-mail-platform/BACKEND_COMPLETE.md)

## Quick Start

```bash
cd unified-mail-platform/infrastructure
docker-compose up -d
cd ../backend
npm install
npm run dev
```

See [GETTING_STARTED.md](./unified-mail-platform/GETTING_STARTED.md) for detailed instructions.
