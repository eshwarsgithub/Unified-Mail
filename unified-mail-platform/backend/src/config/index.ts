import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  apiBaseUrl: z.string().default('http://localhost:3000'),

  // Database
  databaseUrl: z.string(),
  databasePoolSize: z.coerce.number().default(20),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),
  redisPassword: z.string().optional(),

  // Vault
  vaultAddr: z.string().default('http://localhost:8200'),
  vaultToken: z.string(),
  vaultNamespace: z.string().optional(),

  // S3/MinIO
  s3Endpoint: z.string().default('http://localhost:9000'),
  s3AccessKey: z.string(),
  s3SecretKey: z.string(),
  s3Bucket: z.string().default('unified-mail'),
  s3Region: z.string().default('us-east-1'),
  s3UseSsl: z.coerce.boolean().default(false),

  // Elasticsearch
  elasticsearchNode: z.string().default('http://localhost:9200'),
  elasticsearchUsername: z.string().optional(),
  elasticsearchPassword: z.string().optional(),
  elasticsearchIndex: z.string().default('messages'),

  // JWT
  jwtSecret: z.string(),
  jwtIssuer: z.string().default('unified-mail-platform'),
  jwtAudience: z.string().default('unified-mail-api'),
  jwtExpiresIn: z.string().default('24h'),

  // OIDC
  oidcIssuerUrl: z.string().optional(),
  oidcClientId: z.string().optional(),
  oidcClientSecret: z.string().optional(),
  oidcCallbackUrl: z.string().optional(),

  // Gmail OAuth
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleRedirectUri: z.string().optional(),

  // Microsoft OAuth
  azureClientId: z.string().optional(),
  azureClientSecret: z.string().optional(),
  azureTenantId: z.string().default('common'),
  azureRedirectUri: z.string().optional(),

  // Workers
  syncWorkerConcurrency: z.coerce.number().default(10),
  indexWorkerConcurrency: z.coerce.number().default(5),
  sendWorkerConcurrency: z.coerce.number().default(3),
  syncIntervalMinutes: z.coerce.number().default(5),

  // Rate Limiting
  gmailRequestsPerSecond: z.coerce.number().default(250),
  microsoftRequestsPer10Min: z.coerce.number().default(10000),
  imapConcurrentConnections: z.coerce.number().default(5),

  // Security
  bcryptRounds: z.coerce.number().default(12),
  enableCors: z.coerce.boolean().default(true),
  allowedOrigins: z.string().default('http://localhost:3001'),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'text']).default('json'),

  // Monitoring
  enableMetrics: z.coerce.boolean().default(true),
  metricsPort: z.coerce.number().default(9090),

  // Data Retention
  messageRetentionDays: z.coerce.number().default(90),
  auditLogRetentionDays: z.coerce.number().default(365),
});

const parseConfig = () => {
  const rawConfig = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    apiBaseUrl: process.env.API_BASE_URL,
    databaseUrl: process.env.DATABASE_URL,
    databasePoolSize: process.env.DATABASE_POOL_SIZE,
    redisUrl: process.env.REDIS_URL,
    redisPassword: process.env.REDIS_PASSWORD,
    vaultAddr: process.env.VAULT_ADDR,
    vaultToken: process.env.VAULT_TOKEN,
    vaultNamespace: process.env.VAULT_NAMESPACE,
    s3Endpoint: process.env.S3_ENDPOINT,
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION,
    s3UseSsl: process.env.S3_USE_SSL,
    elasticsearchNode: process.env.ELASTICSEARCH_NODE,
    elasticsearchUsername: process.env.ELASTICSEARCH_USERNAME,
    elasticsearchPassword: process.env.ELASTICSEARCH_PASSWORD,
    elasticsearchIndex: process.env.ELASTICSEARCH_INDEX,
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    oidcIssuerUrl: process.env.OIDC_ISSUER_URL,
    oidcClientId: process.env.OIDC_CLIENT_ID,
    oidcClientSecret: process.env.OIDC_CLIENT_SECRET,
    oidcCallbackUrl: process.env.OIDC_CALLBACK_URL,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
    azureClientId: process.env.AZURE_CLIENT_ID,
    azureClientSecret: process.env.AZURE_CLIENT_SECRET,
    azureTenantId: process.env.AZURE_TENANT_ID,
    azureRedirectUri: process.env.AZURE_REDIRECT_URI,
    syncWorkerConcurrency: process.env.SYNC_WORKER_CONCURRENCY,
    indexWorkerConcurrency: process.env.INDEX_WORKER_CONCURRENCY,
    sendWorkerConcurrency: process.env.SEND_WORKER_CONCURRENCY,
    syncIntervalMinutes: process.env.SYNC_INTERVAL_MINUTES,
    gmailRequestsPerSecond: process.env.GMAIL_REQUESTS_PER_SECOND,
    microsoftRequestsPer10Min: process.env.MICROSOFT_REQUESTS_PER_10MIN,
    imapConcurrentConnections: process.env.IMAP_CONCURRENT_CONNECTIONS,
    bcryptRounds: process.env.BCRYPT_ROUNDS,
    enableCors: process.env.ENABLE_CORS,
    allowedOrigins: process.env.ALLOWED_ORIGINS,
    logLevel: process.env.LOG_LEVEL,
    logFormat: process.env.LOG_FORMAT,
    enableMetrics: process.env.ENABLE_METRICS,
    metricsPort: process.env.METRICS_PORT,
    messageRetentionDays: process.env.MESSAGE_RETENTION_DAYS,
    auditLogRetentionDays: process.env.AUDIT_LOG_RETENTION_DAYS,
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const config = parseConfig();

export type Config = z.infer<typeof configSchema>;
