import { pool } from "./db.js";

const itemTypes = [
  // --- Vũ khí khởi đầu theo class ---
  { id: "sword_rusty", name: "Kiếm Gỉ Sét", rarity: "common", slot: "weapon", base_stats: { atk: 6 }, level_requirement: 1, description: "Vũ khí khởi đầu của Chiến Binh." },
  { id: "staff_apprentice", name: "Trượng Học Việc", rarity: "common", slot: "weapon", base_stats: { atk: 5 }, level_requirement: 1, description: "Vũ khí khởi đầu của Pháp Sư." },
  { id: "bow_hunter", name: "Cung Thợ Săn", rarity: "common", slot: "weapon", base_stats: { atk: 6 }, level_requirement: 1, description: "Vũ khí khởi đầu của Xạ Thủ." },

  // --- Trang bị rơi từ quái vùng Rừng Thì Thầm ---
  { id: "leather_vest", name: "Áo Da Mòn", rarity: "common", slot: "armor", base_stats: { def: 4 }, level_requirement: 1 },
  { id: "wolf_fang_dagger", name: "Dao Găm Nanh Sói", rarity: "rare", slot: "weapon", base_stats: { atk: 10, spd: 2 }, level_requirement: 3 },
  { id: "slime_ring", name: "Nhẫn Chất Nhờn", rarity: "rare", slot: "trinket", base_stats: { def: 3, mp: 10 }, level_requirement: 3 },
  { id: "ranger_boots", name: "Giày Lữ Hành", rarity: "common", slot: "boots", base_stats: { spd: 3 }, level_requirement: 2 },

  // --- Trang bị rơi từ Hầm Mộ Đá Vỡ ---
  { id: "tomb_plate", name: "Giáp Phiến Mộ Đá", rarity: "epic", slot: "armor", base_stats: { def: 14, hp: 20 }, level_requirement: 8 },
  { id: "flame_shard_blade", name: "Kiếm Mảnh Lửa", rarity: "epic", slot: "weapon", base_stats: { atk: 24, fire_dmg: 8 }, level_requirement: 10 },
  { id: "void_pendant", name: "Bùa Hư Không", rarity: "epic", slot: "trinket", base_stats: { atk: 6, def: 6, mp: 15 }, level_requirement: 9 },

  // --- Mảnh Nguyên Tố (đặc trưng lore, slot "shard") ---
  { id: "fire_shard_fragment", name: "Mảnh Vỡ Lõi Lửa", rarity: "legendary", slot: "shard", base_stats: { atk: 15, fire_dmg: 20 }, level_requirement: 12, description: "Một mảnh nhỏ của Lõi Nguyên Tố Lửa, còn ấm như vừa rời khỏi lò rèn của thần linh." },
  { id: "water_shard_fragment", name: "Mảnh Vỡ Lõi Nước", rarity: "legendary", slot: "shard", base_stats: { def: 12, mp: 25 }, level_requirement: 12, description: "Mảnh vỡ trong suốt, bên trong như có dòng nước chảy mãi không ngừng." },

  // --- Trang bị đặc biệt rơi từ boss ---
  { id: "colossus_plate", name: "Áo Giáp Khổng Lồ", rarity: "legendary", slot: "armor", base_stats: { def: 40, hp: 100 }, level_requirement: 15, description: "Áo giáp khắc hoa văn cổ, rực sáng sức mạnh của kẻ đã khuất.", stackable: false },
  { id: "abyssal_fang_blade", name: "Nanh Kiếm Vực Thẳm", rarity: "legendary", slot: "weapon", base_stats: { atk: 38, spd: 4 }, level_requirement: 15, description: "Vũ khí rèn từ nanh của Hùng Giả Khổng Lồ, rung động cùng tần số với Hư Không." },
  
  // --- New guaranteed/legendary boss-killer reward + other high-tier weapons ---
  { id: "titan_sunderer", name: "Sát Kiếm Titan", rarity: "legendary", slot: "weapon", base_stats: { atk: 46, spd: 2 }, level_requirement: 15, description: "Lưỡi kiếm nghiền nát titan — phần thưởng cho kẻ hạ gục Hùng Giả Khổng Lồ.", stackable: false },
  { id: "void_reaver", name: "Xẻng Hủy Vực", rarity: "legendary", slot: "weapon", base_stats: { atk: 44, def: 6 }, level_requirement: 15, description: "Vũ khí rèn từ bản chất Hư Không, gây thêm sát thương phép.", stackable: false },
  { id: "ether_spear", name: "Giáo Aether", rarity: "epic", slot: "weapon", base_stats: { atk: 32, mp: 12 }, level_requirement: 13, description: "Giáo chứa tinh hoa Aether, phù hợp cho lớp sử dụng giáo.", stackable: false },

  // --- Trang bị tầm trung (lấp khoảng trống giữa đồ khởi đầu và đồ boss) ---
  { id: "iron_greatsword", name: "Đại Kiếm Sắt", rarity: "rare", slot: "weapon", base_stats: { atk: 16 }, level_requirement: 5, description: "Vũ khí tiêu chuẩn của lính canh Etheria trước Đại Vỡ Vụn." },
  { id: "mystic_orb", name: "Cầu Pháp Bí Ẩn", rarity: "rare", slot: "weapon", base_stats: { atk: 13, mp: 10 }, level_requirement: 5 },
  { id: "swift_bow", name: "Cung Gió Lốc", rarity: "rare", slot: "weapon", base_stats: { atk: 14, spd: 3 }, level_requirement: 5 },
  { id: "titan_gauntlets", name: "Găng Tay Titan", rarity: "epic", slot: "gloves", base_stats: { atk: 5, def: 10 }, level_requirement: 13 },
  { id: "voidsteel_helm", name: "Mũ Thép Hư Không", rarity: "epic", slot: "helmet", base_stats: { def: 12, hp: 30 }, level_requirement: 13 },
  // --- New high-tier wearable gear (level 11+) dropped từ quái, cũng có thể mua tại shop với giá cao ---
  { id: "tempest_gauntlets", name: "Găng Tay Bão Tố", rarity: "epic", slot: "gloves", base_stats: { atk: 12, spd: 4, def: 6 }, level_requirement: 11, description: "Găng tay thuần thục năng lượng bão tố — tăng sát thương và tốc độ tấn công.", stackable: false },
  { id: "aether_crown", name: "Mũ Vương Aether", rarity: "epic", slot: "helmet", base_stats: { def: 10, hp: 50, mp: 20 }, level_requirement: 11, description: "Mũ đội phát sáng, khuếch đại liên kết với Ether — dành cho người đủ mạnh.", stackable: false },
  { id: "drakehide_gloves", name: "Găng Da Rồng", rarity: "epic", slot: "gloves", base_stats: { atk: 9, def: 9, fire_dmg: 6 }, level_requirement: 11, description: "Găng tay được khâu từ da Rồng, bền và tăng sát thương lửa.", stackable: false },
  { id: "shard_of_silence", name: "Mảnh Vỡ Tĩnh Lặng", rarity: "legendary", slot: "trinket", base_stats: { atk: 10, def: 10, mp: 20 }, level_requirement: 15, description: "Phần thưởng cho kẻ dám đối mặt sự thật về Đại Vỡ Vụn." },
  // --- New SSS+ boss trophy weapon (apex) and additional high-end items ---
  { id: "apex_oblivion", name: "Hủy Diệt Đỉnh Nguyên (SSS+)", rarity: "sss_plus", slot: "weapon", base_stats: { atk: 72, spd: 6, hp: 200 }, level_requirement: 20, description: "Vũ khí huyền thoại mang sức công phá của kẻ hủy diệt — có chỉ số đặc biệt và kỹ năng riêng.", stackable: false, special: { passive: { boss_drop_rate_bonus: 0.01 }, skill: { id: "void_cleave", name: "Xén Hư Không", description: "Đòn tấn công mạnh phá vỡ lá chắn kẻ thù, tăng sát thương lên quái boss trong 6s (thể hiện bằng hiệu ứng)." } } },
  { id: "rift_core", name: "Tinh Hoa Rạn Nứt", rarity: "epic", slot: "material", base_stats: {}, level_requirement: 14, stackable: true, description: "Mảnh lõi thu được từ các vật thể rạn nứt, dùng để rèn vũ khí." },
  { id: "abyssal_edge", name: "Bộ Lưỡi Vực Thẳm", rarity: "epic", slot: "weapon", base_stats: { atk: 36, spd: 3 }, level_requirement: 14, description: "Lưỡi kiếm được tinh luyện từ bụi Hư Không." },

  // --- Vật phẩm tiêu hao ---
  { id: "potion_minor_heal", name: "Bình Máu Nhỏ", rarity: "common", slot: "consumable", base_stats: { heal: 40 }, level_requirement: 1, stackable: true },
  { id: "potion_minor_mana", name: "Bình Mana Nhỏ", rarity: "common", slot: "consumable", base_stats: { mana: 30 }, level_requirement: 1, stackable: true },
  { id: "elixir_of_vigor", name: "Linh Dược Sinh Lực", rarity: "rare", slot: "consumable", base_stats: { heal: 100, mana: 50 }, level_requirement: 10, stackable: true, description: "Hồi phục mạnh cho các trận chiến khó, đặc biệt là boss." },

  // --- Nguyên liệu chế tạo ---
  { id: "wolf_pelt", name: "Da Sói Rừng", rarity: "common", slot: "material", base_stats: {}, level_requirement: 1, stackable: true },
  { id: "cracked_stone_core", name: "Lõi Đá Nứt", rarity: "rare", slot: "material", base_stats: {}, level_requirement: 1, stackable: true },
  { id: "abyssal_dust", name: "Bụi Hư Không", rarity: "rare", slot: "material", base_stats: {}, level_requirement: 1, stackable: true, description: "Tàn dư mịn như tro của những sinh vật thuộc về Hư Không." },
];

