import { Router } from "express";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter } from "./character.js";

type TaskType = "monster_kill" | "boss_kill" | "material_collect";
type TaskPeriod = "daily" | "weekly";

interface TaskDef {
  id: string;
  period: TaskPeriod;
  title: string;
  description: string;
  type: TaskType;
  target: number;
  rewards: {
    gold: number;
    potential: number;
    items: string[];
  };
}

const TASKS: TaskDef[] = [
  {
    id: "daily_kill_20_monsters",
    period: "daily",
    title: "Diệt 20 quái",
    description: "Thắng 20 trận với quái thường trong ngày.",
    type: "monster_kill",
    target: 20,
    rewards: { gold: 2500, potential: 300, items: ["charm_double_potential"] },
  },
  {
    id: "daily_collect_5_materials",
    period: "daily",
    title: "Kiếm 5 nguyên liệu",
    description: "Nhặt 5 vật phẩm nguyên liệu từ quái hoặc boss.",
    type: "material_collect",
    target: 5,
    rewards: { gold: 1800, potential: 220, items: ["rift_core", "abyssal_dust"] },
  },
  {
    id: "weekly_defeat_3_bosses",
    period: "weekly",
    title: "Hạ 3 boss",
    description: "Góp đòn kết liễu để hạ 3 boss trong tuần.",
    type: "boss_kill",
    target: 3,
    rewards: { gold: 18000, potential: 1800, items: ["charm_double_drop", "tempered_rift_core", "oath_sigil"] },
  },
];

function getPeriodKey(period: TaskPeriod, now = new Date()) {
  if (period === "daily") return now.toISOString().slice(0, 10);
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function ensureProgressRows(client: PoolClient, characterId: string) {
  for (const task of TASKS) {
    await client.query(
      `INSERT INTO character_task_progress (character_id, task_id, period_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (character_id, task_id, period_key) DO NOTHING`,
      [characterId, task.id, getPeriodKey(task.period)]
    );
  }
}

export async function recordTaskProgress(client: PoolClient, characterId: string, type: TaskType, amount = 1) {
  const tasks = TASKS.filter((task) => task.type === type);
  if (tasks.length === 0 || amount <= 0) return;

  for (const task of tasks) {
    await client.query(
      `INSERT INTO character_task_progress (character_id, task_id, period_key, progress)
       VALUES ($1, $2, $3, LEAST($4::int, $5::int))
       ON CONFLICT (character_id, task_id, period_key)
       DO UPDATE SET
         progress = LEAST($5::int, character_task_progress.progress + $4::int),
         updated_at = now()
       WHERE character_task_progress.claimed = false`,
      [characterId, task.id, getPeriodKey(task.period), amount, task.target]
    );
  }
}

export const dailyTasksRouter = Router();
dailyTasksRouter.use(requireAuth);

dailyTasksRouter.get("/:characterId", async (req: AuthedRequest, res) => {
  const character = await assertOwnCharacter(req.userId!, req.params.characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureProgressRows(client, character.id);
    const result = await client.query(
      `SELECT task_id, period_key, progress, claimed
       FROM character_task_progress
       WHERE character_id = $1 AND period_key = ANY($2::text[])`,
      [character.id, [...new Set(TASKS.map((task) => getPeriodKey(task.period)))]]
    );
    await client.query("COMMIT");

    const rowsByTask = new Map(result.rows.map((row) => [row.task_id, row]));
    res.json({
      tasks: TASKS.map((task) => {
        const row = rowsByTask.get(task.id);
        const progress = Math.min(task.target, Number(row?.progress ?? 0));
        return {
          ...task,
          periodKey: getPeriodKey(task.period),
          progress,
          completed: progress >= task.target,
          claimed: Boolean(row?.claimed),
        };
      }),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể tải nhiệm vụ ngày/tuần" });
  } finally {
    client.release();
  }
});

const claimSchema = z.object({
  characterId: z.string().uuid(),
  taskId: z.string(),
});

dailyTasksRouter.post("/claim", async (req: AuthedRequest, res) => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, taskId } = parsed.data;
  const task = TASKS.find((entry) => entry.id === taskId);
  if (!task) return res.status(404).json({ error: "Không tìm thấy nhiệm vụ" });

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const periodKey = getPeriodKey(task.period);
    const progressRes = await client.query(
      `SELECT progress, claimed FROM character_task_progress
       WHERE character_id = $1 AND task_id = $2 AND period_key = $3
       FOR UPDATE`,
      [characterId, taskId, periodKey]
    );
    const progress = progressRes.rows[0];
    if (!progress || Number(progress.progress ?? 0) < task.target) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nhiệm vụ chưa hoàn thành" });
    }
    if (progress.claimed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Đã nhận thưởng nhiệm vụ này" });
    }

    await client.query("UPDATE characters SET gold = gold + $1, potential = potential + $2 WHERE id = $3", [
      task.rewards.gold,
      task.rewards.potential,
      characterId,
    ]);

    const itemInstanceIds: string[] = [];
    for (const itemTypeId of task.rewards.items) {
      const itemRes = await client.query("SELECT stackable FROM item_types WHERE id = $1", [itemTypeId]);
      const stackable = Boolean(itemRes.rows[0]?.stackable);
      if (stackable) {
        const existing = await client.query(
          "SELECT id FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' FOR UPDATE",
          [characterId, itemTypeId]
        );
        if (existing.rows[0]) {
          await client.query("UPDATE item_instances SET quantity = quantity + 1 WHERE id = $1", [existing.rows[0].id]);
          itemInstanceIds.push(existing.rows[0].id);
        } else {
          const inserted = await client.query(
            "INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ($1,$2,'inventory',1) RETURNING id",
            [itemTypeId, characterId]
          );
          itemInstanceIds.push(inserted.rows[0].id);
        }
      } else {
        const inserted = await client.query(
          "INSERT INTO item_instances (item_type_id, owner_character_id, location) VALUES ($1,$2,'inventory') RETURNING id",
          [itemTypeId, characterId]
        );
        itemInstanceIds.push(inserted.rows[0].id);
      }
    }

    await client.query(
      "UPDATE character_task_progress SET claimed = true, updated_at = now() WHERE character_id = $1 AND task_id = $2 AND period_key = $3",
      [characterId, taskId, periodKey]
    );
    await client.query(
      "INSERT INTO transactions (type, to_character_id, gold_amount) VALUES ('task_reward', $1, $2)",
      [characterId, task.rewards.gold]
    );
    await client.query("COMMIT");
    res.json({ success: true, rewards: task.rewards, itemInstanceIds });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể nhận thưởng nhiệm vụ" });
  } finally {
    client.release();
  }
});
