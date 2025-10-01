import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { BaseAdapter, EmailMessage, SendOptions, SyncOptions } from './base.adapter';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { logger } from '../utils/logger';
import { vaultService } from '../services/vault.service';

const gmailLogger = logger.child({ context: 'gmail-adapter' });

export class GmailAdapter extends BaseAdapter {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor(accountId: string, credentials: any) {
    super(accountId, credentials);

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    if (credentials.oauth) {
      this.oauth2Client.setCredentials({
        access_token: credentials.oauth.access_token,
        refresh_token: credentials.oauth.refresh_token,
        expiry_date: credentials.oauth.expires_at,
      });

      // Auto-refresh tokens
      this.oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          gmailLogger.info('Refreshed Gmail OAuth tokens', { accountId });
          await vaultService.updateOAuthTokens(accountId, {
            access_token: tokens.access_token!,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expiry_date!,
          });
        }
      });
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async testConnection(): Promise<boolean> {
    try {
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      gmailLogger.info('Gmail connection test successful', {
        accountId: this.accountId,
        email: profile.data.emailAddress,
      });
      return true;
    } catch (error) {
      gmailLogger.error('Gmail connection test failed', {
        accountId: this.accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async fetchMessages(options: SyncOptions): Promise<EmailMessage[]> {
    try {
      const query = this.buildQuery(options);
      gmailLogger.debug('Fetching Gmail messages', { accountId: this.accountId, query });

      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: options.maxMessages || 100,
      });

      const messageIds = listResponse.data.messages || [];
      if (messageIds.length === 0) {
        gmailLogger.debug('No new messages found', { accountId: this.accountId });
        return [];
      }

      gmailLogger.info('Found Gmail messages', {
        accountId: this.accountId,
        count: messageIds.length,
      });

      // Fetch full message details in parallel
      const messages = await Promise.all(
        messageIds.map((msg) => this.fetchFullMessage(msg.id!))
      );

      return messages.filter((msg): msg is EmailMessage => msg !== null);
    } catch (error) {
      gmailLogger.error('Failed to fetch Gmail messages', {
        accountId: this.accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private buildQuery(options: SyncOptions): string {
    const parts: string[] = [];

    if (options.sinceDate) {
      const dateStr = Math.floor(options.sinceDate.getTime() / 1000);
      parts.push(`after:${dateStr}`);
    }

    if (options.folder && options.folder !== 'INBOX') {
      parts.push(`in:${options.folder.toLowerCase()}`);
    }

    return parts.join(' ') || 'in:inbox';
  }

  private async fetchFullMessage(messageId: string): Promise<EmailMessage | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'raw',
      });

      if (!response.data.raw) {
        gmailLogger.warn('Message has no raw content', { messageId });
        return null;
      }

      const rawEmail = Buffer.from(response.data.raw, 'base64');
      const parsed = await simpleParser(rawEmail);

      return this.parseMimeToEmailMessage(parsed, rawEmail, messageId, response.data);
    } catch (error) {
      gmailLogger.error('Failed to fetch full message', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private parseMimeToEmailMessage(
    parsed: ParsedMail,
    rawEmail: Buffer,
    gmailMessageId: string,
    gmailData: gmail_v1.Schema$Message
  ): EmailMessage {
    const headers: Record<string, string> = {};
    if (parsed.headers) {
      parsed.headers.forEach((value, key) => {
        headers[key] = Array.isArray(value) ? value.join(', ') : value.toString();
      });
    }

    const labels = gmailData.labelIds || [];
    const isRead = !labels.includes('UNREAD');
    const isStarred = labels.includes('STARRED');
    const folder = this.determineFolder(labels);

    return {
      messageId: parsed.messageId || gmailMessageId,
      threadId: gmailData.threadId,
      subject: parsed.subject || '(no subject)',
      fromEmail: parsed.from?.value[0]?.address || '',
      fromName: parsed.from?.value[0]?.name || '',
      toEmails: (parsed.to?.value || []).map((addr) => addr.address || ''),
      ccEmails: (parsed.cc?.value || []).map((addr) => addr.address || ''),
      bccEmails: (parsed.bcc?.value || []).map((addr) => addr.address || ''),
      date: parsed.date || new Date(),
      bodyText: parsed.text || '',
      bodyHtml: parsed.html || '',
      hasAttachments: (parsed.attachments?.length || 0) > 0,
      attachments: this.parseAttachments(parsed.attachments || []),
      headers,
      inReplyTo: parsed.inReplyTo,
      references: parsed.references || [],
      folder,
      labels: labels.filter((l) => !['UNREAD', 'STARRED', 'INBOX', 'SENT'].includes(l)),
      isRead,
      isStarred,
      rawEmail,
      sizeBytes: rawEmail.length,
    };
  }

  private determineFolder(labels: string[]): string {
    if (labels.includes('SENT')) return 'Sent';
    if (labels.includes('DRAFT')) return 'Drafts';
    if (labels.includes('TRASH')) return 'Trash';
    if (labels.includes('SPAM')) return 'Spam';
    return 'INBOX';
  }

  private parseAttachments(attachments: Attachment[]): any[] {
    return attachments.map((att) => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType,
      size: att.size,
      content: att.content,
      contentId: att.contentId,
    }));
  }

  async sendMessage(options: SendOptions): Promise<{ messageId: string }> {
    try {
      const rawMessage = this.buildRawMessage(options);
      const encoded = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded,
          threadId: options.inReplyTo ? undefined : undefined, // Gmail auto-threads
        },
      });

      gmailLogger.info('Sent Gmail message', {
        accountId: this.accountId,
        messageId: response.data.id,
      });

      return { messageId: response.data.id || '' };
    } catch (error) {
      gmailLogger.error('Failed to send Gmail message', {
        accountId: this.accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private buildRawMessage(options: SendOptions): string {
    const lines: string[] = [];

    lines.push(`From: ${this.credentials.email}`);
    lines.push(`To: ${options.to.join(', ')}`);
    if (options.cc && options.cc.length > 0) {
      lines.push(`Cc: ${options.cc.join(', ')}`);
    }
    if (options.bcc && options.bcc.length > 0) {
      lines.push(`Bcc: ${options.bcc.join(', ')}`);
    }
    lines.push(`Subject: ${options.subject}`);

    if (options.inReplyTo) {
      lines.push(`In-Reply-To: ${options.inReplyTo}`);
    }
    if (options.references && options.references.length > 0) {
      lines.push(`References: ${options.references.join(' ')}`);
    }

    lines.push(`Content-Type: text/html; charset=utf-8`);
    lines.push(``);
    lines.push(options.bodyHtml || options.bodyText || '');

    return lines.join('\r\n');
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
      gmailLogger.debug('Marked message as read', { accountId: this.accountId, messageId });
    } catch (error) {
      gmailLogger.error('Failed to mark message as read', {
        accountId: this.accountId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async markAsStarred(messageId: string, starred: boolean): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: starred
          ? { addLabelIds: ['STARRED'] }
          : { removeLabelIds: ['STARRED'] },
      });
      gmailLogger.debug('Updated message starred status', {
        accountId: this.accountId,
        messageId,
        starred,
      });
    } catch (error) {
      gmailLogger.error('Failed to update starred status', {
        accountId: this.accountId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async moveToFolder(messageId: string, folder: string): Promise<void> {
    try {
      const labelMap: Record<string, string> = {
        Trash: 'TRASH',
        Spam: 'SPAM',
        Inbox: 'INBOX',
      };

      const labelId = labelMap[folder] || folder;

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
          removeLabelIds: ['INBOX'],
        },
      });

      gmailLogger.debug('Moved message to folder', {
        accountId: this.accountId,
        messageId,
        folder,
      });
    } catch (error) {
      gmailLogger.error('Failed to move message', {
        accountId: this.accountId,
        messageId,
        folder,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });
      gmailLogger.debug('Deleted message', { accountId: this.accountId, messageId });
    } catch (error) {
      gmailLogger.error('Failed to delete message', {
        accountId: this.accountId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getFolders(): Promise<string[]> {
    try {
      const response = await this.gmail.users.labels.list({ userId: 'me' });
      const labels = response.data.labels || [];
      return labels.map((label) => label.name || '').filter(Boolean);
    } catch (error) {
      gmailLogger.error('Failed to get folders', {
        accountId: this.accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