const monsters = [
  {
    id: "forest_slime",
    name: "Nhớt Rừng",
    zone: "whispering_forest",
    level: 2,
    hp: 40,
    atk: 6,
    def: 2,
    exp_reward: 25,
    gold_min: 3,
    gold_max: 10,
    drop_table: [{ item_type_id: "slime_ring", chance: 0.08 }, { item_type_id: "potion_minor_heal", chance: 0.3 }],
  },
  {
    id: "shadow_wolf",
    name: "Sói Bóng Tối",
    zone: "whispering_forest",
    level: 4,
    hp: 70,
    atk: 11,
    def: 5,
    exp_reward: 45,
    gold_min: 8,
    gold_max: 20,
    drop_table: [
      { item_type_id: "wolf_fang_dagger", chance: 0.12 },
      { item_type_id: "wolf_pelt", chance: 0.5 },
      { item_type_id: "leather_vest", chance: 0.15 },
    ],
  },
  {
    id: "tomb_guardian",
    name: "Vệ Thần Mộ Đá",
    zone: "shattered_tomb",
    level: 9,
    hp: 220,
    atk: 20,
    def: 14,
    exp_reward: 160,
    gold_min: 30,
    gold_max: 70,
    drop_table: [
      { item_type_id: "tomb_plate", chance: 0.1 },
      { item_type_id: "cracked_stone_core", chance: 0.4 },
      { item_type_id: "void_pendant", chance: 0.06 },
    ],
  },
  {
    id: "ember_wraith",
    name: "Hồn Ma Tro Tàn",
    zone: "shattered_tomb",
    level: 11,
    hp: 260,
    atk: 24,
    def: 10,
    exp_reward: 210,
    gold_min: 40,
    gold_max: 90,
    drop_table: [
      { item_type_id: "flame_shard_blade", chance: 0.05 },
      { item_type_id: "fire_shard_fragment", chance: 0.02 },
      { item_type_id: "tempest_gauntlets", chance: 0.03 }
    ],
  },
  // Quái thường trấn giữ Vực Thẳm Hư Không (trước cửa boss)
  {
    id: "void_stalker",
    name: "Kẻ Rình Rập Hư Không",
    zone: "void_abyss",
    level: 13,
    hp: 300,
    atk: 28,
    def: 14,
    exp_reward: 220,
    gold_min: 50,
    gold_max: 100,
    drop_table: [
      { item_type_id: "titan_gauntlets", chance: 0.06 },
      { item_type_id: "abyssal_dust", chance: 0.6 },
      { item_type_id: "drakehide_gloves", chance: 0.04 }
    ],
  },
  // New monsters near the rift fields
  {
    id: "abyssal_hunter",
    name: "Thợ Săn Vực Thẳm",
    zone: "rift_fields",
    level: 16,
    hp: 950,
    atk: 58,
    def: 24,
    exp_reward: 520,
    gold_min: 140,
    gold_max: 240,
    drop_table: [
      { item_type_id: "abyssal_edge", chance: 0.18 },
      { item_type_id: "rift_core", chance: 0.45 },
    ],
  },
  {
    id: "rift_construct",
    name: "Cỗ Máy Rạn Nứt",
    zone: "rift_fields",
    level: 18,
    hp: 1700,
    atk: 108,
    def: 38,
    exp_reward: 1050,
    gold_min: 320,
    gold_max: 620,
    drop_table: [
      { item_type_id: "apex_oblivion", chance: 0.03 },
      { item_type_id: "rift_core", chance: 0.6 },
      { item_type_id: "abyssal_edge", chance: 0.12 },
    ],
  },
  {
    id: "rogue_construct",
    name: "Cấu Trúc Nổi Loạn",
    zone: "ashfall_plains",
    level: 20,
    hp: 1150,
    atk: 72,
    def: 30,
    exp_reward: 680,
    gold_min: 180,
    gold_max: 300,
    drop_table: [
      { item_type_id: "rift_core", chance: 0.55 },
      { item_type_id: "abyssal_edge", chance: 0.12 },
    ],
  },
  {
    id: "ash_marauder",
    name: "Cướp Tro Tàn",
    zone: "ashfall_plains",
    level: 20,
    hp: 1050,
    atk: 78,
    def: 26,
    exp_reward: 700,
    gold_min: 190,
    gold_max: 320,
    drop_table: [
      { item_type_id: "elixir_of_vigor", chance: 0.22 },
      { item_type_id: "rift_core", chance: 0.45 },
    ],
  },
  {
    id: "fallen_paladin",
    name: "Thánh Kỵ Sĩ Sa Ngã",
    zone: "ashfall_plains",
    level: 22,
    hp: 26000,
    atk: 230,
    def: 32,
    exp_reward: 1800,
    gold_min: 600,
    gold_max: 1100,
    is_boss: true,
    respawn_seconds: 1200,
    drop_table: [
      { item_type_id: "apex_oblivion", chance: 0.05 },
      { item_type_id: "water_shard_fragment", chance: 0.18 },
      { item_type_id: "rift_core", chance: 1 },
    ],
  },
  {
    id: "abyss_wisp",
    name: "Đóm Lửa Vực Thẳm",
    zone: "void_abyss",
    level: 14,
    hp: 260,
    atk: 32,
    def: 10,
    exp_reward: 240,
    gold_min: 55,
    gold_max: 110,
    drop_table: [
      { item_type_id: "voidsteel_helm", chance: 0.06 },
      { item_type_id: "abyssal_dust", chance: 0.6 },
      { item_type_id: "aether_crown", chance: 0.03 }
    ],
  },
  // Boss thế giới: máu KHÔNG hồi/reset giữa các lượt đánh (xem boss_state trong schema.sql +
  // handleBossFight trong combat.ts) — nhiều người có thể cùng cày cho đến khi hạ gục hẳn.
  {
    id: "colossal_titan",
    name: "Hùng Giả Khổng Lồ",
    zone: "void_abyss",
    level: 15,
    hp: 20000,
    atk: 200,
    def: 18,
    exp_reward: 1200,
    gold_min: 300,
    gold_max: 600,
    is_boss: true,
    respawn_seconds: 900, // 15 phút sau khi bị hạ mới hồi sinh lại
    drop_table: [
      { item_type_id: "colossus_plate", chance: 0.15 },
      { item_type_id: "abyssal_fang_blade", chance: 0.1 },
      { item_type_id: "abyssal_dust", chance: 1 },
    ],
  },
];

