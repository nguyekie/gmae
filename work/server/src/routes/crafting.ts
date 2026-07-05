import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter } from "./character.js";
import { buildWeaponInstanceStats } from "../utils/itemRarity.js";

export const craftingRouter = Router();
craftingRouter.use(requireAuth);

const recipes = [
  {
    id: "eclipse_blade",
    name: "Rèn Kiếm Nhật Thực",
    description: "Vũ khí huyền thoại ổn định cho chương 9, không cần đánh boss thế giới.",
    resultItemTypeId: "eclipse_blade",
    goldCost: 4200,
    requirements: [
      { itemTypeId: "ash_iron", name: "Sắt Tro Tàn", quantity: 6 },
      { itemTypeId: "rift_core", name: "Tinh Hoa Rạn Nứt", quantity: 2 },
      { itemTypeId: "oath_sigil", name: "Ấn Lời Thề", quantity: 1 },
    ],
  },
  {
    id: "sentinel_plate",
    name: "Rèn Giáp Vệ Ước",
    description: "Giáp huyền thoại thiên về chống chịu cho tuyến map sau Đồng Bằng Tro Tàn.",
    resultItemTypeId: "sentinel_plate",
    goldCost: 3800,
    requirements: [
      { itemTypeId: "ash_iron", name: "Sắt Tro Tàn", quantity: 8 },
      { itemTypeId: "tempered_rift_core", name: "Lõi Rạn Tôi Luyện", quantity: 1 },
    ],
  },
  {
    id: "companion_charm",
    name: "Rèn Bùa Đồng Hành",
    description: "Vật phẩm dùng để chiêu mộ trợ thủ đầu tiên.",
    resultItemTypeId: "companion_charm",
    goldCost: 2500,
    requirements: [
      { itemTypeId: "ash_iron", name: "Sắt Tro Tàn", quantity: 4 },
      { itemTypeId: "oath_sigil", name: "Ấn Lời Thề", quantity: 1 },
    ],
  },
];

const craftSchema = z.object({
  characterId: z.string().uuid(),
  recipeId: z.string(),
});

async function consumeItems(client: any, characterId: string, itemTypeId: string, quantity: number) {
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

craftingRouter.get("/recipes", async (req: AuthedRequest, res) => {
  const characterId = String(req.query.characterId ?? "");
  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const inv = await pool.query(
    `SELECT item_type_id, SUM(quantity)::int AS quantity
     FROM item_instances
     WHERE owner_character_id = $1 AND location = 'inventory' AND quantity > 0
     GROUP BY item_type_id`,
    [characterId]
  );
  const inventory = Object.fromEntries(inv.rows.map((row) => [row.item_type_id, row.quantity]));
  res.json({ recipes, inventory, gold: Number(character.gold) });
});

craftingRouter.post("/craft", async (req: AuthedRequest, res) => {
  const parsed = craftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });

  const { characterId, recipeId } = parsed.data;
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return res.status(404).json({ error: "Không tìm thấy công thức rèn" });

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT gold FROM characters WHERE id = $1 FOR UPDATE", [characterId]);
    if (Number(locked.rows[0].gold) < recipe.goldCost) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Không đủ vàng để rèn" });
    }

    for (const reqItem of recipe.requirements) {
      const ok = await consumeItems(client, characterId, reqItem.itemTypeId, reqItem.quantity);
      if (!ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Thiếu ${reqItem.name}` });
      }
    }

    await client.query("UPDATE characters SET gold = gold - $1 WHERE id = $2", [recipe.goldCost, characterId]);
    const itemType = await client.query("SELECT rarity FROM item_types WHERE id = $1", [recipe.resultItemTypeId]);
    const instanceStats = buildWeaponInstanceStats(itemType.rows[0]?.rarity, "Rèn tại Lò Rèn Lời Thề");
    await client.query(
      `INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity, instance_stats)
       VALUES ($1, $2, 'inventory', 1, $3)`,
      [recipe.resultItemTypeId, characterId, JSON.stringify(instanceStats ?? {})]
    );

    await client.query("COMMIT");
    res.json({ success: true, itemTypeId: recipe.resultItemTypeId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Không thể rèn vật phẩm" });
  } finally {
    client.release();
  }
});
