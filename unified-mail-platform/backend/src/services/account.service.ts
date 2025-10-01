import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { vaultService, AccountCredentials } from './vault.service';
import { nanoid } from 'nanoid';

const accountLogger = logger.child({ context: 'account-service' });

export interface Account {
  id: string;
  provider: 'gmail' | 'office365' | 'imap' | 'protonmail' | 'smtp';
  email: string;
  displayName?: string;
  status: 'active' | 'auth_failed' | 'disabled' | 'syncing';
  lastSyncAt?: Date;
  lastSyncError?: string;
  syncCursor?: string;
  settings?: any;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AccountService {
  async createAccount(
    provider: Account['provider'],
    email: string,
    credentials: AccountCredentials,
    createdBy?: string,
    displayName?: string
  ): Promise<Account> {
    try {
      const accountId = nanoid();

      // Store credentials in Vault
      await vaultService.storeAccountCredentials(accountId, credentials);

      // Create account record
      const result = await db.query(
        `INSERT INTO accounts (id, provider, email, display_name, vault_path, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          accountId,
          provider,
          email,
          displayName || email,
          `unified-mail/data/accounts/${accountId}`,
          createdBy,
          'active',
        ]
      );

      accountLogger.info('Account created', { accountId, provider, email });
      return this.mapDbRowToAccount(result.rows[0]);
    } catch (error) {
      accountLogger.error('Failed to create account', {
        provider,
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    try {
      const result = await db.query(
        'SELECT * FROM accounts WHERE id = $1',
        [accountId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToAccount(result.rows[0]);
    } catch (error) {
      accountLogger.error('Failed to get account', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAccountsByProvider(provider: Account['provider']): Promise<Account[]> {
    try {
      const result = await db.query(
        'SELECT * FROM accounts WHERE provider = $1 ORDER BY created_at DESC',
        [provider]
      );

      return result.rows.map((row) => this.mapDbRowToAccount(row));
    } catch (error) {
      accountLogger.error('Failed to get accounts by provider', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAllAccounts(): Promise<Account[]> {
    try {
      const result = await db.query(
        'SELECT * FROM accounts ORDER BY created_at DESC'
      );

      return result.rows.map((row) => this.mapDbRowToAccount(row));
    } catch (error) {
      accountLogger.error('Failed to get all accounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getActiveAccounts(): Promise<Account[]> {
    try {
      const result = await db.query(
        `SELECT * FROM accounts
         WHERE status = 'active'
         ORDER BY last_sync_at ASC NULLS FIRST`
      );

      return result.rows.map((row) => this.mapDbRowToAccount(row));
    } catch (error) {
      accountLogger.error('Failed to get active accounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async updateAccountStatus(
    accountId: string,
    status: Account['status'],
    error?: string
  ): Promise<void> {
    try {
      await db.query(
        `UPDATE accounts
         SET status = $1, last_sync_error = $2, updated_at = NOW()
         WHERE id = $3`,
        [status, error || null, accountId]
      );

      accountLogger.info('Account status updated', { accountId, status });
    } catch (err) {
      accountLogger.error('Failed to update account status', {
        accountId,
        status,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  }

  async updateSyncCursor(
    accountId: string,
    cursor: string,
    lastSyncAt: Date = new Date()
  ): Promise<void> {
    try {
      await db.query(
        `UPDATE accounts
         SET sync_cursor = $1, last_sync_at = $2, updated_at = NOW()
         WHERE id = $3`,
        [cursor, lastSyncAt, accountId]
      );

      accountLogger.debug('Sync cursor updated', { accountId });
    } catch (error) {
      accountLogger.error('Failed to update sync cursor', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      // Delete from Vault first
      await vaultService.deleteAccountCredentials(accountId);

      // Delete from database (cascade will handle related records)
      await db.query('DELETE FROM accounts WHERE id = $1', [accountId]);

      accountLogger.info('Account deleted', { accountId });
    } catch (error) {
      accountLogger.error('Failed to delete account', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAccountCredentials(accountId: string): Promise<AccountCredentials | null> {
    try {
      return await vaultService.getAccountCredentials(accountId);
    } catch (error) {
      accountLogger.error('Failed to get account credentials', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getAccountsNeedingSync(intervalMinutes: number = 5): Promise<Account[]> {
    try {
      const result = await db.query(
        `SELECT * FROM accounts
         WHERE status = 'active'
         AND (
           last_sync_at IS NULL
           OR last_sync_at < NOW() - INTERVAL '${intervalMinutes} minutes'
         )
         ORDER BY last_sync_at ASC NULLS FIRST
         LIMIT 100`
      );

      return result.rows.map((row) => this.mapDbRowToAccount(row));
    } catch (error) {
      accountLogger.error('Failed to get accounts needing sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async updateAccountSettings(accountId: string, settings: any): Promise<void> {
    try {
      await db.query(
        'UPDATE accounts SET settings = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(settings), accountId]
      );

      accountLogger.info('Account settings updated', { accountId });
    } catch (error) {
      accountLogger.error('Failed to update account settings', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private mapDbRowToAccount(row: any): Account {
    return {
      id: row.id,
      provider: row.provider,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      lastSyncAt: row.last_sync_at,
      lastSyncError: row.last_sync_error,
      syncCursor: row.sync_cursor,
      settings: row.settings,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const accountService = new AccountService();
