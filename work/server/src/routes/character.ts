import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const characterRouter = Router();
characterRouter.use(requireAuth);

const CLASS_BASE_STATS: Record<string, { hp: number; mp: number; atk: number; def: number; spd: number }> = {
  warrior: { hp: 150, mp: 30, atk: 15, def: 12, spd: 8 },
  mage: { hp: 90, mp: 120, atk: 8, def: 6, spd: 9 },
  archer: { hp: 110, mp: 60, atk: 13, def: 8, spd: 12 },
};

const EQUIPMENT_SLOTS = ["weapon", "armor", "helmet", "gloves", "boots", "trinket", "shard", "costume"];
const POTENTIAL_BRANCHES = ["strength", "vitality", "agility", "luck"] as const;
type PotentialBranch = (typeof POTENTIAL_BRANCHES)[number];

export function getPotentialUpgradeCost(level: number) {
  return Math.floor(120 + level * 45 + Math.pow(level, 1.35) * 18);
}

export function computePotentialBonus(character: any) {
  const strength = Number(character.potential_strength ?? 0);
  const vitality = Number(character.potential_vitality ?? 0);
  const agility = Number(character.potential_agility ?? 0);
  const luck = Number(character.potential_luck ?? 0);
  return {
    levels: { strength, vitality, agility, luck },
    stats: {
      atk: strength * 3,
      def: vitality,
      spd: agility * 2,
      hp: vitality * 18,
      mp: 0,
    },
    combat: {
      dodgeRate: Math.min(0.35, agility * 0.003),
      dropRate: luck * 0.006,
      goldGain: luck * 0.01,
      sssPlusDropRate: luck * 0.0015,
    },
    breakthroughs: {
      strengthTier: Math.floor(strength / 10),
      vitalityTier: Math.floor(vitality / 10),
      agilityTier: Math.floor(agility / 10),
      luckTier: Math.floor(luck / 10),
      skillDamageBonus: Math.floor(strength / 10) * 0.05,
      damageReduction: Math.min(0.3, Math.floor(vitality / 10) * 0.03),
      perfectDodgeRate: Math.min(0.25, Math.floor(agility / 10) * 0.02),
      counterRate: Math.min(0.25, Math.floor(agility / 10) * 0.02),
      extraDropRolls: Math.min(3, Math.floor(luck / 10)),
    },
    nextCosts: {
      strength: getPotentialUpgradeCost(strength),
      vitality: getPotentialUpgradeCost(vitality),
      agility: getPotentialUpgradeCost(agility),
      luck: getPotentialUpgradeCost(luck),
    },
  };
}

export function computePowerScore(stats: { atk: number; def: number; spd: number; maxHp: number; maxMp: number }, level: number) {
  return Math.floor(stats.atk * 12 + stats.def * 10 + stats.spd * 8 + stats.maxHp * 0.55 + stats.maxMp * 0.35 + level * 35);
}

const createSchema = z.object({
  name: z.string().min(2).max(32),
  class: z.enum(["warrior", "mage", "archer"]),
});

// Danh sách nhân vật của người dùng hiện tại
characterRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, name, class, level, exp, hp, max_hp, mp, max_mp, gold, potential,
            potential_strength, potential_vitality, potential_agility, potential_luck
     FROM characters WHERE user_id = $1 ORDER BY created_at`,
    [req.userId]
  );
  res.json({ characters: result.rows });
});

characterRouter.get("/leaderboard/power", async (_req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, name, class, level, max_hp, max_mp, base_atk, base_def, base_spd,
            potential_strength, potential_vitality, potential_agility, potential_luck
     FROM characters`
  );
  const entries = [];
  for (const character of result.rows) {
    const gearBonus = await computeEquipmentBonus(character.id);
    const companionBonus = await computeCompanionBonus(character.id);
    const potentialBonus = computePotentialBonus(character);
    const computedStats = {
      atk: character.base_atk + gearBonus.atk + companionBonus.atk + potentialBonus.stats.atk,
      def: character.base_def + gearBonus.def + companionBonus.def + potentialBonus.stats.def,
      spd: character.base_spd + gearBonus.spd + companionBonus.spd + potentialBonus.stats.spd,
      maxHp: character.max_hp + gearBonus.hp + companionBonus.hp + potentialBonus.stats.hp,
      maxMp: character.max_mp + gearBonus.mp + companionBonus.mp,
    };
    entries.push({
      id: character.id,
      name: character.name,
      class: character.class,
      level: character.level,
      powerScore: computePowerScore(computedStats, character.level),
      computedStats,
    });
  }
  entries.sort((a, b) => b.powerScore - a.powerScore || b.level - a.level || a.name.localeCompare(b.name));
  res.json({ leaderboard: entries.slice(0, 50) });
});

