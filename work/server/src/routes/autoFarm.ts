import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter, computeSpecialBonus, computePotentialBonus } from "./character.js";
import { applyKillProgress } from "./quest.js";
import { recordTaskProgress } from "./dailyTasks.js";
import { buildWeaponInstanceStats } from "../utils/itemRarity.js";

const TICK_SECONDS = 60;
const MAX_CLAIM_SECONDS = 8 * 60 * 60;

export const autoFarmRouter = Router();
autoFarmRouter.use(requireAuth);

function expToNextLevel(level: number) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function computeLevelUp(character: any, expGained: number) {
  let newExp = character.exp + expGained;
  let newLevel = character.level;
  let newMaxHp = character.max_hp;
  let newMaxMp = character.max_mp;
  let leveledUp = false;
  while (newExp >= expToNextLevel(newLevel)) {
    newExp -= expToNextLevel(newLevel);
    newLevel++;
    newMaxHp += 12;
    newMaxMp += 6;
    leveledUp = true;
  }
  return { newExp, newLevel, newMaxHp, newMaxMp, leveledUp };
}

function getPendingCycles(lastClaimedAt: Date) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastClaimedAt.getTime()) / 1000));
  return Math.floor(Math.min(elapsedSeconds, MAX_CLAIM_SECONDS) / TICK_SECONDS);
}

async function getCombatBuffs(client: any, characterId: string) {
  await client.query("DELETE FROM character_buffs WHERE character_id = $1 AND expires_at <= now()", [characterId]);
  const result = await client.query(
    "SELECT buff_type, multiplier FROM character_buffs WHERE character_id = $1 AND expires_at > now()",
    [characterId]
  );
  const buffs = { potential: 1, drop: 1, gold: 1 };
  for (const row of result.rows) {
    const multiplier = Number(row.multiplier ?? 1);
    if (row.buff_type === "potential_gain") buffs.potential = Math.max(buffs.potential, multiplier);
    if (row.buff_type === "drop_rate") buffs.drop = Math.max(buffs.drop, multiplier);
    if (row.buff_type === "gold_gain") buffs.gold = Math.max(buffs.gold, multiplier);
  }
  return buffs;
}

async function rollAutoDrops(client: any, characterId: string, monster: any, cycles: number, dropRateBonus: number) {
  const droppedItems: string[] = [];
  const dropTable = monster.drop_table ?? [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const drop of dropTable) {
      const finalChance = Math.min(0.75, Math.max(0, drop.chance * 0.55 * (1 + dropRateBonus)));
      if (Math.random() >= finalChance) continue;

      const itRes = await client.query("SELECT rarity, slot, stackable FROM item_types WHERE id = $1", [drop.item_type_id]);
      const it = itRes.rows[0];
      if (it?.stackable) {
        const exist = await client.query(
          "SELECT id FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' FOR UPDATE",
          [characterId, drop.item_type_id]
        );
        if (exist.rows[0]) {
          await client.query("UPDATE item_instances SET quantity = quantity + 1 WHERE id = $1", [exist.rows[0].id]);
        } else {
          await client.query(
            "INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ($1,$2,'inventory',1)",
            [drop.item_type_id, characterId]
          );
        }
      } else {
        let instanceStats: any = {};
        if (it?.slot === "weapon") {
          const generated = buildWeaponInstanceStats(it.rarity, `auto_farm_${monster.id}`);
          if (generated) instanceStats = generated;
        }
        await client.query(
          "INSERT INTO item_instances (item_type_id, owner_character_id, location, instance_stats) VALUES ($1,$2,'inventory',$3)",
          [drop.item_type_id, characterId, JSON.stringify(instanceStats)]
        );
      }
      droppedItems.push(drop.item_type_id);
    }
  }
  return droppedItems;
}

async function countMaterialDrops(client: any, droppedItems: string[]) {
  if (droppedItems.length === 0) return 0;
  const uniqueIds = [...new Set(droppedItems)];
  const result = await client.query("SELECT id FROM item_types WHERE id = ANY($1::text[]) AND slot = 'material'", [uniqueIds]);
  const materialIds = new Set(result.rows.map((row: { id: string }) => row.id));
  return droppedItems.filter((itemTypeId) => materialIds.has(itemTypeId)).length;
}

