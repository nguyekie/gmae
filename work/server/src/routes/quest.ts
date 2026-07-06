import { Router } from "express";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { buildWeaponInstanceStats } from "../utils/itemRarity.js";
import { assertOwnCharacter } from "./character.js";

export const questRouter = Router();
questRouter.use(requireAuth);

questRouter.get("/completed/:characterId", async (req: AuthedRequest, res) => {
  const character = await assertOwnCharacter(req.userId!, req.params.characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const result = await pool.query<{ quest_id: string }>(
    "SELECT quest_id FROM character_quests WHERE character_id = $1 AND status = 'completed'",
    [req.params.characterId]
  );
  res.json({ completedQuestIds: result.rows.map((row) => row.quest_id) });
});

interface QuestObjective {
  type: "kill";
  targetId: string;
  count: number;
  label: string;
}

interface QuestRow {
  id: string;
  title: string;
  zone: string;
  giver_npc_id: string;
  level_requirement: number;
  prerequisite_quest_id: string | null;
  dialogue_offer: string;
  dialogue_progress: string;
  dialogue_complete: string;
  objectives: QuestObjective[];
  reward_exp: number;
  reward_gold: number;
  reward_items: string[];
}

interface CharacterQuestRow {
  quest_id: string;
  status: "active" | "ready_to_turn_in" | "completed";
  progress: Record<string, number>;
}

function computeObjectiveProgress(quest: QuestRow, progress: Record<string, number>) {
  return quest.objectives.map((obj) => ({
    ...obj,
    current: Math.min(progress[obj.targetId] ?? 0, obj.count),
    done: (progress[obj.targetId] ?? 0) >= obj.count,
  }));
}

// Trạng thái nhiệm vụ của NPC đối với 1 nhân vật cụ thể — dùng để vẽ hộp thoại trên bản đồ
questRouter.get("/npc/:npcId", async (req: AuthedRequest, res) => {
  const characterId = req.query.characterId as string | undefined;
  if (!characterId) return res.status(400).json({ error: "Thiếu characterId" });

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const questsResult = await pool.query<QuestRow>("SELECT * FROM quests WHERE giver_npc_id = $1", [req.params.npcId]);
  const cqResult = await pool.query<CharacterQuestRow>(
    "SELECT quest_id, status, progress FROM character_quests WHERE character_id = $1",
    [characterId]
  );
  const cqByQuest = new Map(cqResult.rows.map((r) => [r.quest_id, r]));

  const quests = questsResult.rows.map((quest) => {
    const cq = cqByQuest.get(quest.id);
    const prereqDone = !quest.prerequisite_quest_id || cqByQuest.get(quest.prerequisite_quest_id)?.status === "completed";
    const levelOk = character.level >= quest.level_requirement;

    let state: "locked" | "not_started" | "active" | "ready_to_turn_in" | "completed";
    if (cq) {
      state = cq.status;
    } else if (!levelOk || !prereqDone) {
      state = "locked";
    } else {
      state = "not_started";
    }

    const dialogue =
      state === "not_started" || state === "locked"
        ? quest.dialogue_offer
        : state === "completed"
        ? quest.dialogue_complete
        : quest.dialogue_progress;

    return {
      id: quest.id,
      title: quest.title,
      levelRequirement: quest.level_requirement,
      state,
      dialogue,
      objectives: computeObjectiveProgress(quest, cq?.progress ?? {}),
      rewards: { exp: quest.reward_exp, gold: quest.reward_gold, items: quest.reward_items },
    };
  });

  res.json({ npcId: req.params.npcId, quests });
});

const acceptSchema = z.object({ characterId: z.string().uuid(), questId: z.string() });

// Nhận nhiệm vụ
questRouter.post("/accept", async (req: AuthedRequest, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, questId } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const questResult = await pool.query<QuestRow>("SELECT * FROM quests WHERE id = $1", [questId]);
  const quest = questResult.rows[0];
  if (!quest) return res.status(404).json({ error: "Không tìm thấy nhiệm vụ" });

  if (character.level < quest.level_requirement) {
    return res.status(400).json({ error: "Chưa đủ cấp độ để nhận nhiệm vụ này" });
  }
  if (quest.prerequisite_quest_id) {
    const prereq = await pool.query(
      "SELECT status FROM character_quests WHERE character_id = $1 AND quest_id = $2",
      [characterId, quest.prerequisite_quest_id]
    );
    if (prereq.rows[0]?.status !== "completed") {
      return res.status(400).json({ error: "Cần hoàn thành nhiệm vụ trước đó" });
    }
  }

  const existing = await pool.query("SELECT status FROM character_quests WHERE character_id = $1 AND quest_id = $2", [
    characterId,
    questId,
  ]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Nhiệm vụ đã được nhận hoặc đã hoàn thành" });
  }

  // Nhiệm vụ không có mục tiêu tiêu diệt nào (vd chỉ yêu cầu đạt cấp độ, đã kiểm tra ở trên)
  // thì sẵn sàng trả ngay, vì sẽ không có sự kiện "giết quái" nào để tự động chuyển trạng thái.
  const initialStatus = quest.objectives.length === 0 ? "ready_to_turn_in" : "active";

  await pool.query(
    "INSERT INTO character_quests (character_id, quest_id, status, progress) VALUES ($1,$2,$3,'{}')",
    [characterId, questId, initialStatus]
  );

  res.status(201).json({ accepted: true });
});

const turnInSchema = z.object({ characterId: z.string().uuid(), questId: z.string() });

