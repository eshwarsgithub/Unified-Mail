import { sendQueue, SendJobData } from '../queues';
import { accountService } from '../services/account.service';
import { vaultService } from '../services/vault.service';
import { GmailAdapter } from '../adapters/gmail.adapter';
import { logger } from '../utils/logger';
import { config } from '../config';
import { db } from '../utils/database';

const workerLogger = logger.child({ context: 'send-worker' });

// Process send jobs
sendQueue.process(config.sendWorkerConcurrency, async (job) => {
  const { accountId, to, cc, bcc, subject, bodyText, bodyHtml, inReplyTo, references } = job.data;

  workerLogger.info('Processing send job', {
    jobId: job.id,
    accountId,
    to,
    subject,
  });

  try {
    // Get account
    const account = await accountService.getAccountById(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Get credentials
    const credentials = await vaultService.getAccountCredentials(accountId);
    if (!credentials) {
      throw new Error(`Credentials not found for account: ${accountId}`);
    }

    // Create adapter (only Gmail supported for now)
    let adapter;
    if (account.provider === 'gmail') {
      adapter = new GmailAdapter(account.id, credentials);
    } else {
      throw new Error(`Sending not supported for provider: ${account.provider}`);
    }

    // Send message
    const result = await adapter.sendMessage({
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      inReplyTo,
      references,
    });

    workerLogger.info('Send job completed', {
      jobId: job.id,
      accountId,
      providerMessageId: result.messageId,
    });

    // Update outbound_messages table if this was queued from there
    // (This would be implemented when we add the outbound messages feature)

    return { success: true, messageId: result.messageId };
  } catch (error) {
    workerLogger.error('Send job failed', {
      jobId: job.id,
      accountId,
      to,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error; // Will trigger retry
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  workerLogger.info('SIGTERM received, shutting down gracefully...');
  await sendQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  workerLogger.info('SIGINT received, shutting down gracefully...');
  await sendQueue.close();
  process.exit(0);
});

workerLogger.info('Send worker started', {
  concurrency: config.sendWorkerConcurrency,
});
