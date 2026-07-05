import { Router } from "express";
import { z } from "zod";
import type { Server as SocketServer } from "socket.io";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter, computeCompanionBonus, computeEquipmentBonus } from "./character.js";
import { applyKillProgress } from "./quest.js";
import { buildWeaponInstanceStats } from "../utils/itemRarity.js";

function expToNextLevel(level: number) {
  return Math.floor(100 * Math.pow(level, 1.5));
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
async function rollDrops(client: any, characterId: string, monster: any): Promise<string[]> {
  const droppedItems: string[] = [];
  for (const drop of monster.drop_table ?? []) {
    if (Math.random() >= drop.chance) continue;

    const itRes = await client.query("SELECT rarity, slot, base_stats, stackable FROM item_types WHERE id = $1", [
      drop.item_type_id,
    ]);
    const it = itRes.rows[0];
    let instanceStats: any = {};
    // Attach instance-level special stats for weapons of rarity Rare+ and SSS+
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
  return droppedItems;
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

  const exploreSchema = z.object({
    characterId: z.string().uuid(),
    monsterId: z.string(),
  });

  // Chiến đấu tự động (server tính toán toàn bộ để chống gian lận từ client)
  combatRouter.post("/explore", async (req: AuthedRequest, res) => {
    const parsed = exploreSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, monsterId } = parsed.data;

    const character = await assertOwnCharacter(req.userId!, characterId);
    if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

    // Prevent actions from characters that have been reduced to 1 HP (demo safety previously
    // used Math.max(1, ...) to avoid death). Disallow attacking when HP <= 1 so players must
    // heal before initiating combat.
    if (character.hp <= 1) {
      return res.status(400).json({ error: "Bạn quá yếu để tấn công — hãy hồi phục HP trước khi tham chiến." });
    }

    const monsterResult = await pool.query("SELECT * FROM monsters WHERE id = $1", [monsterId]);
    const monster = monsterResult.rows[0];
    if (!monster) return res.status(404).json({ error: "Không tìm thấy quái vật" });

    // Lấy chỉ số tổng hợp (base + trang bị, gồm cả thuộc tính đặc biệt của đồ hiếm) — tính lại ở
    // server, không tin client.
    const gearBonus = await computeEquipmentBonus(characterId);
    const companionBonus = await computeCompanionBonus(characterId);
    const bonus = {
      atk: gearBonus.atk + companionBonus.atk,
      def: gearBonus.def + companionBonus.def,
      hp: gearBonus.hp + companionBonus.hp,
    };
    const atk = character.base_atk + bonus.atk;
    const def = character.base_def + bonus.def;
    const gearHp = bonus.hp ?? 0;

    if (monster.is_boss) {
      return handleBossFight(req, res, io, character, monster, atk, def, gearHp);
    }

    // ===== Quái thường: máu luôn đầy mỗi lần đánh (không cần máu bền) =====
    let playerHp = character.hp + gearHp;
    let monsterHp = monster.hp;
    const log: string[] = [];
    let turn = 0;
    while (playerHp > 0 && monsterHp > 0 && turn < 30) {
      const dmgToMonster = Math.max(1, atk - monster.def + Math.floor(Math.random() * 5));
      monsterHp -= dmgToMonster;
      log.push(`Bạn gây ${dmgToMonster} sát thương lên ${monster.name}`);
      if (monsterHp <= 0) break;

      const dmgToPlayer = Math.max(1, monster.atk - def + Math.floor(Math.random() * 5));
      playerHp -= dmgToPlayer;
      log.push(`${monster.name} gây ${dmgToPlayer} sát thương lên bạn`);
      turn++;
    }

    const victory = monsterHp <= 0 && playerHp > 0;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (!victory) {
        const survivingHp = Math.max(1, Math.min(character.max_hp, playerHp - gearHp)); // gear HP acts as a temporary combat buffer
        await client.query("UPDATE characters SET hp = $1 WHERE id = $2", [survivingHp, characterId]);
        await client.query("COMMIT");
        return res.json({ victory: false, log, remainingHp: survivingHp });
      }

      const goldReward = monster.gold_min + Math.floor(Math.random() * (monster.gold_max - monster.gold_min + 1));
      const { newExp, newLevel, newMaxHp, newMaxMp, leveledUp } = computeLevelUp(character, monster.exp_reward);

      await client.query(
        `UPDATE characters SET hp = $1, exp = $2, level = $3, max_hp = $4, max_mp = $5, gold = gold + $6 WHERE id = $7`,
        [Math.max(1, Math.min(newMaxHp, playerHp - gearHp)), newExp, newLevel, newMaxHp, newMaxMp, goldReward, characterId]
      );

      await applyKillProgress(client, characterId, monsterId);
      const droppedItems = await rollDrops(client, characterId, monster);

      await client.query("COMMIT");
      res.json({
        victory: true,
        log,
        rewards: { exp: monster.exp_reward, gold: goldReward, items: droppedItems, leveledUp, newLevel },
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
    gearHp: number
  ) {
    const characterId = character.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

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
      let playerHp = character.hp + gearHp;
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
      let turn = 0;
      while (playerHp > 0 && bossHp > 0 && turn < 30) {
        let dmgToBoss = Math.max(1, atk - monster.def + Math.floor(Math.random() * 5));
        // SSS+ apex skill 'void_cleave' — passive on-hit: add 75% extra damage for this strike
        if (apexOwned) {
          const extra = Math.max(1, Math.floor(dmgToBoss * 0.75));
          dmgToBoss += extra;
          log.push(`Bạn sử dụng năng lực Xén Hư Không, gây thêm ${extra} sát thương`);
        }
        bossHp -= dmgToBoss;
        log.push(`Bạn gây ${dmgToBoss} sát thương lên ${monster.name}`);
        if (bossHp <= 0) break;

        const dmgToPlayer = Math.max(1, monster.atk - def + Math.floor(Math.random() * 5));
        playerHp -= dmgToPlayer;
        log.push(`${monster.name} gây ${dmgToPlayer} sát thương lên bạn`);
        turn++;
      }

      const damageDealt = Math.max(0, bossHpAtStart - Math.max(0, bossHp));
      const bossDefeated = bossHp <= 0;
      const survivingHp = Math.max(1, Math.min(character.max_hp, playerHp - gearHp));

      await client.query("UPDATE characters SET hp = $1 WHERE id = $2", [survivingHp, characterId]);

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

      // Thưởng "đóng góp sát thương" cho MỌI lượt tấn công boss, dù có hạ gục được hay không —
      // khuyến khích nhiều người cùng tham gia cày 1 boss. Cùng lúc, có 1 tỷ lệ nhỏ theo sát thương
      // để rơi vật phẩm siêu đặc biệt (ultra-rare) trên mỗi lần tấn công boss / event boss.
      const contributionExp = Math.max(1, Math.floor(damageDealt * 0.8));
      const contributionGold = Math.max(1, Math.floor(damageDealt * 0.4));
      let finalExp = contributionExp;
      let finalGold = contributionGold;
      let droppedItems: string[] = [];

      // --- Ultra-rare special drop (per-hit chance scaled by percent damage dealt) ---
      const specialPool = ["shard_of_silence", "fire_shard_fragment", "abyssal_fang_blade"];
      try {
        const pct = state.max_hp > 0 ? damageDealt / state.max_hp : 0;
        const baseChance = 0.01; // 1% base
        const scaled = Math.min(0.09, pct * 0.05); // scale modestly by damage percent, cap additional 9%
        let finalChance = baseChance + scaled; // base capped bonus from damage
        // If attacker owns the apex SSS+ weapon, give a small bonus to special drop chance
        try {
          const apexRes = await client.query("SELECT 1 FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 LIMIT 1", [
            characterId,
            "apex_oblivion",
          ]);
          if (apexRes.rows.length > 0) {
            finalChance += 0.01; // +1% if player has the apex weapon
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
        droppedItems = await rollDrops(client, characterId, monster);
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

      const { newExp, newLevel, newMaxHp, newMaxMp, leveledUp } = computeLevelUp(character, finalExp);
      await client.query(
        "UPDATE characters SET exp = $1, level = $2, max_hp = $3, max_mp = $4, gold = gold + $5 WHERE id = $6",
        [newExp, newLevel, newMaxHp, newMaxMp, finalGold, characterId]
      );

      if (bossDefeated) {
        await applyKillProgress(client, characterId, monster.id);
      }

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
        remainingHp: survivingHp,
        rewards: { exp: finalExp, gold: finalGold, items: droppedItems, leveledUp, newLevel, contribution: !bossDefeated },
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
