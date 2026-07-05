import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter } from "./character.js";

export const companionsRouter = Router();
companionsRouter.use(requireAuth);

const bodySchema = z.object({
  characterId: z.string().uuid(),
  companionTypeId: z.string(),
});

async function consumeRequirement(client: any, characterId: string, itemTypeId: string, quantity: number) {
  const rows = await client.query(
    `SELECT id, quantity
     FROM item_instances
     WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' AND quantity > 0
     ORDER BY created_at ASC
     FOR UPDATE`,
    [characterId, itemTypeId]
  );
  const owned = rows.rows.reduce((sum: number, row: any) => sum + (row.quantity ?? 1), 0);
  if (owned < quantity) return false;

  let remaining = quantity;
  for (const row of rows.rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantity ?? 1, remaining);
    remaining -= take;
    if ((row.quantity ?? 1) > take) {
      await client.query("UPDATE item_instances SET quantity = quantity - $1 WHERE id = $2", [take, row.id]);
    } else {
      await client.query("UPDATE item_instances SET owner_character_id = NULL, quantity = 0 WHERE id = $1", [row.id]);
    }
  }
  return true;
}

companionsRouter.get("/:characterId", async (req: AuthedRequest, res) => {
  const character = await assertOwnCharacter(req.userId!, req.params.characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const result = await pool.query(
    `SELECT ct.*, cc.id AS owned_id, cc.level, COALESCE(cc.active, false) AS active
     FROM companion_types ct
     LEFT JOIN character_companions cc
       ON cc.companion_type_id = ct.id AND cc.character_id = $1
     ORDER BY ct.recruit_cost_gold ASC, ct.id ASC`,
    [character.id]
  );

  res.json({ companions: result.rows });
});

companionsRouter.post("/recruit", async (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, companionTypeId } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const companionRes = await client.query("SELECT * FROM companion_types WHERE id = $1", [companionTypeId]);
    const companion = companionRes.rows[0];
    if (!companion) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Không tìm thấy trợ thủ" });
    }

    const owned = await client.query(
      "SELECT id FROM character_companions WHERE character_id = $1 AND companion_type_id = $2",
      [characterId, companionTypeId]
    );
    if (owned.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Bạn đã có trợ thủ này" });
    }

    const locked = await client.query("SELECT gold FROM characters WHERE id = $1 FOR UPDATE", [characterId]);
    if (Number(locked.rows[0].gold) < companion.recruit_cost_gold) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Không đủ vàng để chiêu mộ" });
    }

    const requirements = Array.isArray(companion.required_items) ? companion.required_items : [];
    for (const reqItem of requirements) {
      const ok = await consumeRequirement(client, characterId, reqItem.itemTypeId, reqItem.quantity);
      if (!ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Thiếu ${reqItem.name ?? reqItem.itemTypeId}` });
      }
    }

    await client.query("UPDATE characters SET gold = gold - $1 WHERE id = $2", [companion.recruit_cost_gold, characterId]);
    await client.query("UPDATE character_companions SET active = false WHERE character_id = $1", [characterId]);
    await client.query(
      `INSERT INTO character_companions (character_id, companion_type_id, active)
       VALUES ($1, $2, true)`,
      [characterId, companionTypeId]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể chiêu mộ trợ thủ" });
  } finally {
    client.release();
  }
});

companionsRouter.post("/activate", async (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  const { characterId, companionTypeId } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(
      "SELECT id FROM character_companions WHERE character_id = $1 AND companion_type_id = $2 FOR UPDATE",
      [characterId, companionTypeId]
    );
    if (!owned.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bạn chưa có trợ thủ này" });
    }
    await client.query("UPDATE character_companions SET active = false WHERE character_id = $1", [characterId]);
    await client.query(
      "UPDATE character_companions SET active = true WHERE character_id = $1 AND companion_type_id = $2",
      [characterId, companionTypeId]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể chọn trợ thủ" });
  } finally {
    client.release();
  }
});