const quests = [
  {
    id: "quest_call_of_the_shard",
    title: "Chương 1 — Tiếng Gọi Từ Mảnh Vỡ",
    zone: "whispering_forest",
    giver_npc_id: "npc_oris",
    level_requirement: 1,
    prerequisite_quest_id: null as string | null,
    dialogue_offer:
      "Con đã Thức Tỉnh rồi đấy... ta cảm nhận được mảnh vỡ trong con đang rung động. Rừng Thì Thầm không còn an toàn — hãy đánh bại 3 Nhớt Rừng để chứng minh bản thân, rồi quay lại gặp ta.",
    dialogue_progress: "Lũ Nhớt Rừng vẫn còn lởn vởn ngoài kia. Hãy tiếp tục, Người Thức Tỉnh.",
    dialogue_complete:
      "Con đã làm rất tốt. Mảnh vỡ trong con đang sáng dần lên... hãy tiếp tục hành trình, còn nhiều thử thách phía trước.",
    objectives: [{ type: "kill", targetId: "forest_slime", count: 3, label: "Nhớt Rừng" }],
    reward_exp: 60,
    reward_gold: 40,
    reward_items: ["potion_minor_heal"] as string[],
  },
  {
    id: "quest_shadow_in_the_deep_woods",
    title: "Chương 2 — Bóng Tối Trong Rừng Sâu",
    zone: "whispering_forest",
    giver_npc_id: "npc_lyra",
    level_requirement: 3,
    prerequisite_quest_id: "quest_call_of_the_shard" as string | null,
    dialogue_offer:
      "Lũ Sói Bóng Tối gần đây hung hãn khác thường. Có kẻ nào đó đang kích động chúng từ sâu trong rừng. Hãy đánh bại 2 Sói Bóng Tối và mang bằng chứng về cho ta.",
    dialogue_progress: "Sói Bóng Tối vẫn còn ngoài kia — cẩn thận, chúng nguy hiểm hơn Nhớt Rừng nhiều.",
    dialogue_complete: "Vậy là thật... có kẻ đang kích động chúng. Cảm ơn con, Người Thức Tỉnh. Ta sẽ báo lên Hội Bảo Tồn.",
    objectives: [{ type: "kill", targetId: "shadow_wolf", count: 2, label: "Sói Bóng Tối" }],
    reward_exp: 110,
    reward_gold: 85,
    reward_items: ["ranger_boots"] as string[],
  },
  {
    id: "quest_road_to_the_tomb",
    title: "Chương 3 — Con Đường Đến Hầm Mộ",
    zone: "starting_village",
    giver_npc_id: "npc_ren",
    level_requirement: 8,
    prerequisite_quest_id: "quest_shadow_in_the_deep_woods" as string | null,
    dialogue_offer:
      "Ta đã giải mã được một phần bản đồ cổ. Hầm Mộ Đá Vỡ không phải nơi chôn cất — đó là nơi một Lõi Nguyên Tố vỡ ra đầu tiên. Con đã đủ mạnh để tự mình chứng kiến rồi đấy.",
    dialogue_progress: "Con đã sẵn sàng. Hãy tìm đường đến Hầm Mộ Đá Vỡ qua Rừng Thì Thầm.",
    dialogue_complete: "Hãy cẩn thận trong đó. Không phải ai bước vào Hầm Mộ Đá Vỡ cũng bước ra được.",
    objectives: [] as { type: "kill"; targetId: string; count: number; label: string }[],
    reward_exp: 200,
    reward_gold: 100,
    reward_items: [] as string[],
  },
  {
    id: "quest_guardian_fall",
    title: "Chương 4 — Vệ Thần Cuối Cùng",
    zone: "shattered_tomb",
    giver_npc_id: "npc_ancient_tablet",
    level_requirement: 8,
    prerequisite_quest_id: "quest_road_to_the_tomb" as string | null,
    dialogue_offer:
      "Dòng chữ khắc trên bia đá cổ: \"Chỉ kẻ đánh bại Vệ Thần mới xứng nghe câu chuyện thật sự của Đại Vỡ Vụn.\" Hãy đánh bại Vệ Thần Mộ Đá.",
    dialogue_progress: "Bia đá vẫn im lặng. Vệ Thần Mộ Đá còn đó, canh giữ ký ức cổ xưa.",
    dialogue_complete:
      "Bia đá phát sáng, một mảnh ký ức cổ xưa hiện lên trong tâm trí con... Đại Vỡ Vụn không phải tai nạn.",
    objectives: [{ type: "kill", targetId: "tomb_guardian", count: 1, label: "Vệ Thần Mộ Đá" }],
    reward_exp: 400,
    reward_gold: 200,
    reward_items: ["cracked_stone_core"] as string[],
  },
  {
    id: "quest_herald_of_silence",
    title: "Chương 5 — Sứ Giả Vực Thẳm",
    zone: "void_abyss",
    giver_npc_id: "npc_wanderer",
    level_requirement: 13,
    prerequisite_quest_id: "quest_guardian_fall" as string | null,
    dialogue_offer:
      "Ta đã dò được dấu vết dẫn sâu vào Vực Thẳm — những Kẻ Rình Rập Hư Không đang tụ tập gần lối vào. Hãy giúp ta loại bỏ chúng và tìm manh mối: quét sạch 3 Kẻ Rình Rập Hư Không.",
    dialogue_progress:
      "Những kẻ rình rập lẩn khuất giữa tàn tích. Tiếp tục đuổi theo và tiêu diệt chúng — manh mối sẽ hiện ra sau khi chúng bị khuất phục.",
    dialogue_complete:
      "Ngươi đã chứng tỏ bản lĩnh. Manh mối mới xuất hiện trong Lõi — có khả năng ta sắp tiến gần tới nguồn gốc của Đại Vỡ Vụn. Đợi chờ những điều khó tin hơn nữa.",
    // World boss should not be required as a quest objective — change to nearby elite mob
    objectives: [{ type: "kill", targetId: "void_stalker", count: 3, label: "Kẻ Rình Rập Hư Không" }],
    reward_exp: 1000,
    reward_gold: 500,
    reward_items: ["shard_of_silence"] as string[],
  },
  {
    id: "quest_rift_expedition",
    title: "Chương 6 — Thám Hiểm Rạn Nứt",
    zone: "rift_fields",
    giver_npc_id: "npc_rift_scribe",
    level_requirement: 15,
    prerequisite_quest_id: "quest_herald_of_silence" as string | null,
    dialogue_offer: "Cổng Rạn Nứt mở ra — bên trong có nhiều nguyên liệu quý và cỗ máy bảo vệ. Hãy tiêu diệt 4 Thợ Săn Vực Thẳm để tiến vào sâu hơn.",
    dialogue_progress: "Cổng rung chuyển — Thợ Săn Vực Thẳm còn đó. Tiếp tục dọn đường để tìm Lõi Rạn.",
    dialogue_complete: "Ngươi đã làm sạch cửa ngõ. Vết tạo rạn đã hiển lộ một phần Lõi — ta sẽ điều tra tiếp.",
    objectives: [{ type: "kill", targetId: "abyssal_hunter", count: 4, label: "Thợ Săn Vực Thẳm" }],
    reward_exp: 1600,
    reward_gold: 800,
    reward_items: ["rift_core"],
  },
  {
    id: "quest_construct_down",
    title: "Chương 7 — Sụp Đổ Cỗ Máy",
    zone: "rift_fields",
    giver_npc_id: "npc_rift_scribe",
    level_requirement: 17,
    prerequisite_quest_id: "quest_rift_expedition" as string | null,
    dialogue_offer: "Cỗ Máy Rạn Nứt được kích hoạt — tiêu diệt nó để ngăn dòng năng lượng hủy hoại bản đồ.",
    dialogue_progress: "Cỗ Máy vẫn hoạt động — canh chừng các cơ cấu bảo vệ và tấn công lõi.",
    dialogue_complete: "Cỗ Máy đã im lặng. Một Lõi khác được phơi bày... thế giới này còn nhiều bí ẩn.",
    objectives: [{ type: "kill", targetId: "rift_construct", count: 1, label: "Cỗ Máy Rạn Nứt" }],
    reward_exp: 2200,
    reward_gold: 1400,
    reward_items: ["apex_oblivion"],
  },
  {
    id: "quest_ashfall_oath_vera",
    title: "Chương 8 — Lời Thề Bảo Tồn",
    zone: "ashfall_plains",
    giver_npc_id: "npc_vera",
    level_requirement: 19,
    prerequisite_quest_id: "quest_construct_down" as string | null,
    dialogue_offer: "Đồng Bằng Tro Tàn đang bị cướp bóc bởi những kẻ săn mảnh vỡ. Nếu ngươi đứng cùng Hội Bảo Tồn, hãy dập tắt bọn Cướp Tro Tàn trước.",
    dialogue_progress: "Cướp Tro Tàn vẫn còn lảng vảng quanh đồng bằng. Đừng để chúng mang mảnh vỡ ra khỏi vùng phong ấn.",
    dialogue_complete: "Ngươi đã giữ lời. Hội Bảo Tồn sẽ ghi nhớ người dám chọn kỷ luật thay vì tham vọng.",
    objectives: [{ type: "kill", targetId: "ash_marauder", count: 4, label: "Cướp Tro Tàn" }],
    reward_exp: 2600,
    reward_gold: 1800,
    reward_items: ["water_shard_fragment"],
  },
  {
    id: "quest_ashfall_oath_kael",
    title: "Chương 8 — Lời Thề Thức Tỉnh",
    zone: "ashfall_plains",
    giver_npc_id: "npc_kael",
    level_requirement: 19,
    prerequisite_quest_id: "quest_construct_down" as string | null,
    dialogue_offer: "Những Cấu Trúc Nổi Loạn đang phá nát tuyến khảo sát. Nếu ngươi tin Etheria có thể tái thiết, hãy chứng minh bằng hành động.",
    dialogue_progress: "Cấu Trúc Nổi Loạn chưa bị dẹp hết. Mỗi cỗ máy gục xuống là một bước để chúng ta hiểu lại sức mạnh mảnh vỡ.",
    dialogue_complete: "Tốt. Liên Minh Thức Tỉnh cần những người không sợ dùng sức mạnh để xây lại thế giới.",
    objectives: [{ type: "kill", targetId: "rogue_construct", count: 4, label: "Cấu Trúc Nổi Loạn" }],
    reward_exp: 2600,
    reward_gold: 1800,
    reward_items: ["water_shard_fragment"],
  },
  {
    id: "quest_fallen_paladin_vera",
    title: "Chương 9 — Thánh Kỵ Sĩ Sa Ngã",
    zone: "ashfall_plains",
    giver_npc_id: "npc_vera",
    level_requirement: 21,
    prerequisite_quest_id: "quest_ashfall_oath_vera" as string | null,
    dialogue_offer: "Một hiệp sĩ từng bảo vệ Etheria đã bị mảnh vỡ ăn mòn. Hạ hắn xuống là cách nhân từ cuối cùng.",
    dialogue_progress: "Thánh Kỵ Sĩ Sa Ngã vẫn còn đứng giữa tro tàn. Hãy chuẩn bị kỹ, đó là một trận đánh dài.",
    dialogue_complete: "Sự yên nghỉ cuối cùng đã đến với hắn. Cả đồng bằng vừa thở ra sau nhiều năm bị nguyền rủa.",
    objectives: [{ type: "kill", targetId: "fallen_paladin", count: 1, label: "Thánh Kỵ Sĩ Sa Ngã" }],
    reward_exp: 3600,
    reward_gold: 2600,
    reward_items: ["apex_oblivion"],
  },
  {
    id: "quest_fallen_paladin_kael",
    title: "Chương 9 — Thánh Kỵ Sĩ Sa Ngã",
    zone: "ashfall_plains",
    giver_npc_id: "npc_kael",
    level_requirement: 21,
    prerequisite_quest_id: "quest_ashfall_oath_kael" as string | null,
    dialogue_offer: "Nếu muốn tái thiết Etheria, trước hết ta phải đối mặt với những người đã thất bại trước sức mạnh ấy. Hạ Thánh Kỵ Sĩ Sa Ngã.",
    dialogue_progress: "Hắn vẫn đứng đó, như lời cảnh báo sống về cái giá của tham vọng. Đừng để lời cảnh báo đó thành xiềng xích.",
    dialogue_complete: "Ngươi đã vượt qua nỗi sợ của thời đại cũ. Giờ chúng ta có thể viết tiếp chương mới.",
    objectives: [{ type: "kill", targetId: "fallen_paladin", count: 1, label: "Thánh Kỵ Sĩ Sa Ngã" }],
    reward_exp: 3600,
    reward_gold: 2600,
    reward_items: ["apex_oblivion"],
  },
];

