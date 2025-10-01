import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'analyst', 'viewer']).default('analyst'),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authService.login(email, password);

    if (!result) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Log audit event
    await authService.logAuditEvent(result.analyst.id, 'login', undefined, undefined, undefined, req);

    res.json({
      analyst: {
        id: result.analyst.id,
        email: result.analyst.email,
        name: result.analyst.name,
        role: result.analyst.role,
      },
      token: result.token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
    });
  }
});

// POST /api/auth/register (admin only)
router.post('/register', authenticate, async (req: Request, res: Response) => {
  try {
    // Only admins can create new analysts
    if (req.analyst?.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can create new analysts',
      });
    }

    const { email, password, name, role } = registerSchema.parse(req.body);

    const analyst = await authService.createAnalyst(email, password, name, role);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst.id,
      'create_analyst',
      'analyst',
      analyst.id,
      { email, role },
      req
    );

    res.status(201).json({
      analyst: {
        id: analyst.id,
        email: analyst.email,
        name: analyst.name,
        role: analyst.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed',
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.analyst) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    const analyst = await authService.getAnalystById(req.analyst.id);

    if (!analyst) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Analyst not found',
      });
    }

    res.json({
      analyst: {
        id: analyst.id,
        email: analyst.email,
        name: analyst.name,
        role: analyst.role,
        lastLoginAt: analyst.lastLoginAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get analyst info',
    });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    if (!req.analyst) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    // Verify current password
    const analyst = await authService.getAnalystById(req.analyst.id);
    if (!analyst) {
      return res.status(404).json({
        error: 'Not Found',
      });
    }

    const loginResult = await authService.login(analyst.email, currentPassword);
    if (!loginResult) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect',
      });
    }

    // Update password
    await authService.updatePassword(req.analyst.id, newPassword);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst.id,
      'change_password',
      'analyst',
      req.analyst.id,
      undefined,
      req
    );

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change password',
    });
  }
});

export default router;
