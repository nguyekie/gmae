-- Migration sửa lỗi: seed.ts cũ tạo 1 shop MỚI trùng tên mỗi lần chạy `npm run seed`
-- (do "shops" chưa có ràng buộc UNIQUE trên "name" nên "ON CONFLICT DO NOTHING" không có tác dụng).
-- Hệ quả: nhiều dòng "Cửa Hàng Thương Nhân" trùng lặp, mỗi dòng có shop_items riêng,
-- khiến Cửa hàng hiện lặp lại nhiều lần / mua nhầm shop_item cũ đã hết hàng.
--
-- Chạy file này 1 LẦN DUY NHẤT sau khi đã cập nhật code mới (dùng SQL Editor của Neon,
-- hoặc `psql "$DATABASE_URL" -f server/db/002_fix_shops.sql`).

DO $$
DECLARE
  keep_id UUID;
BEGIN
  -- Giữ lại shop CŨ NHẤT có tên "Cửa Hàng Thương Nhân"
  SELECT id INTO keep_id FROM shops WHERE name = 'Cửa Hàng Thương Nhân' ORDER BY id LIMIT 1;

  IF keep_id IS NOT NULL THEN
    -- Chuyển toàn bộ shop_items của các shop trùng tên sang shop được giữ lại,
    -- bỏ qua item nào đã tồn tại sẵn ở shop được giữ (tránh vi phạm unique shop_id+item_type_id)
    UPDATE shop_items si
    SET shop_id = keep_id
    WHERE si.shop_id IN (SELECT id FROM shops WHERE name = 'Cửa Hàng Thương Nhân' AND id <> keep_id)
      AND NOT EXISTS (
        SELECT 1 FROM shop_items si2 WHERE si2.shop_id = keep_id AND si2.item_type_id = si.item_type_id
      );

    -- Xóa các shop_items trùng còn sót lại (vì item đó đã có ở shop giữ lại)
    DELETE FROM shop_items
    WHERE shop_id IN (SELECT id FROM shops WHERE name = 'Cửa Hàng Thương Nhân' AND id <> keep_id);

    -- Xóa các shop trùng lặp
    DELETE FROM shops WHERE name = 'Cửa Hàng Thương Nhân' AND id <> keep_id;
  END IF;
END $$;

-- Đảm bảo không thể tạo trùng tên shop nữa (nếu chưa có ràng buộc này)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_name_unique'
  ) THEN
    ALTER TABLE shops ADD CONSTRAINT shops_name_unique UNIQUE (name);
  END IF;
END $$;
