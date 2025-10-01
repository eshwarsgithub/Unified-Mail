import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

const authLogger = logger.child({ context: 'auth-middleware' });

// Extend Express Request to include analyst
declare global {
  namespace Express {
    interface Request {
      analyst?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const payload = authService.verifyToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Attach analyst to request
    req.analyst = {
      id: payload.analystId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    authLogger.error('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.analyst) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.analyst.role)) {
      authLogger.warn('Insufficient permissions', {
        analystId: req.analyst.id,
        requiredRoles: roles,
        actualRole: req.analyst.role,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

export async function requireAccountAccess(permission: 'read' | 'write' | 'admin' = 'read') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.analyst) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const accountId = req.params.accountId || req.body.accountId;
    if (!accountId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Account ID required',
      });
    }

    const hasPermission = await authService.hasPermission(req.analyst.id, accountId, permission);
    if (!hasPermission) {
      authLogger.warn('Access denied to account', {
        analystId: req.analyst.id,
        accountId,
        permission,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this account',
      });
    }

    next();
  };
}
