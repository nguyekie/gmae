import { Router } from "express";
import { z } from "zod";
import type { Server as SocketServer } from "socket.io";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter, computeCompanionBonus, computeEquipmentBonus, computePotentialBonus, computeSpecialBonus } from "./character.js";
import { applyKillProgress } from "./quest.js";
import { recordTaskProgress } from "./dailyTasks.js";
import { buildWeaponInstanceStats } from "../utils/itemRarity.js";

function expToNextLevel(level: number) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function rollDamage(atk: number, targetDef: number, minimumDamage = 1) {
  return Math.max(minimumDamage, atk - targetDef + Math.floor(Math.random() * 5));
}

interface CombatSkill {
  id: string;
  class: "warrior" | "mage" | "archer";
  name: string;
  mpCost: number;
  damageMultiplier: number;
  ignoreDefPct?: number;
  critChance?: number;
  critMultiplier?: number;
  incomingDamageMultiplier?: number;
  dodgeBonus?: number;
}

const CLASS_SKILLS: CombatSkill[] = [
  { id: "power_slash", class: "warrior", name: "Chém Mạnh", mpCost: 20, damageMultiplier: 1.45 },
  { id: "armor_break", class: "warrior", name: "Phá Giáp", mpCost: 28, damageMultiplier: 1.2, ignoreDefPct: 0.35 },
  { id: "battle_roar", class: "warrior", name: "Chiến Hống", mpCost: 35, damageMultiplier: 1.25, incomingDamageMultiplier: 0.8 },
  { id: "fireball", class: "mage", name: "Cầu Lửa", mpCost: 35, damageMultiplier: 1.75 },
  { id: "frost_nova", class: "mage", name: "Băng Vực", mpCost: 42, damageMultiplier: 1.35, incomingDamageMultiplier: 0.75 },
  { id: "arcane_burst", class: "mage", name: "Bộc Phá Aether", mpCost: 65, damageMultiplier: 2.25 },
  { id: "precise_shot", class: "archer", name: "Bắn Chí Mạng", mpCost: 25, damageMultiplier: 1.2, critChance: 0.55, critMultiplier: 2 },
  { id: "rapid_shot", class: "archer", name: "Liên Xạ", mpCost: 32, damageMultiplier: 1.55 },
  { id: "shadow_step", class: "archer", name: "Ảnh Bộ", mpCost: 35, damageMultiplier: 1.15, dodgeBonus: 0.18 },
];

function getCombatSkill(characterClass: string, skillId?: string) {
  if (!skillId) return null;
  return CLASS_SKILLS.find((skill) => skill.id === skillId && skill.class === characterClass) ?? null;
}

