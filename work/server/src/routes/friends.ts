import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

// Tìm người dùng theo tên đăng nhập — để gửi lời mời kết bạn mà không cần biết UUID
friendsRouter.get('/lookup/:username', async (req: AuthedRequest, res) => {
  const username = req.params.username.trim();
  if (!username) return res.status(400).json({ error: 'Thiếu tên đăng nhập' });
  try {
    const result = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người chơi này' });
    if (user.id === req.userId) return res.status(400).json({ error: 'Đây là chính bạn' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể tìm người dùng' });
  }
});

const requestSchema = z.object({ targetUserId: z.string().uuid() });

friendsRouter.post('/request', async (req: AuthedRequest, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const { targetUserId } = parsed.data;
  if (targetUserId === req.userId) return res.status(400).json({ error: 'Không thể kết bạn với chính mình' });

  try {
    await pool.query(
      'INSERT INTO friends (requester_user_id, addressee_user_id, status) VALUES ($1,$2,$3) ON CONFLICT (requester_user_id, addressee_user_id) DO UPDATE SET status = EXCLUDED.status',
      [req.userId, targetUserId, 'pending']
    );
    res.status(201).json({ requested: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể gửi lời mời' });
  }
});

const respondSchema = z.object({ requesterUserId: z.string().uuid(), accept: z.boolean() });

friendsRouter.post('/respond', async (req: AuthedRequest, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const { requesterUserId, accept } = parsed.data;
  try {
    if (accept) {
      await pool.query('UPDATE friends SET status = $1 WHERE requester_user_id = $2 AND addressee_user_id = $3', ['accepted', requesterUserId, req.userId]);
      res.json({ accepted: true });
    } else {
      await pool.query('DELETE FROM friends WHERE requester_user_id = $1 AND addressee_user_id = $2', [requesterUserId, req.userId]);
      res.json({ declined: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu' });
  }
});

// Lấy nhân vật (đại diện) của 1 user khác — dùng để thách đấu PvP hoặc hiển thị thông tin
friendsRouter.get('/:userId/character', async (req: AuthedRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, class, level FROM characters WHERE user_id = $1 ORDER BY created_at LIMIT 1',
      [req.params.userId]
    );
    const character = result.rows[0];
    if (!character) return res.status(404).json({ error: 'Người này chưa có nhân vật' });
    res.json({ character });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể lấy thông tin nhân vật' });
  }
});

// Danh sách bạn và lời mời
friendsRouter.get('/', async (req: AuthedRequest, res) => {
  try {
    const pending = await pool.query(
      `SELECT f.requester_user_id AS user_id, u.username, f.created_at FROM friends f JOIN users u ON u.id = f.requester_user_id WHERE f.addressee_user_id = $1 AND f.status = 'pending'`,
      [req.userId]
    );
    const friends = await pool.query(
      `SELECT u.id as user_id, u.username FROM users u WHERE u.id IN (
         SELECT CASE WHEN f.requester_user_id = $1 THEN f.addressee_user_id ELSE f.requester_user_id END
         FROM friends f WHERE (f.requester_user_id = $1 OR f.addressee_user_id = $1) AND f.status = 'accepted'
      )`,
      [req.userId]
    );
    res.json({ pending: pending.rows, friends: friends.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể lấy danh sách bạn' });
  }
});
