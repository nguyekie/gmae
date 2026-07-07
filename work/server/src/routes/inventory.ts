import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter, computeCompanionBonus, computeEquipmentBonus, computePotentialBonus } from "./character.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

const EQUIPPABLE_SLOTS = ["weapon", "armor", "helmet", "gloves", "boots", "trinket", "shard", "costume"] as const;

async function getEffectiveCaps(characterId: string, charRow: any) {
  const gearBonus = await computeEquipmentBonus(characterId);
  const companionBonus = await computeCompanionBonus(characterId);
  const potentialBonus = computePotentialBonus(charRow);
  return {
    maxHp: charRow.max_hp + gearBonus.hp + companionBonus.hp + potentialBonus.stats.hp,
    maxMp: charRow.max_mp + gearBonus.mp + companionBonus.mp,
  };
}

async function applyUseBuff(client: any, characterId: string, useSpec: any) {
  if (!useSpec?.buff_type) return null;
  const durationMinutes = Math.max(1, Number(useSpec.duration_minutes ?? 60));
  const multiplier = Math.max(1, Number(useSpec.multiplier ?? 2));
  await client.query(
    `INSERT INTO character_buffs (character_id, buff_type, multiplier, expires_at)
     VALUES ($1, $2, $3, now() + ($4::int * interval '1 minute'))
     ON CONFLICT (character_id, buff_type)
     DO UPDATE SET
       multiplier = EXCLUDED.multiplier,
       expires_at = GREATEST(character_buffs.expires_at, now()) + ($4::int * interval '1 minute')`,
    [characterId, useSpec.buff_type, multiplier, durationMinutes]
  );
  return { buffType: useSpec.buff_type, multiplier, durationMinutes };
}

async function consumeItemInstance(client: any, itemInstanceId: string, quantity: number, useQuantity: number) {
  if (quantity > useQuantity) {
    await client.query("UPDATE item_instances SET quantity = quantity - $1 WHERE id = $2", [useQuantity, itemInstanceId]);
  } else {
    await client.query("UPDATE item_instances SET owner_character_id = NULL, quantity = 0 WHERE id = $1", [itemInstanceId]);
  }
}

