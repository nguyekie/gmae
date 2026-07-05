import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db.js";

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Chỉ chữ, số và dấu gạch dưới"),
  email: z.string().email(),
  password: z.string().min(6, "Mật khẩu cần tối thiểu 6 ký tự"),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { username, email, password } = parsed.data;

  const existing = await pool.query(
    "SELECT id FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Tên đăng nhập hoặc email đã tồn tại" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username",
    [username, email, passwordHash]
  );
  const user = result.rows[0];

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

  res.status(201).json({ token, user: { id: user.id, username: user.username } });
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Thiếu tên đăng nhập hoặc mật khẩu" });
  }
  const { username, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

  res.json({ token, user: { id: user.id, username: user.username } });
});