// Tạo nhân vật mới
characterRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, class: charClass } = parsed.data;
  const stats = CLASS_BASE_STATS[charClass];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dup = await client.query("SELECT id FROM characters WHERE name = $1", [name]);
    if (dup.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Tên nhân vật đã được sử dụng" });
    }

    const result = await client.query(
      `INSERT INTO characters (user_id, name, class, hp, max_hp, mp, max_mp, base_atk, base_def, base_spd)
       VALUES ($1,$2,$3,$4,$4,$5,$5,$6,$7,$8)
       RETURNING id, name, class, level, exp, hp, max_hp, mp, max_mp, gold`,
      [req.userId, name, charClass, stats.hp, stats.mp, stats.atk, stats.def, stats.spd]
    );
    const character = result.rows[0];

    for (const slot of EQUIPMENT_SLOTS) {
      await client.query(
        "INSERT INTO equipment_slots (character_id, slot_type, item_instance_id) VALUES ($1,$2,NULL)",
        [character.id, slot]
      );
    }

    const STARTING_WEAPON: Record<string, string> = {
      warrior: "sword_rusty",
      mage: "staff_apprentice",
      archer: "bow_hunter",
    };
    const weaponInstance = await client.query(
      "INSERT INTO item_instances (item_type_id, owner_character_id, location) VALUES ($1,$2,'equipped') RETURNING id",
      [STARTING_WEAPON[charClass], character.id]
    );
    await client.query(
      "UPDATE equipment_slots SET item_instance_id = $1 WHERE character_id = $2 AND slot_type = 'weapon'",
      [weaponInstance.rows[0].id, character.id]
    );
    await client.query(
      "INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ('potion_minor_heal',$1,'inventory',2)",
      [character.id]
    );

    await client.query("COMMIT");
    res.status(201).json({ character });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể tạo nhân vật" });
  } finally {
    client.release();
  }
});

// Helper: xác minh character thuộc về user hiện tại — dùng lại ở các route khác
// Tính tổng bonus chỉ số từ toàn bộ trang bị đang mặc — bao gồm cả `base_stats` (cố định theo loại
// vật phẩm) VÀ `instance_stats.special` (thuộc tính ngẫu nhiên riêng của từng item rơi ra, xem
// combat.ts). Trước đây chỉ base_stats được tính, khiến đồ epic/legendary rơi ra có thuộc tính đặc
// biệt nhưng không thực sự mạnh hơn khi chiến đấu — đây là hàm dùng chung để cả character.ts (hiển
// thị) và combat.ts (tính sát thương thật) luôn nhất quán.
export async function computeEquipmentBonus(characterId: string) {
  const equipped = await pool.query(
    `SELECT it.base_stats, it.special, ii.instance_stats FROM equipment_slots es
     JOIN item_instances ii ON ii.id = es.item_instance_id
     JOIN item_types it ON it.id = ii.item_type_id
     WHERE es.character_id = $1`,
    [characterId]
  );
  let atk = 0;
  let def = 0;
  let spd = 0;
  let hp = 0;
  let mp = 0;
  for (const row of equipped.rows) {
    atk += row.base_stats?.atk ?? 0;
    def += row.base_stats?.def ?? 0;
    spd += row.base_stats?.spd ?? 0;
    hp += row.base_stats?.hp ?? 0;
    mp += row.base_stats?.mp ?? 0;
    atk += row.special?.passive?.atk_bonus ?? 0;
    def += row.special?.passive?.def_bonus ?? 0;
    spd += row.special?.passive?.spd_bonus ?? 0;
    hp += row.special?.passive?.hp_bonus ?? 0;
    mp += row.special?.passive?.mp_bonus ?? 0;
    const bonuses = Array.isArray(row.instance_stats?.bonuses)
      ? row.instance_stats.bonuses
      : row.instance_stats?.special
      ? [row.instance_stats.special]
      : [];
    for (const bonus of bonuses) {
      if (bonus?.stat === "atk") atk += bonus.bonus ?? 0;
      if (bonus?.stat === "def") def += bonus.bonus ?? 0;
      if (bonus?.stat === "spd") spd += bonus.bonus ?? 0;
      if (bonus?.stat === "hp") hp += bonus.bonus ?? 0;
      if (bonus?.stat === "mp") mp += bonus.bonus ?? 0;
    }
  }
  return { atk, def, spd, hp, mp };
}

