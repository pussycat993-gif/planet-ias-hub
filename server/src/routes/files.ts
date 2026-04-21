import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '../../../uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800') }, // 50MB default
});

// POST /channels/:channelId/files — upload file
router.post('/:channelId/files', upload.single('file'), async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { channelId } = req.params;
  const { message_body } = req.body;

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Store the original file name in messages.body so clients can render
    // a reasonable label even if they only have the message row
    const msgBody = message_body || req.file.originalname;

    const { rows: msgRows } = await client.query(
      `INSERT INTO messages (channel_id, sender_id, body, message_type)
       VALUES ($1, $2, $3, 'file') RETURNING id`,
      [channelId, userId, msgBody]
    );
    const messageId = msgRows[0].id;

    const { rows: fileRows } = await client.query(
      `INSERT INTO files (message_id, channel_id, uploaded_by, file_name, file_size, mime_type, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        messageId,
        channelId,
        userId,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        req.file.path,
      ]
    );

    // Re-fetch full message with sender + file joined for a ready-to-render payload
    const { rows: joined } = await client.query(
      `SELECT m.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar_url', u.avatar_url,
          'status', u.status
        ) AS sender,
        json_build_object(
          'id', f.id,
          'name', f.file_name,
          'size', f.file_size,
          'mime_type', f.mime_type,
          'basename', regexp_replace(f.storage_path, '^.*/', '')
        ) AS file,
        '[]'::json AS reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN files f ON f.message_id = m.id
       WHERE m.id = $1`,
      [messageId]
    );
    const message = joined[0];

    await client.query('COMMIT');

    // Broadcast to everyone in the channel room
    io.to(`channel:${channelId}`).emit('message:receive', message);

    return res.status(201).json({
      success: true,
      data: {
        file_id: fileRows[0].id,
        message,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('File upload error:', err);
    return res.status(500).json({ success: false, error: 'File upload failed' });
  } finally {
    client.release();
  }
});

// GET /channels/:channelId/files — list files in channel
router.get('/:channelId/files', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { limit = '50' } = req.query;

  try {
    const { rows } = await pool.query(
      `SELECT f.*, u.name AS uploaded_by_name, u.avatar_url AS uploaded_by_avatar
       FROM files f
       JOIN users u ON u.id = f.uploaded_by
       WHERE f.channel_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [channelId, parseInt(limit as string)]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

// GET /files/all — list all files across channels (for the sidebar Files tab)
router.get('/all', async (req: Request, res: Response) => {
  const { limit = '100', search } = req.query;
  try {
    const params: any[] = [parseInt(limit as string)];
    let whereClause = '';
    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause = ` AND LOWER(f.file_name) LIKE $2`;
    }
    const { rows } = await pool.query(
      `SELECT
         f.id, f.file_name, f.file_size, f.mime_type, f.created_at,
         regexp_replace(f.storage_path, '^.*/', '') AS basename,
         json_build_object(
           'id', u.id,
           'name', u.name,
           'avatar_url', u.avatar_url
         ) AS uploader,
         json_build_object(
           'id', c.id,
           'name', c.name,
           'type', c.type,
           'logo_color', c.logo_color,
           'logo_abbr', c.logo_abbr
         ) AS channel
       FROM files f
       JOIN users u ON u.id = f.uploaded_by
       JOIN channels c ON c.id = f.channel_id
       WHERE 1=1 ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT $1`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /files/all error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

// GET /files/:id/download — download file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM files WHERE id = $1',
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ success: false, error: 'File not found' });

    const file = rows[0];

    if (!fs.existsSync(file.storage_path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    return res.sendFile(path.resolve(file.storage_path));
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Download failed' });
  }
});

// DELETE /files/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND uploaded_by = $2',
      [req.params.id, userId]
    );

    if (!rows[0]) return res.status(404).json({ success: false, error: 'File not found or not yours' });

    // Delete from disk
    if (fs.existsSync(rows[0].storage_path)) {
      fs.unlinkSync(rows[0].storage_path);
    }

    // Delete from DB
    await pool.query('DELETE FROM files WHERE id = $1', [req.params.id]);

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

export default router;
