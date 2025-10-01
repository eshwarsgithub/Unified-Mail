import { indexQueue, IndexJobData } from '../queues';
import { messageService } from '../services/message.service';
import { searchService } from '../services/search.service';
import { storageService } from '../services/storage.service';
import { logger } from '../utils/logger';
import { config } from '../config';
import { simpleParser } from 'mailparser';

const workerLogger = logger.child({ context: 'index-worker' });

// Process index jobs
indexQueue.process(config.indexWorkerConcurrency, async (job) => {
  const { messageId } = job.data;

  workerLogger.debug('Processing index job', {
    jobId: job.id,
    messageId,
  });

  try {
    // Get message from database
    const message = await messageService.getMessageById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    // Get raw email from S3 to extract full body text
    const rawEmail = await storageService.getMessage(message.s3Key);
    const parsed = await simpleParser(rawEmail);

    // Get attachments
    const attachments = await messageService.getMessageAttachments(messageId);
    const attachmentFilenames = attachments.map((att) => att.filename);

    // Index in Elasticsearch
    await searchService.indexMessage({
      message_uuid: message.id,
      account_id: message.accountId,
      message_id: message.messageId,
      subject: message.subject,
      from_email: message.fromEmail,
      from_name: message.fromName,
      to_emails: message.toEmails,
      date: message.date,
      body_text: parsed.text || '',
      body_html: parsed.html || '',
      folder: message.folder,
      labels: message.labels,
      has_attachments: message.hasAttachments,
      attachment_filenames: attachmentFilenames,
      is_read: message.isRead,
      is_starred: message.isStarred,
    });

    workerLogger.debug('Index job completed', {
      jobId: job.id,
      messageId,
    });

    return { success: true };
  } catch (error) {
    workerLogger.error('Index job failed', {
      jobId: job.id,
      messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error; // Will trigger retry
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  workerLogger.info('SIGTERM received, shutting down gracefully...');
  await indexQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  workerLogger.info('SIGINT received, shutting down gracefully...');
  await indexQueue.close();
  process.exit(0);
});

workerLogger.info('Index worker started', {
  concurrency: config.indexWorkerConcurrency,
});