export async function computeSpecialBonus(characterId: string) {
  const equipped = await pool.query(
    `SELECT it.special
     FROM equipment_slots es
     JOIN item_instances ii ON ii.id = es.item_instance_id
     JOIN item_types it ON it.id = ii.item_type_id
     WHERE es.character_id = $1`,
    [characterId]
  );
  const owned = await pool.query(
    `SELECT it.special, ii.quantity
     FROM item_instances ii
     JOIN item_types it ON it.id = ii.item_type_id
     WHERE ii.owner_character_id = $1 AND ii.location IN ('inventory','equipped') AND ii.quantity > 0`,
    [characterId]
  );
  const bonus = {
    dropRate: 0,
    exp: 0,
    power: 0,
    potentialPerHour: 0,
  };
  for (const row of equipped.rows) {
    const passive = row.special?.passive ?? {};
    bonus.dropRate += passive.drop_rate_bonus ?? passive.boss_drop_rate_bonus ?? 0;
    bonus.exp += passive.exp_bonus ?? 0;
    bonus.power += passive.power_bonus ?? 0;
  }
  for (const row of owned.rows) {
    const passive = row.special?.passive ?? {};
    bonus.potentialPerHour += (passive.potential_per_hour_bonus ?? 0) * (row.quantity ?? 1);
  }
  return bonus;
}

export async function computeCompanionBonus(characterId: string) {
  const result = await pool.query(
    `SELECT ct.bonuses, cc.level
     FROM character_companions cc
     JOIN companion_types ct ON ct.id = cc.companion_type_id
     WHERE cc.character_id = $1 AND cc.active = true
     LIMIT 1`,
    [characterId]
  );
  const companion = result.rows[0];
  const bonuses = companion?.bonuses ?? {};
  const level = companion?.level ?? 1;
  return {
    atk: (bonuses.atk ?? 0) * level,
    def: (bonuses.def ?? 0) * level,
    spd: (bonuses.spd ?? 0) * level,
    hp: (bonuses.hp ?? 0) * level,
    mp: (bonuses.mp ?? 0) * level,
  };
}

export async function assertOwnCharacter(userId: string, characterId: string) {
  const result = await pool.query(
    "SELECT * FROM characters WHERE id = $1 AND user_id = $2",
    [characterId, userId]
  );
  return result.rows[0] ?? null;
}


// Chi tiết 1 nhân vật (chỉ số tổng hợp = base + đồ đang mặc)
const upgradePotentialSchema = z.object({
  branch: z.enum(POTENTIAL_BRANCHES),
});

characterRouter.post("/:id/potential", async (req: AuthedRequest, res) => {
  const parsed = upgradePotentialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nhánh tiềm năng không hợp lệ" });

  const character = await assertOwnCharacter(req.userId!, req.params.id);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const branch = parsed.data.branch as PotentialBranch;
  const column = `potential_${branch}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`SELECT potential, ${column} FROM characters WHERE id = $1 FOR UPDATE`, [
      character.id,
    ]);
    const row = result.rows[0];
    const currentLevel = Number(row[column] ?? 0);
    const cost = getPotentialUpgradeCost(currentLevel);
    if (Number(row.potential ?? 0) < cost) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Cần ${cost.toLocaleString("vi-VN")} tiềm năng để nâng cấp` });
    }

    await client.query(`UPDATE characters SET potential = potential - $1, ${column} = ${column} + 1 WHERE id = $2`, [
      cost,
      character.id,
    ]);
    await client.query("COMMIT");
    res.json({ success: true, branch, spent: cost, newLevel: currentLevel + 1 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể nâng tiềm năng" });
  } finally {
    client.release();
  }
});

characterRouter.get("/:id", async (req: AuthedRequest, res) => {
  const character = await assertOwnCharacter(req.userId!, req.params.id);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const equipped = await pool.query(
    `SELECT es.slot_type, ii.id as item_instance_id, it.name, it.rarity, it.base_stats, it.level_requirement, it.special, ii.instance_stats
     FROM equipment_slots es
     LEFT JOIN item_instances ii ON ii.id = es.item_instance_id
     LEFT JOIN item_types it ON it.id = ii.item_type_id
     WHERE es.character_id = $1`,
    [character.id]
  );

  const gearBonus = await computeEquipmentBonus(character.id);
  const companionBonus = await computeCompanionBonus(character.id);
  const potentialBonus = computePotentialBonus(character);
  const bonus = {
    atk: gearBonus.atk + companionBonus.atk + potentialBonus.stats.atk,
    def: gearBonus.def + companionBonus.def + potentialBonus.stats.def,
    spd: gearBonus.spd + companionBonus.spd + potentialBonus.stats.spd,
    hp: gearBonus.hp + companionBonus.hp + potentialBonus.stats.hp,
    mp: gearBonus.mp + companionBonus.mp,
  };

  const computedStats = {
    atk: character.base_atk + bonus.atk,
    def: character.base_def + bonus.def,
    spd: character.base_spd + bonus.spd,
    maxHp: character.max_hp + bonus.hp,
    maxMp: character.max_mp + bonus.mp,
  };
  const specialBonus = await computeSpecialBonus(character.id);
  computedStats.atk += specialBonus.power;

  res.json({
    character,
    equipment: equipped.rows,
    companionBonus,
    potentialBonus,
    specialBonus,
    powerScore: computePowerScore(computedStats, character.level),
    computedStats,
  });
});
