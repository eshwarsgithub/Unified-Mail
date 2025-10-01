import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { accountService } from '../services/account.service';
import { authService } from '../services/auth.service';
import { addSyncJob } from '../queues';
import { google } from 'googleapis';
import { config } from '../config';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/accounts - List all accounts
router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await accountService.getAllAccounts();

    // Filter based on permissions (unless admin)
    let filteredAccounts = accounts;
    if (req.analyst?.role !== 'admin') {
      filteredAccounts = [];
      for (const account of accounts) {
        const hasAccess = await authService.hasPermission(req.analyst!.id, account.id, 'read');
        if (hasAccess) {
          filteredAccounts.push(account);
        }
      }
    }

    res.json({
      accounts: filteredAccounts.map((acc) => ({
        id: acc.id,
        provider: acc.provider,
        email: acc.email,
        displayName: acc.displayName,
        status: acc.status,
        lastSyncAt: acc.lastSyncAt,
        lastSyncError: acc.lastSyncError,
        createdAt: acc.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get accounts',
    });
  }
});

// GET /api/accounts/:accountId - Get account by ID
router.get('/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    // Check permission
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, accountId, 'read');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    const account = await accountService.getAccountById(accountId);

    if (!account) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Account not found',
      });
    }

    res.json({
      account: {
        id: account.id,
        provider: account.provider,
        email: account.email,
        displayName: account.displayName,
        status: account.status,
        lastSyncAt: account.lastSyncAt,
        lastSyncError: account.lastSyncError,
        settings: account.settings,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get account',
    });
  }
});

// POST /api/accounts/:accountId/sync - Trigger manual sync
router.post('/:accountId/sync', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    // Check permission
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, accountId, 'write');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    const account = await accountService.getAccountById(accountId);
    if (!account) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Account not found',
      });
    }

    // Add sync job to queue
    const job = await addSyncJob(accountId);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'trigger_sync',
      'account',
      accountId,
      undefined,
      req
    );

    res.json({
      message: 'Sync job queued',
      jobId: job.id,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to trigger sync',
    });
  }
});

// DELETE /api/accounts/:accountId - Delete account
router.delete('/:accountId', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await accountService.getAccountById(accountId);
    if (!account) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Account not found',
      });
    }

    await accountService.deleteAccount(accountId);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'delete_account',
      'account',
      accountId,
      { email: account.email },
      req
    );

    res.json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete account',
    });
  }
});

// Gmail OAuth routes

// GET /api/accounts/gmail/auth - Initiate Gmail OAuth
router.get('/gmail/auth', (req: Request, res: Response) => {
  try {
    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Gmail OAuth not configured',
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });

    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate auth URL',
    });
  }
});

// GET /api/accounts/gmail/callback - Gmail OAuth callback
router.get('/gmail/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Authorization code required',
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    const email = profile.data.emailAddress!;

    // Create account
    const account = await accountService.createAccount(
      'gmail',
      email,
      {
        provider: 'gmail',
        email,
        oauth: {
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token!,
          expires_at: tokens.expiry_date!,
        },
      },
      req.analyst?.id,
      email
    );

    // Grant permission to creator
    if (req.analyst?.id) {
      // This would be implemented in account_permissions table
      // For now, admins have all permissions automatically
    }

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'add_gmail_account',
      'account',
      account.id,
      { email },
      req
    );

    // Trigger initial sync
    await addSyncJob(account.id);

    res.json({
      message: 'Gmail account added successfully',
      account: {
        id: account.id,
        email: account.email,
        provider: account.provider,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to complete OAuth flow',
    });
  }
});

export default router;
