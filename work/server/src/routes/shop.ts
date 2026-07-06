import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { assertOwnCharacter } from './character.js';
import { z } from 'zod';
import { buildWeaponInstanceStats } from '../utils/itemRarity.js';

export const shopRouter = Router();
shopRouter.use(requireAuth);

// Danh sách shop + items
shopRouter.get('/', async (_req: AuthedRequest, res) => {
  try {
    const shops = await pool.query('SELECT id, name, description FROM shops');
    const items = await pool.query(
      `SELECT si.id, si.shop_id, si.item_type_id, si.price, si.stock, it.name, it.rarity, it.slot, it.base_stats, it.level_requirement
       FROM shop_items si JOIN item_types it ON it.id = si.item_type_id`
    );
    res.json({ shops: shops.rows, items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể lấy shop' });
  }
});

const buySchema = z.object({ characterId: z.string().uuid(), shopItemId: z.string().uuid(), quantity: z.number().int().min(1).default(1) });

shopRouter.post('/buy', async (req: AuthedRequest, res) => {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const { characterId, shopItemId, quantity } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: 'Không tìm thấy nhân vật' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const charRes = await client.query('SELECT gold FROM characters WHERE id = $1 FOR UPDATE', [characterId]);
    const char = charRes.rows[0];
    if (!char) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy nhân vật' });
    }

    const siRes = await client.query('SELECT * FROM shop_items WHERE id = $1 FOR UPDATE', [shopItemId]);
    const si = siRes.rows[0];
    if (!si || si.stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Hàng không đủ' });
    }

    const total = BigInt(si.price) * BigInt(quantity);
    if (BigInt(char.gold) < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Không đủ vàng' });
    }

    // Trừ vàng, giảm stock, tạo item_instances cho character
    await client.query('UPDATE characters SET gold = gold - $1 WHERE id = $2', [Number(total), characterId]);
    await client.query('UPDATE shop_items SET stock = stock - $1 WHERE id = $2', [quantity, shopItemId]);

    // If item type is stackable, merge into existing instance if present
    const itRes = await client.query('SELECT stackable FROM item_types WHERE id = $1', [si.item_type_id]);
    const stackable = itRes.rows[0]?.stackable;
    if (stackable) {
      // Try to find existing stack for this character
      const existRes = await client.query(
        "SELECT id, quantity FROM item_instances WHERE owner_character_id = $1 AND item_type_id = $2 AND location = 'inventory' FOR UPDATE",
        [characterId, si.item_type_id]
      );
      if (existRes.rows[0]) {
        await client.query('UPDATE item_instances SET quantity = quantity + $1 WHERE id = $2', [quantity, existRes.rows[0].id]);
      } else {
        await client.query("INSERT INTO item_instances (item_type_id, owner_character_id, location, quantity) VALUES ($1,$2,'inventory',$3)", [
          si.item_type_id,
          characterId,
          quantity,
        ]);
      }
    } else {
      // Non-stackable: create instances; include instance_stats.special for weapons of rarity Rare+
      const itFullRes = await client.query('SELECT rarity, slot FROM item_types WHERE id = $1', [si.item_type_id]);
      const itFull = itFullRes.rows[0];
      for (let i = 0; i < quantity; i++) {
        let instanceStats: any = null;
        if (itFull && itFull.slot === 'weapon') {
          const generated = buildWeaponInstanceStats(itFull.rarity, 'purchased_from_shop');
          if (generated) instanceStats = JSON.stringify(generated);
        }
        if (instanceStats) {
          await client.query(
            "INSERT INTO item_instances (item_type_id, owner_character_id, location, instance_stats) VALUES ($1,$2,'inventory',$3)",
            [si.item_type_id, characterId, instanceStats]
          );
        } else {
          await client.query(
            "INSERT INTO item_instances (item_type_id, owner_character_id, location) VALUES ($1,$2,'inventory')",
            [si.item_type_id, characterId]
          );
        }
      }
    }

    await client.query(
      "INSERT INTO transactions (type, to_character_id, gold_amount) VALUES ('shop_purchase',$1,$2)",
      [characterId, Number(total)]
    );

    await client.query('COMMIT');
    res.json({ bought: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Mua hàng thất bại' });
  } finally {
    client.release();
  }
});

const sellSchema = z.object({
  characterId: z.string().uuid(),
  itemInstanceId: z.string().uuid(),
  shopId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).optional(),
});

// Bán vật phẩm cho NPC shop (sell-to-shop)
shopRouter.post('/sell', async (req: AuthedRequest, res) => {
  const parsed = sellSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const { characterId, itemInstanceId, shopId, quantity } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: 'Không tìm thấy nhân vật' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query(
      `SELECT ii.id, ii.quantity, ii.location, it.id as item_type_id, it.name, it.tradable
       FROM item_instances ii JOIN item_types it ON it.id = ii.item_type_id
       WHERE ii.id = $1 AND ii.owner_character_id = $2 AND ii.location IN ('inventory','equipped') FOR UPDATE`,
      [itemInstanceId, characterId]
    );
    const item = itemRes.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vật phẩm không tồn tại trong túi đồ' });
    }
    // Vật phẩm gắn với cốt truyện (vd phần thưởng nhiệm vụ huyền thoại) không được phép thanh lý,
    // giống hệt giới hạn đã áp dụng cho việc đăng bán chợ giao dịch.
    if (!item.tradable) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `"${item.name}" không thể bán hoặc giao dịch` });
    }

    const sellQty = Math.min(quantity ?? item.quantity ?? 1, item.quantity ?? 1);

    // Lấy shop (nếu không truyền shopId, lấy shop đầu tiên)
    let shop;
    if (shopId) {
      const s = await client.query('SELECT id FROM shops WHERE id = $1 FOR UPDATE', [shopId]);
      shop = s.rows[0];
    } else {
      const s = await client.query('SELECT id FROM shops LIMIT 1 FOR UPDATE');
      shop = s.rows[0];
    }
    if (!shop) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy shop' });
    }

    // Tìm shop_item tương ứng
    const siRes = await client.query('SELECT * FROM shop_items WHERE shop_id = $1 AND item_type_id = $2 FOR UPDATE', [shop.id, item.item_type_id]);
    const si = siRes.rows[0];

    let unitBuyback = 5; // mặc định
    if (si) {
      unitBuyback = Math.floor(Number(si.price) * 0.5);
    } else {
      const itRes = await client.query('SELECT rarity FROM item_types WHERE id = $1', [item.item_type_id]);
      const rarity = itRes.rows[0]?.rarity ?? 'common';
      if (rarity === 'rare') unitBuyback = 20;
      else if (rarity === 'epic') unitBuyback = 100;
      else if (rarity === 'legendary') unitBuyback = 400;
      else if (rarity === 'mythic') unitBuyback = 900;
      else if (rarity === 'sss_plus') unitBuyback = 1600;
      else unitBuyback = 8;
    }
    const buyback = unitBuyback * sellQty;

    // Cộng vàng cho nhân vật
    await client.query('UPDATE characters SET gold = gold + $1 WHERE id = $2', [buyback, characterId]);

    // NOTE: Do NOT add sold items back into NPC shop stock. When a player sells to a shop
    // the item is removed from circulation (disappears). This prevents immediate flip/exploit
    // and keeps shop stock controlled by seed data.

    // Nếu đang mặc (equipped), gỡ khỏi equipment_slots
    if (item.location === 'equipped') {
      await client.query('UPDATE equipment_slots SET item_instance_id = NULL WHERE item_instance_id = $1', [itemInstanceId]);
    }

    // LƯU Ý: KHÔNG được xoá hẳn (DELETE) dòng item_instances ở đây — nếu vật phẩm này từng được ghi
    // nhận trong bảng transactions (vd rơi ra từ quái 'combat_drop', hoặc phần thưởng 'quest_reward'),
    // dòng transactions đó vẫn tham chiếu item_instance_id này; xoá sẽ vi phạm khoá ngoại và khiến
    // việc bán thất bại ngay giữa chừng. Thay vào đó, giảm đúng số lượng đã bán và "thu hồi" hẳn
    // (bỏ chủ sở hữu) khi về 0 — vẫn giữ được lịch sử giao dịch nguyên vẹn.
    if ((item.quantity ?? 1) > sellQty) {
      await client.query('UPDATE item_instances SET quantity = quantity - $1 WHERE id = $2', [sellQty, itemInstanceId]);
    } else {
      // Remove ownership and mark as out-of-circulation (location 'marketplace' kept for compatibility
      // with schema but we will NOT create a shop_items entry; item effectively disappears)
      await client.query(
        "UPDATE item_instances SET owner_character_id = NULL, quantity = 0, location = 'marketplace' WHERE id = $1",
        [itemInstanceId]
      );
    }

    await client.query(
      "INSERT INTO transactions (type, from_character_id, gold_amount) VALUES ('shop_sell',$1,$2)",
      [characterId, buyback]
    );

    await client.query('COMMIT');
    res.json({ sold: true, goldReceived: buyback, quantitySold: sellQty });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Bán hàng thất bại' });
  } finally {
    client.release();
  }
});

