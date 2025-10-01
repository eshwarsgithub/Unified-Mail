import { logger } from '../utils/logger';
import { accountService, Account } from './account.service';
import { messageService } from './message.service';
import { searchService } from './search.service';
import { vaultService } from './vault.service';
import { GmailAdapter } from '../adapters/gmail.adapter';
import { BaseAdapter } from '../adapters/base.adapter';
import { addIndexJob } from '../queues';
import { db } from '../utils/database';

const syncLogger = logger.child({ context: 'sync-service' });

export class SyncService {
  async syncAccount(accountId: string, options?: { sinceDate?: Date; maxMessages?: number }): Promise<{
    success: boolean;
    messagesSynced: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let messagesSynced = 0;

    try {
      // Get account
      const account = await accountService.getAccountById(accountId);
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      if (account.status !== 'active') {
        syncLogger.warn('Account is not active', { accountId, status: account.status });
        return { success: false, messagesSynced: 0, error: 'Account not active' };
      }

      // Update status to syncing
      await accountService.updateAccountStatus(accountId, 'syncing');

      // Get credentials from Vault
      const credentials = await vaultService.getAccountCredentials(accountId);
      if (!credentials) {
        throw new Error(`Credentials not found for account: ${accountId}`);
      }

      // Create adapter based on provider
      const adapter = this.createAdapter(account, credentials);

      // Test connection
      const connected = await adapter.testConnection();
      if (!connected) {
        throw new Error('Failed to connect to mail provider');
      }

      // Determine sync start date
      const sinceDate = options?.sinceDate || this.getLastSyncDate(account);

      syncLogger.info('Starting account sync', {
        accountId,
        provider: account.provider,
        email: account.email,
        sinceDate,
      });

      // Create sync job record
      const syncJobId = await this.createSyncJob(accountId);

      try {
        // Fetch messages
        const messages = await adapter.fetchMessages({
          sinceDate,
          maxMessages: options?.maxMessages || 100,
        });

        syncLogger.info('Fetched messages from provider', {
          accountId,
          count: messages.length,
        });

        // Store messages
        for (const message of messages) {
          try {
            const storedMessage = await messageService.storeMessage(accountId, message);

            // Queue for indexing
            await addIndexJob(storedMessage.id);

            messagesSynced++;
          } catch (error) {
            syncLogger.error('Failed to store message', {
              accountId,
              messageId: message.messageId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Continue with other messages
          }
        }

        // Update sync job status
        await this.completeSyncJob(syncJobId, messagesSynced);

        // Update account sync cursor and timestamp
        await accountService.updateSyncCursor(accountId, new Date().toISOString());
        await accountService.updateAccountStatus(accountId, 'active');

        const duration = Date.now() - startTime;

        syncLogger.info('Account sync completed', {
          accountId,
          messagesSynced,
          duration,
        });

        return { success: true, messagesSynced };
      } catch (error) {
        await this.failSyncJob(syncJobId, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      syncLogger.error('Account sync failed', {
        accountId,
        error: errorMessage,
        duration: Date.now() - startTime,
      });

      // Update account status
      await accountService.updateAccountStatus(accountId, 'auth_failed', errorMessage);

      return { success: false, messagesSynced, error: errorMessage };
    }
  }

  async syncAllActiveAccounts(): Promise<{ total: number; successful: number; failed: number }> {
    try {
      const accounts = await accountService.getActiveAccounts();

      syncLogger.info('Starting sync for all active accounts', { count: accounts.length });

      const results = await Promise.allSettled(
        accounts.map((account) => this.syncAccount(account.id))
      );

      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      syncLogger.info('Completed sync for all active accounts', {
        total: accounts.length,
        successful,
        failed,
      });

      return { total: accounts.length, successful, failed };
    } catch (error) {
      syncLogger.error('Failed to sync all active accounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private createAdapter(account: Account, credentials: any): BaseAdapter {
    switch (account.provider) {
      case 'gmail':
        return new GmailAdapter(account.id, credentials);

      // TODO: Add other providers
      // case 'office365':
      //   return new MicrosoftAdapter(account.id, credentials);
      // case 'imap':
      //   return new ImapAdapter(account.id, credentials);

      default:
        throw new Error(`Unsupported provider: ${account.provider}`);
    }
  }

  private getLastSyncDate(account: Account): Date {
    if (account.lastSyncAt) {
      return account.lastSyncAt;
    }

    // Default to 30 days ago for first sync
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }

  private async createSyncJob(accountId: string): Promise<string> {
    const result = await db.query(
      `INSERT INTO sync_jobs (account_id, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING id`,
      [accountId]
    );

    return result.rows[0].id;
  }

  private async completeSyncJob(syncJobId: string, messagesSynced: number): Promise<void> {
    await db.query(
      `UPDATE sync_jobs
       SET status = 'completed', completed_at = NOW(), messages_synced = $1
       WHERE id = $2`,
      [messagesSynced, syncJobId]
    );
  }

  private async failSyncJob(syncJobId: string, errorMessage: string): Promise<void> {
    await db.query(
      `UPDATE sync_jobs
       SET status = 'failed', completed_at = NOW(), error_message = $1
       WHERE id = $2`,
      [errorMessage, syncJobId]
    );
  }
}

export const syncService = new SyncService();
