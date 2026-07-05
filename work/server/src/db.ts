import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hầu hết PostgreSQL hosting miễn phí (Railway, Neon, Supabase) yêu cầu SSL
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Lỗi không mong muốn từ PostgreSQL pool:", err);
});