async function seed() {
  console.log("Đang seed item_types...");
  for (const item of itemTypes) {
    await pool.query(
      `INSERT INTO item_types (id, name, rarity, slot, base_stats, level_requirement, tradable, stackable, description, special)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, base_stats = EXCLUDED.base_stats, rarity = EXCLUDED.rarity, special = EXCLUDED.special`,
      [
        item.id,
        item.name,
        item.rarity,
        item.slot,
        JSON.stringify(item.base_stats),
        item.level_requirement,
        !["fire_shard_fragment", "shard_of_silence"].includes(item.id), // vật phẩm thưởng từ quest, không cho trade
        item.stackable ?? false,
        item.description ?? null,
        JSON.stringify(item.special ?? {}),
      ]
    );
  }

  console.log("Đang seed monsters...");
  for (const monster of monsters) {
    await pool.query(
      `INSERT INTO monsters (id, name, zone, level, hp, atk, def, exp_reward, gold_min, gold_max, drop_table, is_boss, respawn_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET hp = EXCLUDED.hp, atk = EXCLUDED.atk, def = EXCLUDED.def,
         is_boss = EXCLUDED.is_boss, respawn_seconds = EXCLUDED.respawn_seconds`,
      [
        monster.id,
        monster.name,
        monster.zone,
        monster.level,
        monster.hp,
        monster.atk,
        monster.def,
        monster.exp_reward,
        monster.gold_min,
        monster.gold_max,
        JSON.stringify(monster.drop_table),
        (monster as any).is_boss ?? false,
        (monster as any).respawn_seconds ?? 300,
      ]
    );
  }

  // Sync any existing boss_state rows with updated monster HP/attributes
  try {
    console.log('Đồng bộ boss_state với monsters (max_hp/current_hp)...');
    await pool.query(
      `UPDATE boss_state bs SET max_hp = m.hp, current_hp = LEAST(bs.current_hp, m.hp)
       FROM monsters m WHERE bs.monster_id = m.id`
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('Không thể đồng bộ boss_state:', message);
  }

  console.log("Đang seed quests...");
  for (const quest of quests) {
    await pool.query(
      `INSERT INTO quests (id, title, zone, giver_npc_id, level_requirement, prerequisite_quest_id,
                            dialogue_offer, dialogue_progress, dialogue_complete, objectives,
                            reward_exp, reward_gold, reward_items)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, dialogue_offer = EXCLUDED.dialogue_offer,
         dialogue_progress = EXCLUDED.dialogue_progress, dialogue_complete = EXCLUDED.dialogue_complete,
         objectives = EXCLUDED.objectives, reward_exp = EXCLUDED.reward_exp,
         reward_gold = EXCLUDED.reward_gold, reward_items = EXCLUDED.reward_items`,
      [
        quest.id,
        quest.title,
        quest.zone,
        quest.giver_npc_id,
        quest.level_requirement,
        quest.prerequisite_quest_id,
        quest.dialogue_offer,
        quest.dialogue_progress,
        quest.dialogue_complete,
        JSON.stringify(quest.objectives),
        quest.reward_exp,
        quest.reward_gold,
        JSON.stringify(quest.reward_items),
      ]
    );
  }

  console.log("Seed hoàn tất!");
}

async function seedShop() {
  console.log('Đang seed shop...');
  const shopRes = await pool.query(
    `INSERT INTO shops (name, description) VALUES ($1,$2)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
     RETURNING id`,
    ['Cửa Hàng Thương Nhân', 'Cửa hàng NPC bán vật phẩm cơ bản cho người chơi']
  );
  const shopId = shopRes.rows[0].id;

  const shopItems = [
    { item_type_id: 'potion_minor_heal', price: 10, stock: 100 },
    { item_type_id: 'potion_minor_mana', price: 12, stock: 80 },
    { item_type_id: 'leather_vest', price: 50, stock: 10 },
    { item_type_id: 'iron_greatsword', price: 180, stock: 5 },
    { item_type_id: 'mystic_orb', price: 180, stock: 5 },
    { item_type_id: 'swift_bow', price: 180, stock: 5 },
    { item_type_id: 'elixir_of_vigor', price: 60, stock: 30 },
    // New powerful equipment available in limited quantity for high price
    { item_type_id: 'tempest_gauntlets', price: 6000, stock: 1 },
    { item_type_id: 'aether_crown', price: 7500, stock: 1 },
    { item_type_id: 'drakehide_gloves', price: 5000, stock: 1 },
    { item_type_id: 'abyssal_edge', price: 9500, stock: 1 },
    { item_type_id: 'rift_core', price: 1200, stock: 10 },
  ];
  for (const si of shopItems) {
    await pool.query(
      `INSERT INTO shop_items (shop_id, item_type_id, price, stock)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (shop_id, item_type_id) DO UPDATE SET price = EXCLUDED.price, stock = EXCLUDED.stock`,
      [shopId, si.item_type_id, si.price, si.stock]
    );
  }
  console.log('Shop seed hoàn tất');
}

// Khi chạy trực tiếp, thực hiện seed chính và shop, rồi đóng pool
async function runAll() {
  try {
    await seed();
    await seedShop();
    await pool.end();
    console.log('All seeds done');
  } catch (err) {
    console.error('Seed thất bại:', err);
    process.exit(1);
  }
}

runAll();
