import vault from 'node-vault';
import { config } from '../config';
import { logger } from '../utils/logger';

const vaultLogger = logger.child({ context: 'vault' });

export interface AccountCredentials {
  provider: 'gmail' | 'office365' | 'imap' | 'protonmail' | 'smtp';
  email: string;
  oauth?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type?: string;
    scope?: string;
  };
  imap?: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
  smtp?: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
}

export class VaultService {
  private static instance: VaultService;
  private client: any;
  private initialized: boolean = false;

  private constructor() {
    this.client = vault({
      apiVersion: 'v1',
      endpoint: config.vaultAddr,
      token: config.vaultToken,
      namespace: config.vaultNamespace,
    });
  }

  public static getInstance(): VaultService {
    if (!VaultService.instance) {
      VaultService.instance = new VaultService();
    }
    return VaultService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check vault status
      const status = await this.client.status();
      vaultLogger.info('Vault status', {
        initialized: status.initialized,
        sealed: status.sealed,
      });

      if (status.sealed) {
        throw new Error('Vault is sealed. Please unseal it first.');
      }

      // Enable KV v2 secrets engine if not already enabled
      try {
        await this.client.mount({
          mount_point: 'unified-mail',
          type: 'kv-v2',
          description: 'Unified Mail Platform secrets',
        });
        vaultLogger.info('Mounted KV v2 secrets engine');
      } catch (error: any) {
        if (error.response?.statusCode !== 400) {
          throw error;
        }
        // Already mounted
        vaultLogger.debug('KV v2 secrets engine already mounted');
      }

      this.initialized = true;
      vaultLogger.info('Vault service initialized successfully');
    } catch (error) {
      vaultLogger.error('Failed to initialize Vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async storeAccountCredentials(
    accountId: string,
    credentials: AccountCredentials
  ): Promise<void> {
    try {
      const path = `unified-mail/data/accounts/${accountId}`;
      await this.client.write(path, {
        data: credentials,
      });
      vaultLogger.info('Stored account credentials', { accountId, provider: credentials.provider });
    } catch (error) {
      vaultLogger.error('Failed to store account credentials', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getAccountCredentials(accountId: string): Promise<AccountCredentials | null> {
    try {
      const path = `unified-mail/data/accounts/${accountId}`;
      const response = await this.client.read(path);
      return response.data.data as AccountCredentials;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        vaultLogger.warn('Account credentials not found', { accountId });
        return null;
      }
      vaultLogger.error('Failed to retrieve account credentials', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async updateOAuthTokens(
    accountId: string,
    oauth: AccountCredentials['oauth']
  ): Promise<void> {
    try {
      const credentials = await this.getAccountCredentials(accountId);
      if (!credentials) {
        throw new Error(`Account credentials not found for ${accountId}`);
      }

      credentials.oauth = oauth;
      await this.storeAccountCredentials(accountId, credentials);
      vaultLogger.info('Updated OAuth tokens', { accountId });
    } catch (error) {
      vaultLogger.error('Failed to update OAuth tokens', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async deleteAccountCredentials(accountId: string): Promise<void> {
    try {
      const path = `unified-mail/data/accounts/${accountId}`;
      await this.client.delete(path);
      vaultLogger.info('Deleted account credentials', { accountId });
    } catch (error) {
      vaultLogger.error('Failed to delete account credentials', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const status = await this.client.status();
      return status.initialized && !status.sealed;
    } catch (error) {
      vaultLogger.error('Vault health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export const vaultService = VaultService.getInstance();
