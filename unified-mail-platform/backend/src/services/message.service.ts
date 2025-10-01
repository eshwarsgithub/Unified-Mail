import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { storageService } from './storage.service';
import { EmailMessage } from '../adapters/base.adapter';
import { nanoid } from 'nanoid';

const messageLogger = logger.child({ context: 'message-service' });

export interface StoredMessage {
  id: string;
  accountId: string;
  messageId: string;
  threadId?: string;
  folder: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  date: Date;
  hasAttachments: boolean;
  isRead: boolean;
  isStarred: boolean;
  isSpam: boolean;
  labels: string[];
  s3Key: string;
  bodyPreview: string;
  bodyTextPreview: string;
  spamScore?: number;
  headers: any;
  inReplyTo?: string;
  references: string[];
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageFilter {
  accountIds?: string[];
  folders?: string[];
  labels?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  isSpam?: boolean;
  fromEmail?: string;
  fromDate?: Date;
  toDate?: Date;
  hasAttachments?: boolean;
  limit?: number;
  offset?: number;
}

export class MessageService {
  async storeMessage(accountId: string, emailMessage: EmailMessage): Promise<StoredMessage> {
    try {
      const messageUuid = nanoid();

      // Check if message already exists (deduplication)
      const existing = await this.getMessageByAccountAndMessageId(accountId, emailMessage.messageId);
      if (existing) {
        messageLogger.debug('Message already exists', {
          accountId,
          messageId: emailMessage.messageId,
        });
        return existing;
      }

      // Store raw email in S3
      const s3Key = await storageService.storeMessage(
        accountId,
        emailMessage.messageId,
        emailMessage.rawEmail,
        emailMessage.date
      );

      // Store attachments in S3
      const attachmentIds: string[] = [];
      for (const attachment of emailMessage.attachments) {
        const attachmentId = nanoid();
        const { key, checksum } = await storageService.storeAttachment(
          accountId,
          emailMessage.messageId,
          attachmentId,
          attachment.filename,
          attachment.content,
          attachment.contentType
        );

        // Store attachment metadata
        await db.query(
          `INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, s3_key, checksum)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [attachmentId, messageUuid, attachment.filename, attachment.contentType, attachment.size, key, checksum]
        );

        attachmentIds.push(attachmentId);
      }

      // Find or create thread
      const threadId = await this.findOrCreateThread(emailMessage);

      // Create preview text
      const bodyTextPreview = emailMessage.bodyText.substring(0, 500);
      const bodyPreview = emailMessage.bodyHtml
        ? this.stripHtml(emailMessage.bodyHtml).substring(0, 200)
        : bodyTextPreview.substring(0, 200);

      // Store message metadata
      const result = await db.query(
        `INSERT INTO messages (
          id, account_id, message_id, thread_id, folder, subject,
          from_email, from_name, to_emails, cc_emails, bcc_emails,
          date, has_attachments, is_read, is_starred, is_spam,
          labels, s3_key, body_preview, body_text_preview,
          headers, in_reply_to, references, size_bytes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
        RETURNING *`,
        [
          messageUuid,
          accountId,
          emailMessage.messageId,
          threadId,
          emailMessage.folder,
          emailMessage.subject,
          emailMessage.fromEmail,
          emailMessage.fromName,
          emailMessage.toEmails,
          emailMessage.ccEmails,
          emailMessage.bccEmails,
          emailMessage.date,
          emailMessage.hasAttachments,
          emailMessage.isRead,
          emailMessage.isStarred,
          emailMessage.folder === 'Spam',
          emailMessage.labels,
          s3Key,
          bodyPreview,
          bodyTextPreview,
          JSON.stringify(emailMessage.headers),
          emailMessage.inReplyTo,
          emailMessage.references,
          emailMessage.sizeBytes,
        ]
      );

      messageLogger.info('Message stored', {
        accountId,
        messageId: emailMessage.messageId,
        messageUuid,
        hasAttachments: emailMessage.hasAttachments,
      });

      return this.mapDbRowToMessage(result.rows[0]);
    } catch (error) {
      messageLogger.error('Failed to store message', {
        accountId,
        messageId: emailMessage.messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getMessageById(messageId: string): Promise<StoredMessage | null> {
    try {
      const result = await db.query('SELECT * FROM messages WHERE id = $1', [messageId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToMessage(result.rows[0]);
    } catch (error) {
      messageLogger.error('Failed to get message', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getMessageByAccountAndMessageId(accountId: string, messageId: string): Promise<StoredMessage | null> {
    try {
      const result = await db.query(
        'SELECT * FROM messages WHERE account_id = $1 AND message_id = $2',
        [accountId, messageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToMessage(result.rows[0]);
    } catch (error) {
      messageLogger.error('Failed to get message by account and message ID', {
        accountId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getMessages(filter: MessageFilter): Promise<{ messages: StoredMessage[]; total: number }> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.accountIds && filter.accountIds.length > 0) {
        whereClauses.push(`account_id = ANY($${paramIndex})`);
        params.push(filter.accountIds);
        paramIndex++;
      }

      if (filter.folders && filter.folders.length > 0) {
        whereClauses.push(`folder = ANY($${paramIndex})`);
        params.push(filter.folders);
        paramIndex++;
      }

      if (filter.labels && filter.labels.length > 0) {
        whereClauses.push(`labels && $${paramIndex}`);
        params.push(filter.labels);
        paramIndex++;
      }

      if (filter.isRead !== undefined) {
        whereClauses.push(`is_read = $${paramIndex}`);
        params.push(filter.isRead);
        paramIndex++;
      }

      if (filter.isStarred !== undefined) {
        whereClauses.push(`is_starred = $${paramIndex}`);
        params.push(filter.isStarred);
        paramIndex++;
      }

      if (filter.isSpam !== undefined) {
        whereClauses.push(`is_spam = $${paramIndex}`);
        params.push(filter.isSpam);
        paramIndex++;
      }

      if (filter.fromEmail) {
        whereClauses.push(`from_email = $${paramIndex}`);
        params.push(filter.fromEmail);
        paramIndex++;
      }

      if (filter.hasAttachments !== undefined) {
        whereClauses.push(`has_attachments = $${paramIndex}`);
        params.push(filter.hasAttachments);
        paramIndex++;
      }

      if (filter.fromDate) {
        whereClauses.push(`date >= $${paramIndex}`);
        params.push(filter.fromDate);
        paramIndex++;
      }

      if (filter.toDate) {
        whereClauses.push(`date <= $${paramIndex}`);
        params.push(filter.toDate);
        paramIndex++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM messages ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get messages
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;

      const result = await db.query(
        `SELECT * FROM messages
         ${whereClause}
         ORDER BY date DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const messages = result.rows.map((row) => this.mapDbRowToMessage(row));

      return { messages, total };
    } catch (error) {
      messageLogger.error('Failed to get messages', {
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async updateMessageFlags(
    messageId: string,
    flags: { isRead?: boolean; isStarred?: boolean }
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (flags.isRead !== undefined) {
        updates.push(`is_read = $${paramIndex}`);
        params.push(flags.isRead);
        paramIndex++;
      }

      if (flags.isStarred !== undefined) {
        updates.push(`is_starred = $${paramIndex}`);
        params.push(flags.isStarred);
        paramIndex++;
      }

      if (updates.length === 0) {
        return;
      }

      params.push(messageId);

      await db.query(
        `UPDATE messages SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
        params
      );

      messageLogger.debug('Message flags updated', { messageId, flags });
    } catch (error) {
      messageLogger.error('Failed to update message flags', {
        messageId,
        flags,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      const message = await this.getMessageById(messageId);
      if (!message) {
        return;
      }

      // Delete from S3
      await storageService.deleteMessage(message.s3Key);

      // Delete from database (cascade will handle attachments)
      await db.query('DELETE FROM messages WHERE id = $1', [messageId]);

      messageLogger.info('Message deleted', { messageId });
    } catch (error) {
      messageLogger.error('Failed to delete message', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getMessageAttachments(messageId: string): Promise<any[]> {
    try {
      const result = await db.query(
        'SELECT * FROM attachments WHERE message_id = $1',
        [messageId]
      );

      return result.rows;
    } catch (error) {
      messageLogger.error('Failed to get message attachments', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async findOrCreateThread(emailMessage: EmailMessage): Promise<string> {
    try {
      // Try to find existing thread by In-Reply-To or References
      if (emailMessage.inReplyTo) {
        const result = await db.query(
          `SELECT thread_id FROM messages WHERE message_id = $1 LIMIT 1`,
          [emailMessage.inReplyTo]
        );

        if (result.rows.length > 0) {
          return result.rows[0].thread_id;
        }
      }

      // Try to find by normalized subject
      const normalizedSubject = this.normalizeSubject(emailMessage.subject);
      const result = await db.query(
        `SELECT id FROM threads WHERE subject_normalized = $1 LIMIT 1`,
        [normalizedSubject]
      );

      if (result.rows.length > 0) {
        return result.rows[0].id;
      }

      // Create new thread
      const threadId = nanoid();
      const participants = Array.from(
        new Set([emailMessage.fromEmail, ...emailMessage.toEmails, ...emailMessage.ccEmails])
      );

      await db.query(
        `INSERT INTO threads (id, subject_normalized, first_message_date, last_message_date, participants)
         VALUES ($1, $2, $3, $4, $5)`,
        [threadId, normalizedSubject, emailMessage.date, emailMessage.date, participants]
      );

      return threadId;
    } catch (error) {
      messageLogger.error('Failed to find or create thread', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private normalizeSubject(subject: string): string {
    return subject
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .trim()
      .toLowerCase()
      .substring(0, 255);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private mapDbRowToMessage(row: any): StoredMessage {
    return {
      id: row.id,
      accountId: row.account_id,
      messageId: row.message_id,
      threadId: row.thread_id,
      folder: row.folder,
      subject: row.subject,
      fromEmail: row.from_email,
      fromName: row.from_name,
      toEmails: row.to_emails,
      ccEmails: row.cc_emails,
      bccEmails: row.bcc_emails,
      date: row.date,
      hasAttachments: row.has_attachments,
      isRead: row.is_read,
      isStarred: row.is_starred,
      isSpam: row.is_spam,
      labels: row.labels,
      s3Key: row.s3_key,
      bodyPreview: row.body_preview,
      bodyTextPreview: row.body_text_preview,
      spamScore: row.spam_score,
      headers: row.headers,
      inReplyTo: row.in_reply_to,
      references: row.references,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const messageService = new MessageService();