inventoryRouter.get("/:characterId", async (req: AuthedRequest, res) => {
  const character = await assertOwnCharacter(req.userId!, req.params.characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const result = await pool.query(
    `SELECT ii.id, ii.quantity, ii.instance_stats, it.name, it.rarity, it.slot, it.base_stats,
            it.level_requirement, it.tradable, it.stackable, it.special
     FROM item_instances ii
     JOIN item_types it ON it.id = ii.item_type_id
     WHERE ii.owner_character_id = $1 AND ii.location = 'inventory'
     ORDER BY it.rarity DESC`,
    [character.id]
  );
  res.json({ items: result.rows });
});

const equipSchema = z.object({
  characterId: z.string().uuid(),
  itemInstanceId: z.string().uuid(),
});

inventoryRouter.post("/equip", async (req: AuthedRequest, res) => {
  const parsed = equipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, itemInstanceId } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const itemResult = await client.query(
      `SELECT ii.*, it.slot, it.level_requirement, it.name
       FROM item_instances ii
       JOIN item_types it ON it.id = ii.item_type_id
       WHERE ii.id = $1 AND ii.owner_character_id = $2 AND ii.location = 'inventory'
       FOR UPDATE`,
      [itemInstanceId, characterId]
    );
    const item = itemResult.rows[0];
    if (!item) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vật phẩm không có trong túi đồ" });
    }
    if (!EQUIPPABLE_SLOTS.includes(item.slot)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Vật phẩm này không thể mặc" });
    }
    if (character.level < item.level_requirement) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Cần đạt cấp ${item.level_requirement} để mặc "${item.name}"` });
    }

    const currentSlot = await client.query(
      "SELECT item_instance_id FROM equipment_slots WHERE character_id = $1 AND slot_type = $2 FOR UPDATE",
      [characterId, item.slot]
    );
    const previousItemId = currentSlot.rows[0]?.item_instance_id ?? null;
    if (previousItemId) {
      await client.query("UPDATE item_instances SET location = 'inventory' WHERE id = $1", [previousItemId]);
    }

    await client.query(
      `INSERT INTO equipment_slots (character_id, slot_type, item_instance_id)
       VALUES ($2, $3, $1)
       ON CONFLICT (character_id, slot_type)
       DO UPDATE SET item_instance_id = EXCLUDED.item_instance_id`,
      [itemInstanceId, characterId, item.slot]
    );
    await client.query("UPDATE item_instances SET location = 'equipped' WHERE id = $1", [itemInstanceId]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể mặc vật phẩm" });
  } finally {
    client.release();
  }
});

const useSchema = z.object({ characterId: z.string().uuid(), itemInstanceId: z.string().uuid() });

inventoryRouter.post("/use", async (req: AuthedRequest, res) => {
  const parsed = useSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, itemInstanceId } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const itemResult = await client.query(
      `SELECT ii.id, ii.quantity, it.base_stats, it.name, it.special
       FROM item_instances ii
       JOIN item_types it ON it.id = ii.item_type_id
       WHERE ii.id = $1 AND ii.owner_character_id = $2 AND ii.location = 'inventory'
       FOR UPDATE`,
      [itemInstanceId, characterId]
    );
    const item = itemResult.rows[0];
    if (!item) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vật phẩm không có trong túi đồ" });
    }

    const heal = item.base_stats?.heal ?? 0;
    const mana = item.base_stats?.mana ?? 0;
    const buff = await applyUseBuff(client, characterId, item.special?.use);
    if (heal === 0 && mana === 0 && !buff) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Không thể sử dụng vật phẩm này" });
    }

    const charRes = await client.query("SELECT * FROM characters WHERE id = $1 FOR UPDATE", [characterId]);
    const charRow = charRes.rows[0];
    const caps = await getEffectiveCaps(characterId, charRow);
    const newHp = heal > 0 ? Math.min(caps.maxHp, charRow.hp + heal) : charRow.hp;
    const newMp = mana > 0 ? Math.min(caps.maxMp, charRow.mp + mana) : charRow.mp;

    await client.query("UPDATE characters SET hp = $1, mp = $2 WHERE id = $3", [newHp, newMp, characterId]);
    await consumeItemInstance(client, itemInstanceId, item.quantity ?? 1, 1);
    await client.query("COMMIT");
    res.json({ success: true, hp: newHp, mp: newMp, buff });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể sử dụng vật phẩm" });
  } finally {
    client.release();
  }
});

const useMultipleSchema = z.object({
  characterId: z.string().uuid(),
  items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).optional() })).min(1),
});

inventoryRouter.post("/use-multiple", async (req: AuthedRequest, res) => {
  const parsed = useMultipleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, items } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const charRes = await client.query("SELECT * FROM characters WHERE id = $1 FOR UPDATE", [characterId]);
    const charRow = charRes.rows[0];
    const caps = await getEffectiveCaps(characterId, charRow);
    let newHp = charRow.hp;
    let newMp = charRow.mp;
    const buffs: any[] = [];

    for (const it of items) {
      const itemResult = await client.query(
        `SELECT ii.id, ii.quantity, it.base_stats, it.name, it.special
         FROM item_instances ii
         JOIN item_types it ON it.id = ii.item_type_id
         WHERE ii.id = $1 AND ii.owner_character_id = $2 AND ii.location = 'inventory'
         FOR UPDATE`,
        [it.id, characterId]
      );
      const row = itemResult.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: `Vật phẩm không có trong túi đồ: ${it.id}` });
      }

      const qtyToUse = Math.min(it.qty ?? 1, row.quantity ?? 1);
      const heal = (row.base_stats?.heal ?? 0) * qtyToUse;
      const mana = (row.base_stats?.mana ?? 0) * qtyToUse;
      const buff = await applyUseBuff(client, characterId, row.special?.use);
      if (buff) buffs.push(buff);
      if (heal === 0 && mana === 0 && !buff) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Không thể sử dụng vật phẩm này: ${row.name}` });
      }

      if (heal > 0) newHp = Math.min(caps.maxHp, newHp + heal);
      if (mana > 0) newMp = Math.min(caps.maxMp, newMp + mana);
      await consumeItemInstance(client, it.id, row.quantity ?? 1, qtyToUse);
    }

    await client.query("UPDATE characters SET hp = $1, mp = $2 WHERE id = $3", [newHp, newMp, characterId]);
    await client.query("COMMIT");
    res.json({ success: true, hp: newHp, mp: newMp, buffs });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể sử dụng vật phẩm" });
  } finally {
    client.release();
  }
});

const unequipSchema = z.object({
  characterId: z.string().uuid(),
  slotType: z.enum(EQUIPPABLE_SLOTS),
});

inventoryRouter.post("/unequip", async (req: AuthedRequest, res) => {
  const parsed = unequipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, slotType } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const slot = await client.query(
      "SELECT item_instance_id FROM equipment_slots WHERE character_id = $1 AND slot_type = $2 FOR UPDATE",
      [characterId, slotType]
    );
    const itemId = slot.rows[0]?.item_instance_id;
    if (!itemId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Không có vật phẩm nào đang mặc ở slot này" });
    }

    await client.query("UPDATE item_instances SET location = 'inventory' WHERE id = $1", [itemId]);
    await client.query(
      "UPDATE equipment_slots SET item_instance_id = NULL WHERE character_id = $1 AND slot_type = $2",
      [characterId, slotType]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể gỡ vật phẩm" });
  } finally {
    client.release();
  }
});
