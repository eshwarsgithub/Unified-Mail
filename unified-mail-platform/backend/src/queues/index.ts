import Bull, { Queue, Job } from 'bull';
import { config } from '../config';
import { logger } from '../utils/logger';

const queueLogger = logger.child({ context: 'queue' });

// Queue interfaces
export interface SyncJobData {
  accountId: string;
  sinceDate?: Date;
  maxMessages?: number;
}

export interface IndexJobData {
  messageId: string;
}

export interface SendJobData {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string[];
}

// Queue configuration
const queueConfig = {
  redis: {
    port: parseInt(config.redisUrl.split(':')[2] || '6379'),
    host: config.redisUrl.split('//')[1].split(':')[0],
    password: config.redisPassword,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
};

// Create queues
export const syncQueue: Queue<SyncJobData> = new Bull('account-sync', queueConfig);
export const indexQueue: Queue<IndexJobData> = new Bull('search-index', queueConfig);
export const sendQueue: Queue<SendJobData> = new Bull('outbound-send', queueConfig);

// Queue event handlers
syncQueue.on('completed', (job: Job) => {
  queueLogger.info('Sync job completed', {
    jobId: job.id,
    accountId: job.data.accountId,
    duration: job.finishedOn! - job.processedOn!,
  });
});

syncQueue.on('failed', (job: Job, err: Error) => {
  queueLogger.error('Sync job failed', {
    jobId: job.id,
    accountId: job.data.accountId,
    error: err.message,
    attempts: job.attemptsMade,
  });
});

indexQueue.on('completed', (job: Job) => {
  queueLogger.debug('Index job completed', {
    jobId: job.id,
    messageId: job.data.messageId,
  });
});

indexQueue.on('failed', (job: Job, err: Error) => {
  queueLogger.error('Index job failed', {
    jobId: job.id,
    messageId: job.data.messageId,
    error: err.message,
  });
});

sendQueue.on('completed', (job: Job) => {
  queueLogger.info('Send job completed', {
    jobId: job.id,
    to: job.data.to,
  });
});

sendQueue.on('failed', (job: Job, err: Error) => {
  queueLogger.error('Send job failed', {
    jobId: job.id,
    to: job.data.to,
    error: err.message,
  });
});

// Utility functions
export async function addSyncJob(accountId: string, options?: Partial<SyncJobData>): Promise<Job<SyncJobData>> {
  const job = await syncQueue.add(
    {
      accountId,
      sinceDate: options?.sinceDate,
      maxMessages: options?.maxMessages,
    },
    {
      priority: 1,
    }
  );

  queueLogger.debug('Added sync job', { jobId: job.id, accountId });
  return job;
}

export async function addIndexJob(messageId: string): Promise<Job<IndexJobData>> {
  const job = await indexQueue.add(
    { messageId },
    {
      priority: 2,
    }
  );

  queueLogger.debug('Added index job', { jobId: job.id, messageId });
  return job;
}

export async function addSendJob(data: SendJobData): Promise<Job<SendJobData>> {
  const job = await sendQueue.add(data, {
    priority: 0, // Highest priority
  });

  queueLogger.info('Added send job', { jobId: job.id, to: data.to });
  return job;
}

// Health check
export async function checkQueueHealth(): Promise<{
  sync: { waiting: number; active: number; failed: number };
  index: { waiting: number; active: number; failed: number };
  send: { waiting: number; active: number; failed: number };
}> {
  const [syncWaiting, syncActive, syncFailed] = await Promise.all([
    syncQueue.getWaitingCount(),
    syncQueue.getActiveCount(),
    syncQueue.getFailedCount(),
  ]);

  const [indexWaiting, indexActive, indexFailed] = await Promise.all([
    indexQueue.getWaitingCount(),
    indexQueue.getActiveCount(),
    indexQueue.getFailedCount(),
  ]);

  const [sendWaiting, sendActive, sendFailed] = await Promise.all([
    sendQueue.getWaitingCount(),
    sendQueue.getActiveCount(),
    sendQueue.getFailedCount(),
  ]);

  return {
    sync: { waiting: syncWaiting, active: syncActive, failed: syncFailed },
    index: { waiting: indexWaiting, active: indexActive, failed: indexFailed },
    send: { waiting: sendWaiting, active: sendActive, failed: sendFailed },
  };
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  queueLogger.info('Closing queues...');
  await Promise.all([
    syncQueue.close(),
    indexQueue.close(),
    sendQueue.close(),
  ]);
  queueLogger.info('Queues closed');
}
