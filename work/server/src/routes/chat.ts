import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

const sendSchema = z.object({ toUserId: z.string().uuid(), content: z.string().min(1).max(1000) });

chatRouter.post('/private', async (req: AuthedRequest, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const { toUserId, content } = parsed.data;
  try {
    await pool.query('INSERT INTO messages (from_user_id, to_user_id, content) VALUES ($1,$2,$3)', [req.userId, toUserId, content]);
    res.json({ sent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể gửi tin nhắn' });
  }
});

// Lấy tin nhắn private giữa user hiện tại và 1 user khác
chatRouter.get('/private/:otherUserId', async (req: AuthedRequest, res) => {
  const other = req.params.otherUserId;
  try {
    const result = await pool.query(
      `SELECT m.*, u.username as from_username FROM messages m JOIN users u ON u.id = m.from_user_id
       WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
       ORDER BY created_at DESC LIMIT 100`,
      [req.userId, other]
    );
    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể lấy tin nhắn' });
  }
});
