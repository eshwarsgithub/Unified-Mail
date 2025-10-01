import { syncQueue, SyncJobData } from '../queues';
import { syncService } from '../services/sync.service';
import { logger } from '../utils/logger';
import { config } from '../config';
import { accountService } from '../services/account.service';

const workerLogger = logger.child({ context: 'sync-worker' });

// Process sync jobs
syncQueue.process(config.syncWorkerConcurrency, async (job) => {
  const { accountId, sinceDate, maxMessages } = job.data;

  workerLogger.info('Processing sync job', {
    jobId: job.id,
    accountId,
    attempt: job.attemptsMade + 1,
  });

  try {
    const result = await syncService.syncAccount(accountId, {
      sinceDate: sinceDate ? new Date(sinceDate) : undefined,
      maxMessages,
    });

    if (!result.success) {
      throw new Error(result.error || 'Sync failed');
    }

    workerLogger.info('Sync job completed successfully', {
      jobId: job.id,
      accountId,
      messagesSynced: result.messagesSynced,
    });

    return result;
  } catch (error) {
    workerLogger.error('Sync job failed', {
      jobId: job.id,
      accountId,
      attempt: job.attemptsMade + 1,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error; // Will trigger retry
  }
});

// Schedule periodic sync for all active accounts
async function schedulePeriodicSync() {
  try {
    const accounts = await accountService.getAccountsNeedingSync(config.syncIntervalMinutes);

    if (accounts.length === 0) {
      workerLogger.debug('No accounts need syncing');
      return;
    }

    workerLogger.info('Scheduling sync for accounts', { count: accounts.length });

    for (const account of accounts) {
      await syncQueue.add(
        {
          accountId: account.id,
        },
        {
          jobId: `sync-${account.id}-${Date.now()}`,
          removeOnComplete: true,
        }
      );
    }

    workerLogger.info('Scheduled sync jobs', { count: accounts.length });
  } catch (error) {
    workerLogger.error('Failed to schedule periodic sync', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Run periodic scheduler every minute
setInterval(schedulePeriodicSync, 60 * 1000);

// Run immediately on startup
schedulePeriodicSync();

// Graceful shutdown
process.on('SIGTERM', async () => {
  workerLogger.info('SIGTERM received, shutting down gracefully...');
  await syncQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  workerLogger.info('SIGINT received, shutting down gracefully...');
  await syncQueue.close();
  process.exit(0);
});

workerLogger.info('Sync worker started', {
  concurrency: config.syncWorkerConcurrency,
  syncInterval: config.syncIntervalMinutes,
});