// Đổi nguyên liệu thành vàng / điểm (ví dụ để hỗ trợ craft) — nguyên liệu sẽ bị tiêu hủy
shopRouter.post('/materials/exchange', async (req: AuthedRequest, res) => {
  const schema = z.object({ characterId: z.string().uuid(), itemInstanceId: z.string().uuid(), quantity: z.number().int().min(1).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const { characterId, itemInstanceId, quantity } = parsed.data;

  const character = await assertOwnCharacter(req.userId!, characterId);
  if (!character) return res.status(404).json({ error: 'Không tìm thấy nhân vật' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query(
      `SELECT ii.id, ii.quantity, it.id as item_type_id, it.name, it.slot, it.rarity
       FROM item_instances ii JOIN item_types it ON it.id = ii.item_type_id
       WHERE ii.id = $1 AND ii.owner_character_id = $2 AND ii.location = 'inventory' FOR UPDATE`,
      [itemInstanceId, characterId]
    );
    const item = itemRes.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vật phẩm không tồn tại trong túi đồ' });
    }
    if (item.slot !== 'material') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chỉ có thể đổi nguyên liệu tại đây' });
    }

    const qty = Math.min(quantity ?? item.quantity ?? 1, item.quantity ?? 1);

    // Giá trị chuyển đổi theo rarity
    let unit = 5;
    if (item.rarity === 'rare') unit = 20;
    else if (item.rarity === 'epic') unit = 80;
    else if (item.rarity === 'legendary') unit = 300;
    else if (item.rarity === 'mythic') unit = 700;

    const goldReceived = unit * qty;
    await client.query('UPDATE characters SET gold = gold + $1 WHERE id = $2', [goldReceived, characterId]);

    if ((item.quantity ?? 1) > qty) {
      await client.query('UPDATE item_instances SET quantity = quantity - $1 WHERE id = $2', [qty, itemInstanceId]);
    } else {
      await client.query("UPDATE item_instances SET owner_character_id = NULL, quantity = 0, location = 'marketplace' WHERE id = $1", [itemInstanceId]);
    }

    await client.query("INSERT INTO transactions (type, from_character_id, gold_amount) VALUES ('material_exchange',$1,$2)", [characterId, goldReceived]);

    await client.query('COMMIT');
    res.json({ exchanged: true, goldReceived, quantity: qty });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Không thể đổi nguyên liệu' });
  } finally {
    client.release();
  }
});
