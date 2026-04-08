import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';

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

    // Create message record
    const { rows: msgRows } = await client.query(
      `INSERT INTO messages (channel_id, sender_id, body, message_type)
       VALUES ($1, $2, $3, 'file') RETURNING *`,
      [channelId, userId, message_body || null]
    );

    // Create file record
    const { rows: fileRows } = await client.query(
      `INSERT INTO files (message_id, channel_id, uploaded_by, file_name, file_size, mime_type, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        msgRows[0].id,
        channelId,
        userId,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        req.file.path,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        file_id: fileRows[0].id,
        message_id: msgRows[0].id,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        storage_path: req.file.path,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // Delete uploaded file on error
    if (req.file?.path) fs.unlinkSync(req.file.path);
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