function applySkillDamage(baseDamage: number, skill: CombatSkill | null, potentialBonus: ReturnType<typeof computePotentialBonus>) {
  if (!skill) return baseDamage;
  let damage = Math.floor(baseDamage * (skill.damageMultiplier + potentialBonus.breakthroughs.skillDamageBonus));
  if (skill.critChance && Math.random() < skill.critChance) {
    damage = Math.floor(damage * (skill.critMultiplier ?? 1.5));
  }
  return Math.max(1, damage);
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

// NOTE: removed daily attempt limit for world/event bosses — players may hit boss unlimited times.

// Áp dụng exp/level lên/gold cho nhân vật, trả về các giá trị mới (không tự UPDATE — caller tự quyết định)
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

// Rơi vật phẩm từ drop_table của quái — dùng chung cho quái thường và boss.
async function rollDrops(client: any, characterId: string, monster: any, dropRateBonus = 0, extraRolls = 0): Promise<string[]> {
  const droppedItems: string[] = [];
  for (let roll = 0; roll <= extraRolls; roll++) {
    for (const drop of monster.drop_table ?? []) {
      const finalChance = Math.min(0.95, Math.max(0, drop.chance * (1 + dropRateBonus)));
      if (Math.random() >= finalChance) continue;

      const itRes = await client.query("SELECT rarity, slot, base_stats, stackable FROM item_types WHERE id = $1", [
        drop.item_type_id,
      ]);
      const it = itRes.rows[0];
      let instanceStats: any = {};
      if (it && it.slot === "weapon") {
        const generated = buildWeaponInstanceStats(it.rarity, `dropped_from_${monster.id}`);
        if (generated) instanceStats = generated;
      }

      if (it && it.stackable) {
        const exist = await client.query(
          "SELECT id FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' FOR UPDATE",
          [characterId, drop.item_type_id]
        );
        if (exist.rows[0]) {
          await client.query("UPDATE item_instances SET quantity = quantity + 1 WHERE id = $1", [exist.rows[0].id]);
          await client.query(
            "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('combat_drop', $1, $2)",
            [characterId, exist.rows[0].id]
          );
        } else {
          const inserted = await client.query(
            "INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ($1,$2,'inventory',1) RETURNING id",
            [drop.item_type_id, characterId]
          );
          await client.query(
            "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('combat_drop', $1, $2)",
            [characterId, inserted.rows[0].id]
          );
        }
      } else {
        const inserted = await client.query(
          "INSERT INTO item_instances (item_type_id, owner_character_id, location, instance_stats) VALUES ($1,$2,'inventory',$3) RETURNING id",
          [drop.item_type_id, characterId, JSON.stringify(instanceStats)]
        );
        await client.query(
          "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('combat_drop', $1, $2)",
          [characterId, inserted.rows[0].id]
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

async function safelyRecordTaskProgress(client: any, characterId: string, type: "monster_kill" | "boss_kill" | "material_collect", amount = 1) {
  if (amount <= 0) return;
  await client.query("SAVEPOINT task_progress");
  try {
    await recordTaskProgress(client, characterId, type, amount);
    await client.query("RELEASE SAVEPOINT task_progress");
  } catch (err) {
    await client.query("ROLLBACK TO SAVEPOINT task_progress");
    await client.query("RELEASE SAVEPOINT task_progress");
    console.warn("Task progress skipped after combat:", err);
  }
}

function getWeeklyPeriodKey(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + start.getUTCDay()) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function recordBossDamage(client: any, monsterId: string, characterId: string, damage: number) {
  if (damage <= 0) return;
  await client.query(
    `INSERT INTO boss_damage_contributions (monster_id, character_id, period_key, damage_total, last_hit_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (monster_id, character_id, period_key)
     DO UPDATE SET damage_total = boss_damage_contributions.damage_total + EXCLUDED.damage_total, last_hit_at = now()`,
    [monsterId, characterId, getWeeklyPeriodKey(), damage]
  );
}

async function awardBossContributionRewards(client: any, monsterId: string) {
  const rewards = [
    { gold: 9000, potential: 900 },
    { gold: 5500, potential: 550 },
    { gold: 3000, potential: 300 },
  ];
  const result = await client.query(
    `SELECT character_id, damage_total
     FROM boss_damage_contributions
     WHERE monster_id = $1 AND period_key = $2
     ORDER BY damage_total DESC
     LIMIT 3`,
    [monsterId, getWeeklyPeriodKey()]
  );

  for (let index = 0; index < result.rows.length; index++) {
    const reward = rewards[index];
    const row = result.rows[index];
    await client.query("UPDATE characters SET gold = gold + $1, potential = potential + $2 WHERE id = $3", [
      reward.gold,
      reward.potential,
      row.character_id,
    ]);
    await client.query(
      "INSERT INTO transactions (type, to_character_id, gold_amount) VALUES ('boss_rank_reward', $1, $2)",
      [row.character_id, reward.gold]
    );
  }
}

export function buildCombatRouter(io: SocketServer) {
  const combatRouter = Router();
  combatRouter.use(requireAuth);

  // Danh sách quái trong 1 vùng — dùng cho client hiển thị lựa chọn trước khi khám phá
  combatRouter.get("/monsters/:zone", async (req, res) => {
    const result = await pool.query(
      "SELECT id, name, zone, level, hp, atk, def, is_boss FROM monsters WHERE zone = $1",
      [req.params.zone]
    );
    res.json({ monsters: result.rows });
  });

  // Trạng thái hiện tại của 1 boss (máu còn lại, đã chết hay chưa, còn bao lâu thì hồi sinh) —
  // dùng để vẽ thanh máu boss trên bản đồ/màn hình combat mà không cần tấn công trước.
  combatRouter.get("/boss/:monsterId", async (req, res) => {
    const monsterRes = await pool.query("SELECT * FROM monsters WHERE id = $1 AND is_boss = true", [
      req.params.monsterId,
    ]);
    const monster = monsterRes.rows[0];
    if (!monster) return res.status(404).json({ error: "Không tìm thấy boss" });

    const stateRes = await pool.query("SELECT * FROM boss_state WHERE monster_id = $1", [req.params.monsterId]);
    const state = stateRes.rows[0];
    if (!state) {
      return res.json({ currentHp: monster.hp, maxHp: monster.hp, dead: false, respawnInSeconds: 0 });
    }
    const dead = state.current_hp <= 0;
    let respawnInSeconds = 0;
    if (dead && state.defeated_at) {
      const respawnAt = new Date(state.defeated_at).getTime() + monster.respawn_seconds * 1000;
      respawnInSeconds = Math.max(0, Math.ceil((respawnAt - Date.now()) / 1000));
    }
    res.json({ currentHp: Math.max(0, state.current_hp), maxHp: state.max_hp, dead: dead && respawnInSeconds > 0, respawnInSeconds });
  });

  combatRouter.get("/boss/:monsterId/leaderboard", async (req, res) => {
    const result = await pool.query(
      `SELECT c.id AS character_id, c.name, c.level, b.damage_total, b.last_hit_at
       FROM boss_damage_contributions b
       JOIN characters c ON c.id = b.character_id
       WHERE b.monster_id = $1 AND b.period_key = $2
       ORDER BY b.damage_total DESC
       LIMIT 20`,
      [req.params.monsterId, getWeeklyPeriodKey()]
    );
    res.json({ periodKey: getWeeklyPeriodKey(), leaderboard: result.rows });
  });

  const exploreSchema = z.object({
    characterId: z.string().uuid(),
    monsterId: z.string(),
    skillId: z.string().optional(),
  });

  // Chiến đấu tự động (server tính toán toàn bộ để chống gian lận từ client)
  combatRouter.post("/explore", async (req: AuthedRequest, res) => {
    const parsed = exploreSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, monsterId, skillId } = parsed.data;

    const character = await assertOwnCharacter(req.userId!, characterId);
    if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

    const monsterResult = await pool.query("SELECT * FROM monsters WHERE id = $1", [monsterId]);
    const monster = monsterResult.rows[0];
    if (!monster) return res.status(404).json({ error: "Không tìm thấy quái vật" });

    // Lấy chỉ số tổng hợp (base + trang bị, gồm cả thuộc tính đặc biệt của đồ hiếm) — tính lại ở
    // server, không tin client.
    const gearBonus = await computeEquipmentBonus(characterId);
    const companionBonus = await computeCompanionBonus(characterId);
    const specialBonus = await computeSpecialBonus(characterId);
    const potentialBonus = computePotentialBonus(character);
    const selectedSkill = getCombatSkill(character.class, skillId);
    if (skillId && !selectedSkill) {
      return res.status(400).json({ error: "Kỹ năng không hợp lệ cho class này" });
    }
    if (selectedSkill && character.mp < selectedSkill.mpCost) {
      return res.status(400).json({ error: `Không đủ MP để dùng ${selectedSkill.name}` });
    }
    const bonus = {
      atk: gearBonus.atk + companionBonus.atk + potentialBonus.stats.atk + specialBonus.power,
      def: gearBonus.def + companionBonus.def + potentialBonus.stats.def,
      hp: gearBonus.hp + companionBonus.hp + potentialBonus.stats.hp,
    };
    const atk = character.base_atk + bonus.atk;
    const def = character.base_def + bonus.def;
    const maxEffectiveHp = character.max_hp + bonus.hp;
    const effectiveHp = Math.min(maxEffectiveHp, character.hp);

    // Gear and companions grant a temporary HP buffer in combat, so the "too weak" check must
    // use effective HP, not only the persisted base HP.
    if (effectiveHp <= 1) {
      return res.status(400).json({ error: "Bạn quá yếu để tấn công — hãy hồi phục HP trước khi tham chiến." });
    }

    if (monster.is_boss) {
      return handleBossFight(req, res, io, character, monster, atk, def, maxEffectiveHp, specialBonus, potentialBonus, selectedSkill);
    }

    // ===== Quái thường: máu luôn đầy mỗi lần đánh (không cần máu bền) =====
    let playerHp = effectiveHp;
    const playerHpAtStart = playerHp;
    let monsterHp = monster.hp;
    const monsterHpAtStart = monsterHp;
    const log: string[] = [];
    const skillMpCost = selectedSkill?.mpCost ?? 0;
    if (selectedSkill) log.push(`Bạn dùng kỹ năng ${selectedSkill.name}, tiêu hao ${selectedSkill.mpCost} MP`);
    let turn = 0;
    while (playerHp > 0 && monsterHp > 0) {
      const minimumPlayerDamage = Math.max(1, Math.floor(atk * 0.25));
      const targetDef = Math.max(0, Math.floor(monster.def * (1 - (selectedSkill?.ignoreDefPct ?? 0))));
      const baseDmgToMonster = rollDamage(atk, targetDef, minimumPlayerDamage);
      const dmgToMonster = applySkillDamage(baseDmgToMonster, selectedSkill, potentialBonus);
      monsterHp -= dmgToMonster;
      log.push(`Bạn gây ${dmgToMonster} sát thương lên ${monster.name}`);
      if (monsterHp <= 0) break;

      const dodgeRate = Math.min(
        0.75,
        potentialBonus.combat.dodgeRate + potentialBonus.breakthroughs.perfectDodgeRate + (selectedSkill?.dodgeBonus ?? 0)
      );
      if (Math.random() < dodgeRate) {
        log.push(`Bạn né được đòn tấn công của ${monster.name}`);
        if (Math.random() < potentialBonus.breakthroughs.counterRate) {
          const counterDamage = Math.max(1, Math.floor(dmgToMonster * 0.25));
          monsterHp -= counterDamage;
          log.push(`Phản đòn gây thêm ${counterDamage} sát thương`);
        }
        turn++;
        continue;
      }
      const incomingMultiplier = (selectedSkill?.incomingDamageMultiplier ?? 1) * (1 - potentialBonus.breakthroughs.damageReduction);
      const dmgToPlayer = Math.max(1, Math.floor(rollDamage(monster.atk, def, 1) * incomingMultiplier));
      playerHp -= dmgToPlayer;
      log.push(`${monster.name} gây ${dmgToPlayer} sát thương lên bạn`);
      turn++;
    }

    const victory = monsterHp <= 0 && playerHp > 0;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const combatBuffs = await getCombatBuffs(client, characterId);
      const dropRateBonus = specialBonus.dropRate + potentialBonus.combat.dropRate + (combatBuffs.drop - 1);

      if (!victory) {
        const damageTaken = Math.max(0, playerHpAtStart - Math.max(0, playerHp));
        const survivingHp = Math.max(1, Math.min(maxEffectiveHp, character.hp - damageTaken));
        await client.query("UPDATE characters SET hp = $1, mp = GREATEST(0, mp - $2) WHERE id = $3", [
          survivingHp,
          skillMpCost,
          characterId,
        ]);
        await client.query("COMMIT");
        return res.json({
          victory: false,
          log,
          remainingHp: survivingHp,
          monsterHp: Math.max(0, monsterHp),
          monsterMaxHp: monster.hp,
          damageDealt: Math.max(0, monsterHpAtStart - Math.max(0, monsterHp)),
        });
      }

      const baseGoldReward = monster.gold_min + Math.floor(Math.random() * (monster.gold_max - monster.gold_min + 1));
      const goldReward = Math.max(1, Math.floor(baseGoldReward * combatBuffs.gold * (1 + potentialBonus.combat.goldGain)));
      const expReward = Math.max(1, Math.floor(monster.exp_reward * (1 + specialBonus.exp)));
      const potentialReward = Math.max(1, Math.floor(expReward * 0.45 * combatBuffs.potential));
      const { newExp, newLevel, newMaxHp, newMaxMp, leveledUp } = computeLevelUp(character, expReward);

      await client.query(
        `UPDATE characters
         SET hp = $1, mp = GREATEST(0, mp - $2), exp = $3, level = $4, max_hp = $5, max_mp = $6, gold = gold + $7, potential = potential + $8
         WHERE id = $9`,
        [
          Math.max(1, Math.min(newMaxHp + bonus.hp, character.hp - Math.max(0, playerHpAtStart - Math.max(0, playerHp)))),
          skillMpCost,
          newExp,
          newLevel,
          newMaxHp,
          newMaxMp,
          goldReward,
          potentialReward,
          characterId,
        ]
      );

      await applyKillProgress(client, characterId, monsterId);
      await safelyRecordTaskProgress(client, characterId, "monster_kill", 1);
      const droppedItems = await rollDrops(client, characterId, monster, dropRateBonus, potentialBonus.breakthroughs.extraDropRolls);
      const materialDropCount = await countMaterialDrops(client, droppedItems);
      if (materialDropCount > 0) await safelyRecordTaskProgress(client, characterId, "material_collect", materialDropCount);

      await client.query("COMMIT");
      res.json({
        victory: true,
        log,
        monsterHp: Math.max(0, monsterHp),
        monsterMaxHp: monster.hp,
        damageDealt: Math.max(0, monsterHpAtStart - Math.max(0, monsterHp)),
        rewards: { exp: expReward, gold: goldReward, potential: potentialReward, items: droppedItems, leveledUp, newLevel },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Lỗi xử lý chiến đấu" });
    } finally {
      client.release();
    }
  });

  // ===== Chiến đấu với Boss: máu KHÔNG hồi/reset giữa các lượt đánh, tồn tại đến khi bị hạ gục =====
  async function handleBossFight(
    req: AuthedRequest,
    res: any,
    io: SocketServer,
    character: any,
    monster: any,
    atk: number,
    def: number,
    maxEffectiveHp: number,
    specialBonus: { dropRate: number; exp: number; power: number; potentialPerHour: number },
    potentialBonus: ReturnType<typeof computePotentialBonus>,
    selectedSkill: CombatSkill | null
  ) {
    const characterId = character.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const combatBuffs = await getCombatBuffs(client, characterId);
      const dropRateBonus = specialBonus.dropRate + potentialBonus.combat.dropRate + (combatBuffs.drop - 1);

      await client.query(
        "INSERT INTO boss_state (monster_id, current_hp, max_hp) VALUES ($1,$2,$2) ON CONFLICT (monster_id) DO NOTHING",
        [monster.id, monster.hp]
      );
      const stateRes = await client.query("SELECT * FROM boss_state WHERE monster_id = $1 FOR UPDATE", [monster.id]);
      let state = stateRes.rows[0];

      // Boss đã bị hạ trước đó — kiểm tra đã đủ thời gian hồi sinh chưa (KHÔNG tốn lượt đánh trong ngày
      // nếu boss đang hồi sinh, vì người chơi còn chưa được ra đòn)
      if (state.current_hp <= 0) {
        const respawnAt = state.defeated_at ? new Date(state.defeated_at).getTime() + monster.respawn_seconds * 1000 : 0;
        if (Date.now() < respawnAt) {
          await client.query("ROLLBACK");
          return res.json({
            victory: false,
            bossDead: true,
            respawnInSeconds: Math.ceil((respawnAt - Date.now()) / 1000),
            log: [`${monster.name} đã bị hạ gục và đang hồi sinh...`],
          });
        }
        // Đủ thời gian — boss hồi sinh lại full máu cho "đợt" mới
        await client.query("UPDATE boss_state SET current_hp = $1, defeated_at = NULL WHERE monster_id = $2", [
          monster.hp,
          monster.id,
        ]);
        state = { ...state, current_hp: monster.hp };
      }

      // (No daily attempt tracking — unlimited hits allowed for world/event bosses)

      // ===== Mô phỏng giao tranh: sát thương lên boss được TRỪ VÀO MÁU CHUNG, bền vững qua từng lượt đánh =====
      let playerHp = Math.min(maxEffectiveHp, character.hp);
      const playerHpAtStart = playerHp;
      let bossHp = state.current_hp;
      // Check if attacker owns the apex weapon — used for skill/bonus
      let apexOwned = false;
      try {
        const apexCheck = await client.query("SELECT 1 FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 LIMIT 1", [
          characterId,
          "apex_oblivion",
        ]);
        apexOwned = apexCheck.rows.length > 0;
      } catch (e) {
        console.warn('Error checking apex ownership', e);
      }
      const bossHpAtStart = bossHp;
      const log: string[] = [`⚔️ ${monster.name} còn ${bossHp}/${state.max_hp} HP trước trận này`];
      const skillMpCost = selectedSkill?.mpCost ?? 0;
      if (selectedSkill) log.push(`Báº¡n dÃ¹ng ká»¹ nÄƒng ${selectedSkill.name}, tiÃªu hao ${selectedSkill.mpCost} MP`);
      let turn = 0;
      while (playerHp > 0 && bossHp > 0 && turn < 30) {
        const bossMinimumDamage = Math.max(1, Math.floor(atk * 0.35), Math.floor(state.max_hp * 0.003));
        const targetDef = Math.max(0, Math.floor(monster.def * (1 - (selectedSkill?.ignoreDefPct ?? 0))));
        const baseDmgToBoss = rollDamage(atk, targetDef, bossMinimumDamage);
        let dmgToBoss = applySkillDamage(baseDmgToBoss, selectedSkill, potentialBonus);
        // SSS+ apex skill 'void_cleave' — passive on-hit: add 75% extra damage for this strike
        if (apexOwned) {
          const extra = Math.max(1, Math.floor(dmgToBoss * 0.75));
          dmgToBoss += extra;
          log.push(`Bạn sử dụng năng lực Xén Hư Không, gây thêm ${extra} sát thương`);
        }
        bossHp -= dmgToBoss;
        log.push(`Bạn gây ${dmgToBoss} sát thương lên ${monster.name}`);
        if (bossHp <= 0) break;

        const dodgeRate = Math.min(
          0.75,
          potentialBonus.combat.dodgeRate + potentialBonus.breakthroughs.perfectDodgeRate + (selectedSkill?.dodgeBonus ?? 0)
        );
        if (Math.random() < dodgeRate) {
          log.push(`Bạn né được đòn tấn công của ${monster.name}`);
          if (Math.random() < potentialBonus.breakthroughs.counterRate) {
            const counterDamage = Math.max(1, Math.floor(dmgToBoss * 0.25));
            bossHp -= counterDamage;
            log.push(`Pháº£n Ä‘Ã²n gÃ¢y thÃªm ${counterDamage} sÃ¡t thÆ°Æ¡ng`);
          }
          turn++;
          continue;
        }
        const hpRatio = state.max_hp > 0 ? bossHp / state.max_hp : 1;
        const phaseMultiplier = hpRatio <= 0.33 ? 1.35 : hpRatio <= 0.66 ? 1.15 : 1;
        const incomingMultiplier =
          phaseMultiplier * (selectedSkill?.incomingDamageMultiplier ?? 1) * (1 - potentialBonus.breakthroughs.damageReduction);
        const dmgToPlayer = Math.max(1, Math.floor(rollDamage(monster.atk, def, 1) * incomingMultiplier));
        playerHp -= dmgToPlayer;
        log.push(`${monster.name} gây ${dmgToPlayer} sát thương lên bạn`);
        turn++;
      }

      const damageDealt = Math.max(0, bossHpAtStart - Math.max(0, bossHp));
      const bossDefeated = bossHp <= 0;
      const damageTaken = Math.max(0, playerHpAtStart - Math.max(0, playerHp));
      const survivingHp = Math.max(1, Math.min(maxEffectiveHp, character.hp - damageTaken));

      await client.query("UPDATE characters SET hp = $1, mp = GREATEST(0, mp - $2) WHERE id = $3", [
        survivingHp,
        skillMpCost,
        characterId,
      ]);

      if (bossDefeated) {
        await client.query(
          "UPDATE boss_state SET current_hp = 0, defeated_at = now(), last_hit_by_character_id = $1, updated_at = now() WHERE monster_id = $2",
          [characterId, monster.id]
        );
      } else {
        await client.query(
          "UPDATE boss_state SET current_hp = $1, last_hit_by_character_id = $2, updated_at = now() WHERE monster_id = $3",
          [Math.max(0, bossHp), characterId, monster.id]
        );
      }

      await recordBossDamage(client, monster.id, characterId, damageDealt);

      // Thưởng "đóng góp sát thương" cho MỌI lượt tấn công boss, dù có hạ gục được hay không —
      // khuyến khích nhiều người cùng tham gia cày 1 boss. Cùng lúc, có 1 tỷ lệ nhỏ theo sát thương
      // để rơi vật phẩm siêu đặc biệt (ultra-rare) trên mỗi lần tấn công boss / event boss.
      const contributionExp = Math.max(1, Math.floor(damageDealt * 0.8));
      const contributionGold = Math.max(1, Math.floor(damageDealt * 0.4));
      let finalExp = contributionExp;
      let finalGold = contributionGold;
      let droppedItems: string[] = [];

      // --- Ultra-rare special drop (per-hit chance scaled by percent damage dealt) ---
      const specialPool = [
        "shard_of_silence",
        "fire_shard_fragment",
        "abyssal_fang_blade",
        "apex_oblivion",
        "celestial_judgement",
        "astral_aegis",
        "voidstar_helm",
        "riftlord_gauntlets",
        "celestial_steps",
        "singularity_amulet",
        "elemental_heart",
        "tidal_emperor_trident",
      ];
      try {
        const pct = state.max_hp > 0 ? damageDealt / state.max_hp : 0;
        const baseChance = 0.04; // 4% base
        const scaled = Math.min(0.12, pct * 0.08); // reward meaningful contribution, cap additional 12%
        let finalChance = Math.min(0.95, baseChance + scaled + dropRateBonus + potentialBonus.combat.sssPlusDropRate); // base capped bonus from damage
        // If attacker owns the apex SSS+ weapon, give a small bonus to special drop chance
        try {
          const apexRes = await client.query("SELECT 1 FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 LIMIT 1", [
            characterId,
          "apex_oblivion",
        ]);
        if (apexRes.rows.length > 0) {
            finalChance = Math.min(0.95, finalChance + 0.02); // +2% if player has the apex weapon
          }
        } catch (e) {
          console.warn('Error checking apex ownership', e);
        }
        if (Math.random() < finalChance) {
          // grant one random special item
          const chosen = specialPool[Math.floor(Math.random() * specialPool.length)];
          const itRes = await client.query("SELECT rarity, slot, stackable FROM item_types WHERE id = $1", [chosen]);
            const it = itRes.rows[0];
          if (it && it.stackable) {
            const exist = await client.query(
              "SELECT id FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' FOR UPDATE",
              [characterId, chosen]
            );
            if (exist.rows[0]) {
              await client.query("UPDATE item_instances SET quantity = quantity + 1 WHERE id = $1", [exist.rows[0].id]);
              await client.query(
                "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('combat_special_drop', $1, $2)",
                [characterId, exist.rows[0].id]
              );
            } else {
              const inserted = await client.query(
                "INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ($1,$2,'inventory',1) RETURNING id",
                [chosen, characterId]
              );
              await client.query(
                "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('combat_special_drop', $1, $2)",
                [characterId, inserted.rows[0].id]
              );
            }
            droppedItems.push(chosen);
            } else {
              // for non-stackable weapons of Rare+, generate instance special stats
              let instanceStats: any = { note: `special_drop_from_${monster.id}` };
              if (it && it.slot === 'weapon') {
                const generated = buildWeaponInstanceStats(it.rarity, `special_drop_from_${monster.id}`);
                if (generated) instanceStats = generated;
              }
              const inserted = await client.query(
                "INSERT INTO item_instances (item_type_id, owner_character_id, location, instance_stats) VALUES ($1,$2,'inventory',$3) RETURNING id",
                [chosen, characterId, JSON.stringify(instanceStats)]
              );
            await client.query(
              "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('combat_special_drop', $1, $2)",
              [characterId, inserted.rows[0].id]
            );
            droppedItems.push(chosen);
          }
        }
      } catch (e) {
        console.error('Special drop error', e);
      }

      if (bossDefeated) {
        // Người ra đòn kết liễu nhận thêm toàn bộ phần thưởng gốc + vật phẩm rơi
        finalExp += monster.exp_reward;
        finalGold += monster.gold_min + Math.floor(Math.random() * (monster.gold_max - monster.gold_min + 1));
        droppedItems = [
          ...droppedItems,
          ...(await rollDrops(client, characterId, monster, dropRateBonus, potentialBonus.breakthroughs.extraDropRolls)),
        ];
        await awardBossContributionRewards(client, monster.id);
        log.push("Top 3 sát thương boss tuần này đã nhận thưởng đóng góp riêng");
        // Guaranteed legendary reward for the killer (boss-kill trophy).
        // SSS+ stays ultra-rare in the boss drop table, not guaranteed.
        try {
          const guaranteedId = monster.id === "fallen_paladin" ? "titan_sunderer" : "abyssal_fang_blade";
          const itRes = await client.query("SELECT rarity, slot, stackable FROM item_types WHERE id = $1", [guaranteedId]);
          const it = itRes.rows[0];
          if (it && it.stackable) {
            const exist = await client.query(
              "SELECT id FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' FOR UPDATE",
              [characterId, guaranteedId]
            );
            if (exist.rows[0]) {
              await client.query("UPDATE item_instances SET quantity = quantity + 1 WHERE id = $1", [exist.rows[0].id]);
              await client.query(
                "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('boss_kill_reward', $1, $2)",
                [characterId, exist.rows[0].id]
              );
            } else {
              const inserted = await client.query(
                "INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ($1,$2,'inventory',1) RETURNING id",
                [guaranteedId, characterId]
              );
              await client.query(
                "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('boss_kill_reward', $1, $2)",
                [characterId, inserted.rows[0].id]
              );
            }
            droppedItems.push(guaranteedId);
          } else {
            // For non-stackable weapon rewards, include scaled instance special stats
            let instanceStats: any = { note: `boss_kill_reward_${monster.id}` };
            if (it && it.slot === 'weapon') {
              const generated = buildWeaponInstanceStats(it.rarity, `boss_kill_reward_${monster.id}`);
              if (generated) instanceStats = generated;
            }
            const inserted = await client.query(
              "INSERT INTO item_instances (item_type_id, owner_character_id, location, instance_stats) VALUES ($1,$2,'inventory',$3) RETURNING id",
              [guaranteedId, characterId, JSON.stringify(instanceStats)]
            );
            await client.query(
              "INSERT INTO transactions (type, to_character_id, item_instance_id) VALUES ('boss_kill_reward', $1, $2)",
              [characterId, inserted.rows[0].id]
            );
            droppedItems.push(guaranteedId);
          }
        } catch (e) {
          console.error("Boss killer reward error", e);
        }
      }

      finalExp = Math.max(1, Math.floor(finalExp * (1 + specialBonus.exp)));
      finalGold = Math.max(1, Math.floor(finalGold * combatBuffs.gold * (1 + potentialBonus.combat.goldGain)));
      const potentialReward = Math.max(1, Math.floor(finalExp * 0.45 * combatBuffs.potential));
      const { newExp, newLevel, newMaxHp, newMaxMp, leveledUp } = computeLevelUp(character, finalExp);
      await client.query(
        "UPDATE characters SET exp = $1, level = $2, max_hp = $3, max_mp = $4, gold = gold + $5, potential = potential + $6 WHERE id = $7",
        [newExp, newLevel, newMaxHp, newMaxMp, finalGold, potentialReward, characterId]
      );

      if (bossDefeated) {
        await applyKillProgress(client, characterId, monster.id);
        await safelyRecordTaskProgress(client, characterId, "boss_kill", 1);
      }
      const materialDropCount = await countMaterialDrops(client, droppedItems);
      if (materialDropCount > 0) await safelyRecordTaskProgress(client, characterId, "material_collect", materialDropCount);

      await client.query("COMMIT");

      if (bossDefeated) {
        // Thông báo toàn server — mọi người đang online đều biết boss vừa bị hạ gục
        io.emit("world:boss_defeated", { monsterId: monster.id, monsterName: monster.name, byCharacterName: character.name });
      }

      res.json({
        victory: bossDefeated,
        isBoss: true,
        log,
        bossHp: Math.max(0, bossHp),
        bossMaxHp: state.max_hp,
        damageDealt,
        remainingHp: survivingHp,
        rewards: { exp: finalExp, gold: finalGold, potential: potentialReward, items: droppedItems, leveledUp, newLevel, contribution: !bossDefeated },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Lỗi xử lý chiến đấu với boss" });
    } finally {
      client.release();
    }
  }

  return combatRouter;
}
