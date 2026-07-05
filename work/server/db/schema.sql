-- Tàn Tích Etheria — Database Schema (PostgreSQL)
-- Chạy file này để khởi tạo toàn bộ bảng cần thiết.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(32) UNIQUE NOT NULL,
  class VARCHAR(16) NOT NULL CHECK (class IN ('warrior', 'mage', 'archer')),
  level INT NOT NULL DEFAULT 1,
  exp INT NOT NULL DEFAULT 0,
  hp INT NOT NULL,
  max_hp INT NOT NULL,
  mp INT NOT NULL,
  max_mp INT NOT NULL,
  base_atk INT NOT NULL,
  base_def INT NOT NULL,
  base_spd INT NOT NULL,
  gold BIGINT NOT NULL DEFAULT 100,
  faction VARCHAR(16) DEFAULT NULL,
  current_quest_step INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Định nghĩa "loại" vật phẩm (khuôn mẫu, không phải instance thật)
CREATE TABLE IF NOT EXISTS item_types (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  rarity VARCHAR(16) NOT NULL CHECK (rarity IN ('common','rare','epic','legendary')),
  slot VARCHAR(16) NOT NULL CHECK (slot IN ('weapon','armor','helmet','gloves','boots','trinket','shard','consumable','material')),
  base_stats JSONB NOT NULL DEFAULT '{}',
  level_requirement INT NOT NULL DEFAULT 1,
  tradable BOOLEAN NOT NULL DEFAULT true,
  stackable BOOLEAN NOT NULL DEFAULT false,
  description TEXT
);

-- Vật phẩm thật (instance) mà người chơi sở hữu
CREATE TABLE IF NOT EXISTS item_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type_id VARCHAR(64) NOT NULL REFERENCES item_types(id),
  owner_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  location VARCHAR(16) NOT NULL DEFAULT 'inventory' CHECK (location IN ('inventory','equipped','marketplace')),
  quantity INT NOT NULL DEFAULT 1,
  instance_stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_slots (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_type VARCHAR(16) NOT NULL,
  item_instance_id UUID REFERENCES item_instances(id) ON DELETE SET NULL,
  PRIMARY KEY (character_id, slot_type)
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_instance_id UUID NOT NULL REFERENCES item_instances(id) ON DELETE CASCADE,
  seller_character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  price BIGINT NOT NULL CHECK (price > 0),
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(24) NOT NULL, -- 'marketplace_sale' | 'trade' | 'quest_reward' | 'combat_drop' | 'combat_gold'
  from_character_id UUID REFERENCES characters(id),
  to_character_id UUID REFERENCES characters(id),
  item_instance_id UUID REFERENCES item_instances(id),
  gold_amount BIGINT DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monsters (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  zone VARCHAR(64) NOT NULL,
  level INT NOT NULL,
  hp INT NOT NULL,
  atk INT NOT NULL,
  def INT NOT NULL,
  exp_reward INT NOT NULL,
  gold_min INT NOT NULL,
  gold_max INT NOT NULL,
  drop_table JSONB NOT NULL DEFAULT '[]', -- [{ "item_type_id": "...", "chance": 0.2 }]
  is_boss BOOLEAN NOT NULL DEFAULT false,
  respawn_seconds INT NOT NULL DEFAULT 300
);

ALTER TABLE IF EXISTS monsters ADD COLUMN IF NOT EXISTS is_boss BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS monsters ADD COLUMN IF NOT EXISTS respawn_seconds INT NOT NULL DEFAULT 300;

-- Trạng thái máu bền của boss: máu KHÔNG hồi/reset giữa các lượt đánh của bất kỳ người chơi nào —
-- nhiều người có thể cùng "cày" 1 boss cho đến khi hạ gục hẳn, giống cơ chế boss thế giới trong
-- các game như Ngọc Rồng Online. Sau khi hạ gục, boss hồi sinh lại full máu sau `respawn_seconds`.
CREATE TABLE IF NOT EXISTS boss_state (
  monster_id VARCHAR(64) PRIMARY KEY REFERENCES monsters(id) ON DELETE CASCADE,
  current_hp INT NOT NULL,
  max_hp INT NOT NULL,
  last_hit_by_character_id UUID REFERENCES characters(id),
  defeated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Giới hạn số lượt 1 nhân vật được phép tấn công 1 boss trong 1 ngày (mặc định 3 lượt/ngày,
-- xem BOSS_DAILY_ATTEMPT_LIMIT trong combat.ts). Đếm theo ngày dương lịch của server.
CREATE TABLE IF NOT EXISTS boss_daily_attempts (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  monster_id VARCHAR(64) NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  attempt_date DATE NOT NULL,
  attempts_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, monster_id, attempt_date)
);

-- ===================== Hệ thống nhiệm vụ (Quest) =====================
-- Định nghĩa nhiệm vụ (khuôn mẫu — dữ liệu tĩnh do server seed, không đổi theo nhân vật)
CREATE TABLE IF NOT EXISTS quests (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  zone VARCHAR(64) NOT NULL,
  giver_npc_id VARCHAR(64) NOT NULL,
  level_requirement INT NOT NULL DEFAULT 1,
  prerequisite_quest_id VARCHAR(64) REFERENCES quests(id),
  dialogue_offer TEXT NOT NULL,       -- NPC nói khi chưa nhận nhiệm vụ
  dialogue_progress TEXT NOT NULL,    -- NPC nói khi đang làm nhiệm vụ (chưa xong)
  dialogue_complete TEXT NOT NULL,    -- NPC nói sau khi trả nhiệm vụ xong
  objectives JSONB NOT NULL DEFAULT '[]',   -- [{ "type": "kill", "targetId": "forest_slime", "count": 3, "label": "Nhớt Rừng" }]
  reward_exp INT NOT NULL DEFAULT 0,
  reward_gold INT NOT NULL DEFAULT 0,
  reward_items JSONB NOT NULL DEFAULT '[]'  -- ["potion_minor_heal", ...] — mỗi id nhận 1 instance
);

-- Tiến độ nhiệm vụ của từng nhân vật — đây là nguồn sự thật (source of truth) duy nhất,
-- toàn bộ tính toán "nhận / tiến độ / trả / thưởng" đều xác thực ở server dựa trên bảng này.
CREATE TABLE IF NOT EXISTS character_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_id VARCHAR(64) NOT NULL REFERENCES quests(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ready_to_turn_in', 'completed')),
  progress JSONB NOT NULL DEFAULT '{}',  -- { "forest_slime": 2 } — đếm theo targetId của từng objective
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (character_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_item_instances_owner ON item_instances(owner_character_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_transactions_characters ON transactions(from_character_id, to_character_id);
CREATE INDEX IF NOT EXISTS idx_character_quests_character ON character_quests(character_id);

-- ===================== Friends & Chat =====================
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_user_id, addressee_user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure messages.to_user_id can be nullable (for global channel) and add channel column
ALTER TABLE IF EXISTS messages ALTER COLUMN to_user_id DROP NOT NULL;
ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'private';

-- ===================== Shop / Vendor =====================
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  item_type_id VARCHAR(64) NOT NULL REFERENCES item_types(id),
  price BIGINT NOT NULL CHECK (price >= 0),
  stock INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_items_unique ON shop_items(shop_id, item_type_id);