autoFarmRouter.get("/:characterId", async (req: AuthedRequest, res) => {
  const character = await assertOwnCharacter(req.userId!, req.params.characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const options = await pool.query(
    `SELECT id, name, zone, level, exp_reward, gold_min, gold_max
     FROM monsters
     WHERE is_boss = false AND level <= $1
     ORDER BY level, name`,
    [character.level + 5]
  );
  const farm = await pool.query(
    `SELECT af.*, m.name, m.level, m.zone
     FROM character_auto_farm af
     JOIN monsters m ON m.id = af.monster_id
     WHERE af.character_id = $1`,
    [character.id]
  );
  const active = farm.rows[0];
  res.json({
    options: options.rows,
    active: active
      ? {
          monsterId: active.monster_id,
          monsterName: active.name,
          monsterLevel: active.level,
          zone: active.zone,
          startedAt: active.started_at,
          pendingCycles: getPendingCycles(new Date(active.last_claimed_at)),
          maxClaimHours: MAX_CLAIM_SECONDS / 3600,
        }
      : null,
  });
});

autoFarmRouter.post("/start", async (req: AuthedRequest, res) => {
  const parsed = z.object({ characterId: z.string().uuid(), monsterId: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, monsterId } = parsed.data;
  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const monsterRes = await pool.query("SELECT id, name, level, is_boss FROM monsters WHERE id = $1", [monsterId]);
  const monster = monsterRes.rows[0];
  if (!monster || monster.is_boss) return res.status(400).json({ error: "Chỉ có thể treo quái thường, không thể treo boss" });
  if (monster.level > character.level + 5) return res.status(400).json({ error: "Quái này quá mạnh để treo máy ổn định" });

  await pool.query(
    `INSERT INTO character_auto_farm (character_id, monster_id, started_at, last_claimed_at, updated_at)
     VALUES ($1, $2, now(), now(), now())
     ON CONFLICT (character_id)
     DO UPDATE SET monster_id = EXCLUDED.monster_id, started_at = now(), last_claimed_at = now(), updated_at = now()`,
    [characterId, monsterId]
  );
  res.json({ success: true, monsterName: monster.name });
});

autoFarmRouter.post("/claim", async (req: AuthedRequest, res) => {
  const parsed = z.object({ characterId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId } = parsed.data;
  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const farmRes = await client.query(
      `SELECT af.*, m.*
       FROM character_auto_farm af
       JOIN monsters m ON m.id = af.monster_id
       WHERE af.character_id = $1
       FOR UPDATE OF af`,
      [characterId]
    );
    const farm = farmRes.rows[0];
    if (!farm) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Bạn chưa bắt đầu treo quái" });
    }

    const cycles = getPendingCycles(new Date(farm.last_claimed_at));
    if (cycles <= 0) {
      await client.query("ROLLBACK");
      return res.json({ success: true, rewards: { cycles: 0, exp: 0, gold: 0, potential: 0, items: [] } });
    }

    const specialBonus = await computeSpecialBonus(characterId);
    const potentialBonus = computePotentialBonus(character);
    const combatBuffs = await getCombatBuffs(client, characterId);
    const expReward = Math.max(1, Math.floor(farm.exp_reward * cycles * 0.7 * (1 + specialBonus.exp)));
    const avgGold = Math.floor((farm.gold_min + farm.gold_max) / 2);
    const goldReward = Math.max(1, Math.floor(avgGold * cycles * 0.7 * combatBuffs.gold * (1 + potentialBonus.combat.goldGain)));
    const potentialReward = Math.max(1, Math.floor(expReward * 0.35 * combatBuffs.potential));
    const dropRateBonus = specialBonus.dropRate + potentialBonus.combat.dropRate + (combatBuffs.drop - 1);
    const droppedItems = await rollAutoDrops(client, characterId, farm, cycles, dropRateBonus);
    const { newExp, newLevel, newMaxHp, newMaxMp, leveledUp } = computeLevelUp(character, expReward);

    await client.query(
      `UPDATE characters
       SET exp = $1, level = $2, max_hp = $3, max_mp = $4, gold = gold + $5, potential = potential + $6
       WHERE id = $7`,
      [newExp, newLevel, newMaxHp, newMaxMp, goldReward, potentialReward, characterId]
    );
    await client.query("UPDATE character_auto_farm SET last_claimed_at = now(), updated_at = now() WHERE character_id = $1", [
      characterId,
    ]);
    await applyKillProgress(client, characterId, farm.monster_id, cycles);
    await recordTaskProgress(client, characterId, "monster_kill", cycles);
    const materialDropCount = await countMaterialDrops(client, droppedItems);
    if (materialDropCount > 0) await recordTaskProgress(client, characterId, "material_collect", materialDropCount);
    await client.query(
      "INSERT INTO transactions (type, to_character_id, gold_amount) VALUES ('auto_farm_reward', $1, $2)",
      [characterId, goldReward]
    );

    await client.query("COMMIT");
    res.json({
      success: true,
      rewards: { cycles, exp: expReward, gold: goldReward, potential: potentialReward, items: droppedItems, leveledUp, newLevel },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Lỗi nhận thưởng treo quái" });
  } finally {
    client.release();
  }
});

autoFarmRouter.post("/stop", async (req: AuthedRequest, res) => {
  const parsed = z.object({ characterId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const character = await assertOwnCharacter(req.userId!, parsed.data.characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });
  await pool.query("DELETE FROM character_auto_farm WHERE character_id = $1", [parsed.data.characterId]);
  res.json({ success: true });
});
