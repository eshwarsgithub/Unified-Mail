import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './utils/database';
import { vaultService } from './services/vault.service';
import { storageService } from './services/storage.service';
import { searchService } from './services/search.service';

const app: Express = express();
const serverLogger = logger.child({ context: 'server' });

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
if (config.enableCors) {
  const origins = config.allowedOrigins.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
}

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    serverLogger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const [dbHealth, vaultHealth, storageHealth, searchHealth, queueHealth] = await Promise.all([
      db.healthCheck(),
      vaultService.healthCheck(),
      storageService.healthCheck(),
      searchService.healthCheck(),
      checkQueueHealth(),
    ]);

    const checks = {
      database: dbHealth,
      vault: vaultHealth,
      storage: storageHealth,
      search: searchHealth,
      queues: queueHealth,
    };

    const allHealthy = Object.values([dbHealth, vaultHealth, storageHealth, searchHealth]).every(
      (check) => check === true
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    serverLogger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

// API routes
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Unified Mail Platform API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs',
  });
});

// Import routes
import authRoutes from './api/auth.routes';
import accountsRoutes from './api/accounts.routes';
import messagesRoutes from './api/messages.routes';
import { checkQueueHealth } from './queues';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/messages', messagesRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  serverLogger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Initialize services and start server
async function startServer() {
  try {
    serverLogger.info('Initializing services...');

    // Initialize Vault
    await vaultService.initialize();
    serverLogger.info('✓ Vault initialized');

    // Initialize Storage
    await storageService.initialize();
    serverLogger.info('✓ Storage initialized');

    // Initialize Search
    await searchService.initialize();
    serverLogger.info('✓ Search initialized');

    // Test database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    serverLogger.info('✓ Database connected');

    // Start server
    app.listen(config.port, () => {
      serverLogger.info(`🚀 Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        apiUrl: config.apiBaseUrl,
      });
    });
  } catch (error) {
    serverLogger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  serverLogger.info('SIGTERM received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  serverLogger.info('SIGINT received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
