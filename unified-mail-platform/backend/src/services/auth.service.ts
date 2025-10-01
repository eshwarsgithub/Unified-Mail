import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { config } from '../config';

const authLogger = logger.child({ context: 'auth-service' });

export interface Analyst {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst' | 'viewer';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  analystId: string;
  email: string;
  role: string;
}

export class AuthService {
  async login(email: string, password: string): Promise<{ analyst: Analyst; token: string } | null> {
    try {
      // Get analyst by email
      const result = await db.query(
        'SELECT * FROM analysts WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        authLogger.warn('Login attempt with unknown email', { email });
        return null;
      }

      const analyst = result.rows[0];

      // Verify password
      const passwordMatch = await bcrypt.compare(password, analyst.password_hash);
      if (!passwordMatch) {
        authLogger.warn('Login attempt with incorrect password', { email });
        return null;
      }

      // Update last login
      await db.query(
        'UPDATE analysts SET last_login_at = NOW() WHERE id = $1',
        [analyst.id]
      );

      // Generate JWT
      const token = this.generateToken({
        analystId: analyst.id,
        email: analyst.email,
        role: analyst.role,
      });

      authLogger.info('Successful login', { email, analystId: analyst.id });

      return {
        analyst: this.mapDbRowToAnalyst(analyst),
        token,
      };
    } catch (error) {
      authLogger.error('Login failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      }) as JWTPayload;

      return payload;
    } catch (error) {
      authLogger.warn('Invalid token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async getAnalystById(analystId: string): Promise<Analyst | null> {
    try {
      const result = await db.query(
        'SELECT * FROM analysts WHERE id = $1',
        [analystId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToAnalyst(result.rows[0]);
    } catch (error) {
      authLogger.error('Failed to get analyst', {
        analystId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async createAnalyst(
    email: string,
    password: string,
    name: string,
    role: Analyst['role']
  ): Promise<Analyst> {
    try {
      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

      const result = await db.query(
        `INSERT INTO analysts (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [email, passwordHash, name, role]
      );

      authLogger.info('Analyst created', { email, role });

      return this.mapDbRowToAnalyst(result.rows[0]);
    } catch (error) {
      authLogger.error('Failed to create analyst', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async updatePassword(analystId: string, newPassword: string): Promise<void> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

      await db.query(
        'UPDATE analysts SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, analystId]
      );

      authLogger.info('Password updated', { analystId });
    } catch (error) {
      authLogger.error('Failed to update password', {
        analystId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async logAuditEvent(
    analystId: string | null,
    action: string,
    resourceType?: string,
    resourceId?: string,
    details?: any,
    req?: any
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO audit_logs (analyst_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          analystId,
          action,
          resourceType,
          resourceId,
          details ? JSON.stringify(details) : null,
          req?.ip || null,
          req?.get('user-agent') || null,
        ]
      );
    } catch (error) {
      authLogger.error('Failed to log audit event', {
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - audit logging should not break the main flow
    }
  }

  async hasPermission(analystId: string, accountId: string, permission: 'read' | 'write' | 'admin'): Promise<boolean> {
    try {
      // Check if analyst is admin (has all permissions)
      const analyst = await this.getAnalystById(analystId);
      if (analyst?.role === 'admin') {
        return true;
      }

      // Check explicit permission
      const result = await db.query(
        `SELECT 1 FROM account_permissions
         WHERE analyst_id = $1 AND account_id = $2 AND permission = $3`,
        [analystId, accountId, permission]
      );

      return result.rows.length > 0;
    } catch (error) {
      authLogger.error('Failed to check permission', {
        analystId,
        accountId,
        permission,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private mapDbRowToAnalyst(row: any): Analyst {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const authService = new AuthService();
