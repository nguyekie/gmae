import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { assertOwnCharacter } from "./character.js";
import type { Server as SocketServer } from "socket.io";

const MARKET_FEE_RATE = 0.05; // phí chợ 5% — chống lạm phát, xem docs/game-design-doc.md mục 8

export function buildMarketplaceRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  // Danh sách vật phẩm đang rao bán
  router.get("/", async (_req, res) => {
    const result = await pool.query(
      `SELECT ml.id, ml.price, ml.created_at, ii.id as item_instance_id, ii.instance_stats,
              it.name, it.rarity, it.slot, it.base_stats,
              c.name as seller_name
       FROM marketplace_listings ml
       JOIN item_instances ii ON ii.id = ml.item_instance_id
       JOIN item_types it ON it.id = ii.item_type_id
       JOIN characters c ON c.id = ml.seller_character_id
       WHERE ml.status = 'active'
       ORDER BY ml.created_at DESC`
    );
    res.json({ listings: result.rows });
  });

  const listSchema = z.object({
    characterId: z.string().uuid(),
    itemInstanceId: z.string().uuid(),
    price: z.number().int().positive().max(999_999_999),
  });

  // Đăng bán 1 vật phẩm từ túi đồ
  router.post("/list", async (req: AuthedRequest, res) => {
    const parsed = listSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, itemInstanceId, price } = parsed.data;

    const character = await assertOwnCharacter(req.userId!, characterId);
    if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const itemResult = await client.query(
        `SELECT ii.*, it.tradable, it.name FROM item_instances ii
         JOIN item_types it ON it.id = ii.item_type_id
         WHERE ii.id = $1 AND ii.owner_character_id = $2 AND ii.location = 'inventory' FOR UPDATE`,
        [itemInstanceId, characterId]
      );
      const item = itemResult.rows[0];
      if (!item) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Vật phẩm không có trong túi đồ" });
      }
      if (!item.tradable) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `"${item.name}" không thể giao dịch` });
      }

      await client.query("UPDATE item_instances SET location = 'marketplace' WHERE id = $1", [itemInstanceId]);
      const listing = await client.query(
        "INSERT INTO marketplace_listings (item_instance_id, seller_character_id, price) VALUES ($1,$2,$3) RETURNING id",
        [itemInstanceId, characterId, price]
      );

      await client.query("COMMIT");
      res.status(201).json({ listingId: listing.rows[0].id });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Không thể đăng bán vật phẩm" });
    } finally {
      client.release();
    }
  });

  const buySchema = z.object({
    characterId: z.string().uuid(),
    listingId: z.string().uuid(),
  });

  // Mua 1 listing đang active — toàn bộ nằm trong 1 transaction để chống dupe / mất đồng bộ
  router.post("/buy", async (req: AuthedRequest, res) => {
    const parsed = buySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, listingId } = parsed.data;

    const buyer = await assertOwnCharacter(req.userId!, characterId);
    if (!buyer) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Khóa dòng listing để 2 người không thể mua cùng 1 item cùng lúc
      const listingResult = await client.query(
        "SELECT * FROM marketplace_listings WHERE id = $1 AND status = 'active' FOR UPDATE",
        [listingId]
      );
      const listing = listingResult.rows[0];
      if (!listing) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Vật phẩm này đã được bán hoặc không còn tồn tại" });
      }
      if (listing.seller_character_id === characterId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Không thể mua vật phẩm của chính mình" });
      }

      const buyerRow = await client.query("SELECT gold FROM characters WHERE id = $1 FOR UPDATE", [characterId]);
      if (Number(buyerRow.rows[0].gold) < Number(listing.price)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Không đủ vàng" });
      }

      const fee = Math.floor(Number(listing.price) * MARKET_FEE_RATE);
      const sellerReceives = Number(listing.price) - fee;

      await client.query("UPDATE characters SET gold = gold - $1 WHERE id = $2", [listing.price, characterId]);
      await client.query("UPDATE characters SET gold = gold + $1 WHERE id = $2", [
        sellerReceives,
        listing.seller_character_id,
      ]);
      await client.query(
        "UPDATE item_instances SET location = 'inventory', owner_character_id = $1 WHERE id = $2",
        [characterId, listing.item_instance_id]
      );
      await client.query(
        "UPDATE marketplace_listings SET status = 'sold', sold_at = now() WHERE id = $1",
        [listingId]
      );
      await client.query(
        `INSERT INTO transactions (type, from_character_id, to_character_id, item_instance_id, gold_amount)
         VALUES ('marketplace_sale', $1, $2, $3, $4)`,
        [characterId, listing.seller_character_id, listing.item_instance_id, listing.price]
      );

      await client.query("COMMIT");

      io.to(`character:${listing.seller_character_id}`).emit("marketplace:item_sold", {
        listingId,
        price: listing.price,
        goldReceived: sellerReceives,
      });

      res.json({ success: true, goldPaid: listing.price });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Giao dịch thất bại, vui lòng thử lại" });
    } finally {
      client.release();
    }
  });

  const cancelSchema = z.object({ characterId: z.string().uuid(), listingId: z.string().uuid() });

  // Hủy đăng bán — trả item về túi đồ
  router.post("/cancel", async (req: AuthedRequest, res) => {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, listingId } = parsed.data;

    const character = await assertOwnCharacter(req.userId!, characterId);
    if (!character) return res.status(404).json({ error: "Không tìm thấy nhân vật" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const listing = await client.query(
        "SELECT * FROM marketplace_listings WHERE id = $1 AND seller_character_id = $2 AND status = 'active' FOR UPDATE",
        [listingId, characterId]
      );
      if (!listing.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Không tìm thấy tin đăng" });
      }
      await client.query("UPDATE item_instances SET location = 'inventory' WHERE id = $1", [
        listing.rows[0].item_instance_id,
      ]);
      await client.query("UPDATE marketplace_listings SET status = 'cancelled' WHERE id = $1", [listingId]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Không thể hủy tin đăng" });
    } finally {
      client.release();
    }
  });

  return router;
}
