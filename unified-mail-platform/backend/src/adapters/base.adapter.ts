export interface EmailMessage {
  messageId: string;
  threadId?: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  date: Date;
  bodyText: string;
  bodyHtml: string;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  inReplyTo?: string;
  references: string[];
  folder: string;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  rawEmail: Buffer;
  sizeBytes: number;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId?: string;
}

export interface SyncOptions {
  sinceDate?: Date;
  folder?: string;
  maxMessages?: number;
}

export interface SendOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
}

export abstract class BaseAdapter {
  protected accountId: string;
  protected credentials: any;

  constructor(accountId: string, credentials: any) {
    this.accountId = accountId;
    this.credentials = credentials;
  }

  /**
   * Test connection to mail provider
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Fetch new messages since last sync
   */
  abstract fetchMessages(options: SyncOptions): Promise<EmailMessage[]>;

  /**
   * Send an email message
   */
  abstract sendMessage(options: SendOptions): Promise<{ messageId: string }>;

  /**
   * Mark message as read
   */
  abstract markAsRead(messageId: string): Promise<void>;

  /**
   * Mark message as starred
   */
  abstract markAsStarred(messageId: string, starred: boolean): Promise<void>;

  /**
   * Move message to folder
   */
  abstract moveToFolder(messageId: string, folder: string): Promise<void>;

  /**
   * Delete message
   */
  abstract deleteMessage(messageId: string): Promise<void>;

  /**
   * Get available folders
   */
  abstract getFolders(): Promise<string[]>;

  /**
   * Refresh OAuth tokens (if applicable)
   */
  abstract refreshTokens?(): Promise<void>;
}
