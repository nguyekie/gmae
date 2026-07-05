import { readFile } from "fs/promises";
import { pool } from "../src/db.js";

async function migrate() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  console.log('Applying DB schema...');
  await pool.query(sql);
  console.log('Schema applied successfully');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
