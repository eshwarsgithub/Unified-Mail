import AWS from 'aws-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const storageLogger = logger.child({ context: 'storage' });

export class StorageService {
  private static instance: StorageService;
  private s3: AWS.S3;

  private constructor() {
    this.s3 = new AWS.S3({
      endpoint: config.s3Endpoint,
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
      region: config.s3Region,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      sslEnabled: config.s3UseSsl,
    });
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Create bucket if it doesn't exist
      try {
        await this.s3.headBucket({ Bucket: config.s3Bucket }).promise();
        storageLogger.info('S3 bucket exists', { bucket: config.s3Bucket });
      } catch (error: any) {
        if (error.statusCode === 404) {
          await this.s3.createBucket({ Bucket: config.s3Bucket }).promise();
          storageLogger.info('Created S3 bucket', { bucket: config.s3Bucket });
        } else {
          throw error;
        }
      }

      // Set bucket encryption
      try {
        await this.s3.putBucketEncryption({
          Bucket: config.s3Bucket,
          ServerSideEncryptionConfiguration: {
            Rules: [
              {
                ApplyServerSideEncryptionByDefault: {
                  SSEAlgorithm: 'AES256',
                },
                BucketKeyEnabled: true,
              },
            ],
          },
        }).promise();
        storageLogger.info('Enabled bucket encryption');
      } catch (error) {
        storageLogger.warn('Could not enable bucket encryption', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      storageLogger.info('Storage service initialized successfully');
    } catch (error) {
      storageLogger.error('Failed to initialize storage service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private generateMessageKey(accountId: string, messageId: string, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9-_.]/g, '_');
    return `messages/${accountId}/${year}/${month}/${sanitizedMessageId}.eml`;
  }

  private generateAttachmentKey(
    accountId: string,
    messageId: string,
    attachmentId: string,
    filename: string
  ): string {
    const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9-_.]/g, '_');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
    return `attachments/${accountId}/${sanitizedMessageId}/${attachmentId}_${sanitizedFilename}`;
  }

  public async storeMessage(
    accountId: string,
    messageId: string,
    rawEmail: string | Buffer,
    date: Date
  ): Promise<string> {
    try {
      const key = this.generateMessageKey(accountId, messageId, date);
      const body = Buffer.isBuffer(rawEmail) ? rawEmail : Buffer.from(rawEmail);

      await this.s3.putObject({
        Bucket: config.s3Bucket,
        Key: key,
        Body: body,
        ContentType: 'message/rfc822',
        Metadata: {
          account_id: accountId,
          message_id: messageId,
          uploaded_at: new Date().toISOString(),
        },
      }).promise();

      storageLogger.debug('Stored message', { accountId, messageId, key });
      return key;
    } catch (error) {
      storageLogger.error('Failed to store message', {
        accountId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getMessage(s3Key: string): Promise<Buffer> {
    try {
      const response = await this.s3.getObject({
        Bucket: config.s3Bucket,
        Key: s3Key,
      }).promise();

      return response.Body as Buffer;
    } catch (error) {
      storageLogger.error('Failed to retrieve message', {
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async storeAttachment(
    accountId: string,
    messageId: string,
    attachmentId: string,
    filename: string,
    content: Buffer,
    contentType: string
  ): Promise<{ key: string; checksum: string }> {
    try {
      const key = this.generateAttachmentKey(accountId, messageId, attachmentId, filename);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      await this.s3.putObject({
        Bucket: config.s3Bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        Metadata: {
          account_id: accountId,
          message_id: messageId,
          attachment_id: attachmentId,
          checksum,
          uploaded_at: new Date().toISOString(),
        },
      }).promise();

      storageLogger.debug('Stored attachment', { accountId, messageId, filename, key });
      return { key, checksum };
    } catch (error) {
      storageLogger.error('Failed to store attachment', {
        accountId,
        messageId,
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getAttachment(s3Key: string): Promise<Buffer> {
    try {
      const response = await this.s3.getObject({
        Bucket: config.s3Bucket,
        Key: s3Key,
      }).promise();

      return response.Body as Buffer;
    } catch (error) {
      storageLogger.error('Failed to retrieve attachment', {
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getSignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: config.s3Bucket,
        Key: s3Key,
        Expires: expiresIn,
      });

      return url;
    } catch (error) {
      storageLogger.error('Failed to generate signed URL', {
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async deleteMessage(s3Key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: config.s3Bucket,
        Key: s3Key,
      }).promise();

      storageLogger.debug('Deleted message', { s3Key });
    } catch (error) {
      storageLogger.error('Failed to delete message', {
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.s3.headBucket({ Bucket: config.s3Bucket }).promise();
      return true;
    } catch (error) {
      storageLogger.error('Storage health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export const storageService = StorageService.getInstance();
