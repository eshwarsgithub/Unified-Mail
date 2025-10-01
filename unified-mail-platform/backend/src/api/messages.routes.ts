import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { messageService } from '../services/message.service';
import { searchService } from '../services/search.service';
import { storageService } from '../services/storage.service';
import { authService } from '../services/auth.service';
import { addSendJob } from '../queues';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/messages - List messages with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      accountIds: z.string().optional().transform((val) => val?.split(',')),
      folders: z.string().optional().transform((val) => val?.split(',')),
      labels: z.string().optional().transform((val) => val?.split(',')),
      isRead: z.string().optional().transform((val) => val === 'true'),
      isStarred: z.string().optional().transform((val) => val === 'true'),
      isSpam: z.string().optional().transform((val) => val === 'true'),
      hasAttachments: z.string().optional().transform((val) => val === 'true'),
      fromEmail: z.string().optional(),
      fromDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
      toDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
      page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
      pageSize: z.string().optional().transform((val) => val ? parseInt(val) : 50),
    });

    const filters = schema.parse(req.query);

    const limit = filters.pageSize || 50;
    const offset = ((filters.page || 1) - 1) * limit;

    const { messages, total } = await messageService.getMessages({
      accountIds: filters.accountIds,
      folders: filters.folders,
      labels: filters.labels,
      isRead: filters.isRead,
      isStarred: filters.isStarred,
      isSpam: filters.isSpam,
      hasAttachments: filters.hasAttachments,
      fromEmail: filters.fromEmail,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      limit,
      offset,
    });

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        accountId: msg.accountId,
        messageId: msg.messageId,
        threadId: msg.threadId,
        folder: msg.folder,
        subject: msg.subject,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        toEmails: msg.toEmails,
        date: msg.date,
        hasAttachments: msg.hasAttachments,
        isRead: msg.isRead,
        isStarred: msg.isStarred,
        labels: msg.labels,
        bodyPreview: msg.bodyPreview,
      })),
      pagination: {
        total,
        page: filters.page || 1,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
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
      message: 'Failed to get messages',
    });
  }
});

// POST /api/messages/search - Search messages with full-text
router.post('/search', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      query: z.string().optional(),
      accountIds: z.array(z.string()).optional(),
      folders: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      hasAttachments: z.boolean().optional(),
      isRead: z.boolean().optional(),
      isStarred: z.boolean().optional(),
      fromEmail: z.string().optional(),
      fromDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
      toDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
    });

    const searchParams = schema.parse(req.body);

    const result = await searchService.search(searchParams);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'search_messages',
      undefined,
      undefined,
      { query: searchParams.query },
      req
    );

    res.json({
      messages: result.messages,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
      aggregations: result.aggregations,
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
      message: 'Search failed',
    });
  }
});

// GET /api/messages/:messageId - Get message by ID
router.get('/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await messageService.getMessageById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Message not found',
      });
    }

    // Check permission to access this account
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, message.accountId, 'read');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    // Get attachments
    const attachments = await messageService.getMessageAttachments(messageId);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'view_message',
      'message',
      messageId,
      undefined,
      req
    );

    res.json({
      message: {
        ...message,
        attachments: attachments.map((att) => ({
          id: att.id,
          filename: att.filename,
          contentType: att.content_type,
          size: att.size_bytes,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get message',
    });
  }
});

// GET /api/messages/:messageId/raw - Get raw email content
router.get('/:messageId/raw', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await messageService.getMessageById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Message not found',
      });
    }

    // Check permission
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, message.accountId, 'read');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    // Get raw email from S3
    const rawEmail = await storageService.getMessage(message.s3Key);

    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="${message.messageId}.eml"`);
    res.send(rawEmail);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get raw message',
    });
  }
});

// PATCH /api/messages/:messageId - Update message flags
router.patch('/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const schema = z.object({
      isRead: z.boolean().optional(),
      isStarred: z.boolean().optional(),
    });

    const updates = schema.parse(req.body);

    const message = await messageService.getMessageById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Message not found',
      });
    }

    // Check permission
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, message.accountId, 'write');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    await messageService.updateMessageFlags(messageId, updates);

    // Update in search index
    await searchService.updateMessage(messageId, updates);

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'update_message',
      'message',
      messageId,
      updates,
      req
    );

    res.json({
      message: 'Message updated successfully',
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
      message: 'Failed to update message',
    });
  }
});

// POST /api/messages/:messageId/reply - Reply to a message
router.post('/:messageId/reply', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const schema = z.object({
      body: z.string().min(1),
      bodyHtml: z.string().optional(),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
    });

    const { body, bodyHtml, cc, bcc } = schema.parse(req.body);

    const originalMessage = await messageService.getMessageById(messageId);

    if (!originalMessage) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Message not found',
      });
    }

    // Check permission
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, originalMessage.accountId, 'write');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    // Queue send job
    const job = await addSendJob({
      accountId: originalMessage.accountId,
      to: [originalMessage.fromEmail],
      cc,
      bcc,
      subject: `Re: ${originalMessage.subject}`,
      bodyText: body,
      bodyHtml,
      inReplyTo: originalMessage.messageId,
      references: [...(originalMessage.references || []), originalMessage.messageId],
    });

    // Log audit event
    await authService.logAuditEvent(
      req.analyst!.id,
      'reply_message',
      'message',
      messageId,
      { to: [originalMessage.fromEmail] },
      req
    );

    res.json({
      message: 'Reply queued for sending',
      jobId: job.id,
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
      message: 'Failed to reply to message',
    });
  }
});

// GET /api/messages/:messageId/attachments/:attachmentId - Download attachment
router.get('/:messageId/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const { messageId, attachmentId } = req.params;

    const message = await messageService.getMessageById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Message not found',
      });
    }

    // Check permission
    if (req.analyst?.role !== 'admin') {
      const hasAccess = await authService.hasPermission(req.analyst!.id, message.accountId, 'read');
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }

    const attachments = await messageService.getMessageAttachments(messageId);
    const attachment = attachments.find((att) => att.id === attachmentId);

    if (!attachment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Attachment not found',
      });
    }

    // Get attachment from S3
    const content = await storageService.getAttachment(attachment.s3_key);

    res.setHeader('Content-Type', attachment.content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to download attachment',
    });
  }
});

export default router;