// Trả nhiệm vụ — server tự xác thực tiến độ đã đủ trước khi phát thưởng, không tin client
questRouter.post("/turn-in", async (req: AuthedRequest, res) => {
  const parsed = turnInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, questId } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const questResult = await client.query<QuestRow>("SELECT * FROM quests WHERE id = $1", [questId]);
    const quest = questResult.rows[0];
    if (!quest) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Không tìm thấy nhiệm vụ" });
    }

    const cqResult = await client.query<CharacterQuestRow>(
      "SELECT quest_id, status, progress FROM character_quests WHERE character_id = $1 AND quest_id = $2 FOR UPDATE",
      [characterId, questId]
    );
    const cq = cqResult.rows[0];
    if (!cq || cq.status === "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nhiệm vụ chưa được nhận hoặc đã trả rồi" });
    }

    const allDone = quest.objectives.every((obj) => (cq.progress[obj.targetId] ?? 0) >= obj.count);
    if (!allDone) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Chưa hoàn thành mục tiêu nhiệm vụ" });
    }

    let newExp = character.exp + quest.reward_exp;
    let newLevel = character.level;
    let newMaxHp = character.max_hp;
    let newMaxMp = character.max_mp;
    let leveledUp = false;
    const expToNextLevel = (level: number) => Math.floor(100 * Math.pow(level, 1.5));
    while (newExp >= expToNextLevel(newLevel)) {
      newExp -= expToNextLevel(newLevel);
      newLevel++;
      newMaxHp += 12;
      newMaxMp += 6;
      leveledUp = true;
    }

    await client.query(
      "UPDATE characters SET exp = $1, level = $2, max_hp = $3, max_mp = $4, gold = gold + $5 WHERE id = $6",
      [newExp, newLevel, newMaxHp, newMaxMp, quest.reward_gold, characterId]
    );

    for (const itemTypeId of quest.reward_items) {
      // If reward is a weapon of rarity Rare+, attach instance special stats
      const itRes = await client.query('SELECT rarity, slot FROM item_types WHERE id = $1', [itemTypeId]);
      const it = itRes.rows[0];
      let inserted;
      if (it && it.slot === 'weapon') {
        const generated = buildWeaponInstanceStats(it.rarity, 'quest_reward');
        inserted = await client.query(
          "INSERT INTO item_instances (item_type_id, owner_character_id, location, instance_stats) VALUES ($1,$2,'inventory',$3) RETURNING id",
          [itemTypeId, characterId, JSON.stringify(generated ?? { note: 'quest_reward' })]
        );
      } else {
        inserted = await client.query(
          "INSERT INTO item_instances (item_type_id, owner_character_id, location) VALUES ($1,$2,'inventory') RETURNING id",
          [itemTypeId, characterId]
        );
      }
      await client.query(
        "INSERT INTO transactions (type, to_character_id, item_instance_id, gold_amount) VALUES ('quest_reward', $1, $2, 0)",
        [characterId, inserted.rows[0].id]
      );
    }
    if (quest.reward_gold > 0) {
      await client.query(
        "INSERT INTO transactions (type, to_character_id, gold_amount) VALUES ('quest_reward', $1, $2)",
        [characterId, quest.reward_gold]
      );
    }

    await client.query(
      "UPDATE character_quests SET status = 'completed', progress = $1, completed_at = now() WHERE character_id = $2 AND quest_id = $3",
      [JSON.stringify(quest.objectives.reduce((acc, o) => ({ ...acc, [o.targetId]: o.count }), {} as Record<string, number>)), characterId, questId]
    );

    await client.query("COMMIT");
    res.json({
      completed: true,
      rewards: { exp: quest.reward_exp, gold: quest.reward_gold, items: quest.reward_items, leveledUp, newLevel },
      dialogue: quest.dialogue_complete,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Lỗi xử lý trả nhiệm vụ" });
  } finally {
    client.release();
  }
});

// Gọi từ trong transaction của combat.ts sau khi thắng trận — cập nhật tiến độ nhiệm vụ dạng "kill"
// Không tin dữ liệu từ client: chỉ nhận characterId + monsterId (đã được server combat xác thực là có thật)
export async function applyKillProgress(client: PoolClient, characterId: string, monsterId: string) {
  const activeQuests = await client.query<{ id: string; objectives: QuestObjective[] }>(
    `SELECT q.id, q.objectives FROM character_quests cq
     JOIN quests q ON q.id = cq.quest_id
     WHERE cq.character_id = $1 AND cq.status = 'active' FOR UPDATE OF cq`,
    [characterId]
  );

  for (const quest of activeQuests.rows) {
    const killObjectives = quest.objectives.filter((o) => o.type === "kill" && o.targetId === monsterId);
    if (killObjectives.length === 0) continue;

    const cqResult = await client.query<{ progress: Record<string, number> }>(
      "SELECT progress FROM character_quests WHERE character_id = $1 AND quest_id = $2",
      [characterId, quest.id]
    );
    const progress = { ...cqResult.rows[0].progress };
    for (const obj of killObjectives) {
      progress[obj.targetId] = Math.min((progress[obj.targetId] ?? 0) + 1, obj.count);
    }

    const allDone = quest.objectives.every((obj) => (progress[obj.targetId] ?? 0) >= obj.count);
    await client.query("UPDATE character_quests SET status = $1, progress = $2 WHERE character_id = $3 AND quest_id = $4", [
      allDone ? "ready_to_turn_in" : "active",
      JSON.stringify(progress),
      characterId,
      quest.id,
    ]);
  }
}
