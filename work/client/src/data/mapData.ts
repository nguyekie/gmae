import type { NpcSpriteKey, MonsterSpriteKey } from "./sprites";

// Dữ liệu bản đồ tĩnh cho "Khám phá" dạng đi lại được (client-side), hỗ trợ nhiều vùng
// nối với nhau qua cổng dịch chuyển (portal).
// Ghi chú: tương tự các game demo 2D nhẹ, việc di chuyển/va chạm được xử lý ở client để mượt và đơn giản.
// Toàn bộ phần có thể gian lận thật sự (kết quả chiến đấu, máu boss, tiến độ nhiệm vụ, phần thưởng)
// luôn được server tính toán và xác thực lại (xem server/src/routes/combat.ts và quest.ts).

export const TILE_SIZE = 40;

// Ký hiệu: '.' cỏ/nền (đi được) | '#' vật cản (chặn) | '~' nước (chặn) | ',' đường mòn (đi được)
// | '>' cổng dịch chuyển (đi được, chạm vào sẽ chuyển vùng)

export interface NpcDef {
  id: string;
  name: string;
  sprite: NpcSpriteKey;
  x: number;
  y: number;
}

export interface MonsterSpawnDef {
  spawnId: string;
  monsterId: string;
  name: string;
  sprite: MonsterSpriteKey;
  x: number;
  y: number;
  respawnMs: number;
  isBoss?: boolean; // boss dùng máu bền từ server (GET /combat/boss/:monsterId) thay vì máu client tự đoán
}

export interface PortalDef {
  x: number;
  y: number;
  toZone: string;
  spawnX: number;
  spawnY: number;
  label: string;
  unlockQuestIds?: string[];
  unlockMode?: "all" | "any";
  lockedLabel?: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  grid: string[];
  npcs: NpcDef[];
  spawns: MonsterSpawnDef[];
  portals: PortalDef[];
  defaultSpawn: { x: number; y: number };
}

const VILLAGE_GRID = [
  "################",
  "#..............#",
  "#..............#",
  "#....##..##....#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............>",
  "################",
];

const FOREST_GRID = [
  "################",
  "#..............#",
  "#..............#",
  "#....##..##....#",
  "#..............>",
  "#..............#",
  "#.......~~.....#",
  "#.......~~.....#",
  ">..............#",
  "################",
];

const TOMB_GRID = [
  "################",
  "#..............#",
  "#..#........#..#",
  "#..#........#..#",
  "#......##......>",
  "#..............#",
  "#..............#",
  "#..............#",
  ">..............#",
  "################",
];

// Vực Thẳm Hư Không — vùng cuối cùng hiện có, nơi trấn giữ boss thế giới.
// Bố cục vòng tròn quanh 1 khoảng trống trung tâm nơi Hùng Giả Khổng Lồ đứng canh giữ,
// tạo cảm giác "đấu trường" khác hẳn các vùng trước.
const VOID_ABYSS_GRID = [
  "################",
  "#..............#",
  "#.####....####.#",
  "#.#..........#.#",
  ">....#....#...>#",
  "#....#....#....#",
  "#.#..........#.#",
  "#.####....####.#",
  "#..............#",
  "################",
];

const RIFT_GRID = [
  "##################",
  "#................#",
  "#..####....####..#",
  "#..#..#....#..#..#",
  ">....#......#....#",
  "#....#......#....#",
  "#..#..#....#..#..#",
  "#..####....####..#",
  "#................>",
  "##################",
];

const ASHFALL_GRID = [
  "####################",
  "#..................#",
  "#..##..........##..#",
  ">..................#",
  "#..................#",
  "#.....########.....#",
  "#.....#......#.....#",
  "#..................#",
  "#..................>",
  "#..................#",
  "####################",
];

const OATHFORGE_GRID = [
  "########################",
  "#......................#",
  "#..#####........#####..#",
  "#..#................#..#",
  "#..#.....######.....#..#",
  ">.......##....##.......>",
  "#.......##....##.......#",
  "#..#.....######.....#..#",
  "#..#................#..#",
  "#..#####........#####..#",
  "#......................#",
  "########################",
];

const FIRE_CLUSTER_GRID = [
  "####################",
  "#..****....****....#",
  "#.*##**....**##*...#",
  ">..*^^*....*^^*....#",
  "#....**####**......#",
  "#..*....**....*....#",
  "#.*##*......*##*...#",
  "#....*^^**^^*......>",
  "#..****....****....#",
  "####################",
];

const ICE_CLUSTER_GRID = [
  "####################",
  "#..====....====....#",
  "#.=ii==....==ii=...#",
  ">..=............=..#",
  "#..=..iiiiii..=....#",
  "#..====....====....#",
  "#.=ii=......=ii=...#",
  "#..=............=..>",
  "#..====....====....#",
  "####################",
];

const WATER_CLUSTER_GRID = [
  "####################",
  "#..wwww....wwww....#",
  "#.ww~~~~..~~~~ww...#",
  ">..ww~~....~~ww....#",
  "#....wwwwwwww......#",
  "#..ww........ww....#",
  "#.ww~~~~..~~~~ww...#",
  "#....ww....ww......#",
  "#..wwww....wwww....#",
  "####################",
];

export const ZONES: Record<string, ZoneDef> = {
  starting_village: {
    id: "starting_village",
    name: "Làng Khởi Nguyên",
    grid: VILLAGE_GRID,
    npcs: [
      { id: "npc_oris", name: "Trưởng Làng Oris", sprite: "elder", x: 7, y: 2 },
      { id: "npc_lyra", name: "Thợ Săn Lyra", sprite: "hunter", x: 12, y: 4 },
      { id: "npc_ren", name: "Học Giả Ren", sprite: "scholar", x: 3, y: 6 },
    ],
    spawns: [],
    portals: [{ x: 15, y: 8, toZone: "whispering_forest", spawnX: 1, spawnY: 8, label: "Rừng Thì Thầm" }],
    defaultSpawn: { x: 7, y: 6 },
  },

  whispering_forest: {
    id: "whispering_forest",
    name: "Rừng Thì Thầm",
    grid: FOREST_GRID,
    npcs: [],
    spawns: [
      { spawnId: "slime_1", monsterId: "forest_slime", name: "Nhớt Rừng", sprite: "slime", x: 4, y: 2, respawnMs: 15000 },
      { spawnId: "slime_2", monsterId: "forest_slime", name: "Nhớt Rừng", sprite: "slime", x: 9, y: 2, respawnMs: 15000 },
      { spawnId: "slime_3", monsterId: "forest_slime", name: "Nhớt Rừng", sprite: "slime", x: 3, y: 7, respawnMs: 15000 },
      { spawnId: "wolf_1", monsterId: "shadow_wolf", name: "Sói Bóng Tối", sprite: "wolf", x: 11, y: 7, respawnMs: 22000 },
      { spawnId: "wolf_2", monsterId: "shadow_wolf", name: "Sói Bóng Tối", sprite: "wolf", x: 13, y: 2, respawnMs: 22000 },
    ],
    portals: [
      { x: 0, y: 8, toZone: "starting_village", spawnX: 14, spawnY: 8, label: "← Làng Khởi Nguyên" },
      { x: 15, y: 4, toZone: "shattered_tomb", spawnX: 1, spawnY: 8, label: "Hầm Mộ Đá Vỡ →", unlockQuestIds: ["quest_shadow_in_the_deep_woods"], lockedLabel: "Hoàn thành Chương 2 để vào Hầm Mộ Đá Vỡ" },
    ],
    defaultSpawn: { x: 2, y: 1 },
  },

  shattered_tomb: {
    id: "shattered_tomb",
    name: "Hầm Mộ Đá Vỡ",
    grid: TOMB_GRID,
    npcs: [{ id: "npc_ancient_tablet", name: "Bia Đá Cổ", sprite: "tablet", x: 7, y: 1 }],
    spawns: [
      { spawnId: "guardian_1", monsterId: "tomb_guardian", name: "Vệ Thần Mộ Đá", sprite: "guardian", x: 7, y: 5, respawnMs: 40000 },
      { spawnId: "wraith_1", monsterId: "ember_wraith", name: "Hồn Ma Tro Tàn", sprite: "wraith", x: 12, y: 4, respawnMs: 40000 },
      { spawnId: "wraith_2", monsterId: "ember_wraith", name: "Hồn Ma Tro Tàn", sprite: "wraith", x: 3, y: 4, respawnMs: 40000 },
    ],
    portals: [
      { x: 0, y: 8, toZone: "whispering_forest", spawnX: 14, spawnY: 4, label: "← Rừng Thì Thầm" },
      { x: 15, y: 4, toZone: "void_abyss", spawnX: 1, spawnY: 4, label: "Vực Thẳm Hư Không →", unlockQuestIds: ["quest_guardian_fall"], lockedLabel: "Hoàn thành Chương 4 để mở Vực Thẳm Hư Không" },
    ],
    defaultSpawn: { x: 1, y: 7 },
  },

  void_abyss: {
    id: "void_abyss",
    name: "Vực Thẳm Hư Không",
    grid: VOID_ABYSS_GRID,
    npcs: [{ id: "npc_wanderer", name: "Lữ Khách Bí Ẩn", sprite: "wanderer", x: 2, y: 1 }],
    spawns: [
      { spawnId: "stalker_1", monsterId: "void_stalker", name: "Kẻ Rình Rập Hư Không", sprite: "stalker", x: 3, y: 5, respawnMs: 30000 },
      { spawnId: "wisp_1", monsterId: "abyss_wisp", name: "Đóm Lửa Vực Thẳm", sprite: "wisp", x: 12, y: 5, respawnMs: 30000 },
      {
        spawnId: "titan_1",
        monsterId: "colossal_titan",
        name: "Hùng Giả Khổng Lồ",
        sprite: "titan",
        x: 7,
        y: 5,
        respawnMs: 900000,
        isBoss: true,
      },
    ],
    portals: [
      { x: 0, y: 4, toZone: "shattered_tomb", spawnX: 14, spawnY: 4, label: "← Hầm Mộ Đá Vỡ" },
      { x: 14, y: 4, toZone: "rift_fields", spawnX: 0, spawnY: 4, label: "Cánh Đồng Rạn Nứt →", unlockQuestIds: ["quest_herald_of_silence"], lockedLabel: "Hoàn thành Chương 5 để vào Cánh Đồng Rạn Nứt" },
    ],
    defaultSpawn: { x: 8, y: 1 },
  },
  rift_fields: {
    id: "rift_fields",
    name: "Cánh Đồng Rạn Nứt",
    grid: RIFT_GRID,
    npcs: [
      { id: "npc_rift_scribe", name: "Học Giả Rạn", sprite: "scholar", x: 8, y: 2 },
    ],
    spawns: [
      { spawnId: "hunter_1", monsterId: "abyssal_hunter", name: "Thợ Săn Vực Thẳm", sprite: "abyssal_hunter", x: 5, y: 3, respawnMs: 30000 },
      { spawnId: "hunter_2", monsterId: "abyssal_hunter", name: "Thợ Săn Vực Thẳm", sprite: "abyssal_hunter", x: 10, y: 3, respawnMs: 30000 },
      { spawnId: "construct_1", monsterId: "rift_construct", name: "Cỗ Máy Rạn Nứt", sprite: "rift_construct", x: 7, y: 5, respawnMs: 600000 },
    ],
    portals: [
      { x: 0, y: 4, toZone: "void_abyss", spawnX: 14, spawnY: 4, label: "← Vực Thẳm Hư Không" },
      { x: 17, y: 8, toZone: "ashfall_plains", spawnX: 1, spawnY: 3, label: "Đồng Bằng Tro Tàn →", unlockQuestIds: ["quest_construct_down"], lockedLabel: "Hoàn thành Chương 7 để tới Đồng Bằng Tro Tàn" },
    ],
    defaultSpawn: { x: 8, y: 1 },
  },

  ashfall_plains: {
    id: "ashfall_plains",
    name: "Đồng Bằng Tro Tàn",
    grid: ASHFALL_GRID,
    npcs: [
      { id: "npc_vera", name: "Chỉ Huy Vera", sprite: "commander", x: 3, y: 1 },
      { id: "npc_kael", name: "Hiệp Sĩ Kael", sprite: "knight", x: 16, y: 1 },
    ],
    spawns: [
      { spawnId: "rogue_1", monsterId: "rogue_construct", name: "Cấu Trúc Nổi Loạn", sprite: "rogue_construct", x: 3, y: 7, respawnMs: 35000 },
      { spawnId: "rogue_2", monsterId: "rogue_construct", name: "Cấu Trúc Nổi Loạn", sprite: "rogue_construct", x: 15, y: 7, respawnMs: 35000 },
      { spawnId: "marauder_1", monsterId: "ash_marauder", name: "Cướp Tro Tàn", sprite: "ash_marauder", x: 7, y: 4, respawnMs: 32000 },
      { spawnId: "marauder_2", monsterId: "ash_marauder", name: "Cướp Tro Tàn", sprite: "ash_marauder", x: 12, y: 4, respawnMs: 32000 },
      {
        spawnId: "paladin_1",
        monsterId: "fallen_paladin",
        name: "Thánh Kỵ Sĩ Sa Ngã",
        sprite: "fallen_paladin",
        x: 9,
        y: 8,
        respawnMs: 1200000,
        isBoss: true,
      },
    ],
    portals: [
      { x: 0, y: 3, toZone: "rift_fields", spawnX: 14, spawnY: 8, label: "← Cánh Đồng Rạn Nứt" },
      { x: 19, y: 8, toZone: "oathforge_depths", spawnX: 1, spawnY: 5, label: "Lò Rèn Lời Thề →", unlockQuestIds: ["quest_ashfall_oath_vera", "quest_ashfall_oath_kael"], unlockMode: "any", lockedLabel: "Hoàn thành một nhánh Chương 8 để xuống Lò Rèn Lời Thề" },
    ],
    defaultSpawn: { x: 1, y: 3 },
  },

  oathforge_depths: {
    id: "oathforge_depths",
    name: "Lò Rèn Lời Thề",
    grid: OATHFORGE_GRID,
    npcs: [
      { id: "npc_vera", name: "Chỉ Huy Vera", sprite: "commander", x: 3, y: 1 },
      { id: "npc_kael", name: "Hiệp Sĩ Kael", sprite: "knight", x: 20, y: 1 },
      { id: "npc_rift_scribe", name: "Học Giả Rạn", sprite: "scholar", x: 11, y: 5 },
    ],
    spawns: [
      { spawnId: "sentinel_1", monsterId: "ashbound_sentinel", name: "Vệ Binh Tro Buộc", sprite: "ashbound_sentinel", x: 5, y: 8, respawnMs: 36000 },
      { spawnId: "sentinel_2", monsterId: "ashbound_sentinel", name: "Vệ Binh Tro Buộc", sprite: "ashbound_sentinel", x: 18, y: 8, respawnMs: 36000 },
      { spawnId: "smith_echo_1", monsterId: "shard_smith_echo", name: "Dư Âm Thợ Rèn", sprite: "shard_smith_echo", x: 7, y: 3, respawnMs: 40000 },
      { spawnId: "smith_echo_2", monsterId: "shard_smith_echo", name: "Dư Âm Thợ Rèn", sprite: "shard_smith_echo", x: 16, y: 3, respawnMs: 40000 },
      { spawnId: "oathbreaker_1", monsterId: "oathbreaker_knight", name: "Kỵ Sĩ Bội Ước", sprite: "oathbreaker_knight", x: 10, y: 9, respawnMs: 52000 },
      { spawnId: "oathbreaker_2", monsterId: "oathbreaker_knight", name: "Kỵ Sĩ Bội Ước", sprite: "oathbreaker_knight", x: 13, y: 9, respawnMs: 52000 },
    ],
    portals: [
      { x: 0, y: 5, toZone: "ashfall_plains", spawnX: 18, spawnY: 8, label: "← Đồng Bằng Tro Tàn" },
      { x: 23, y: 5, toZone: "fire_cluster", spawnX: 1, spawnY: 3, label: "Vùng Đất Lửa →", unlockQuestIds: ["quest_fallen_paladin_vera", "quest_fallen_paladin_kael"], unlockMode: "any", lockedLabel: "Hoàn thành Chương 9 để mở Vùng Đất Lửa" },
    ],
    defaultSpawn: { x: 1, y: 5 },
  },

  fire_cluster: {
    id: "fire_cluster",
    name: "Vùng Đất Lửa",
    grid: FIRE_CLUSTER_GRID,
    npcs: [{ id: "npc_rift_scribe", name: "Học Giả Rạn", sprite: "scholar", x: 9, y: 1 }],
    spawns: [
      { spawnId: "ember_colossus_1", monsterId: "ember_colossus", name: "Khổng Tượng Dung Nham", sprite: "flame_colossus", x: 5, y: 4, respawnMs: 42000 },
      { spawnId: "ember_colossus_2", monsterId: "ember_colossus", name: "Khổng Tượng Dung Nham", sprite: "flame_colossus", x: 14, y: 4, respawnMs: 42000 },
      { spawnId: "ember_colossus_3", monsterId: "ember_colossus", name: "Khổng Tượng Dung Nham", sprite: "flame_colossus", x: 9, y: 7, respawnMs: 42000 },
      { spawnId: "ember_phoenix_1", monsterId: "ember_phoenix", name: "Phượng Hoàng Tro Đỏ", sprite: "ember_phoenix", x: 10, y: 2, respawnMs: 48000 },
    ],
    portals: [
      { x: 0, y: 3, toZone: "oathforge_depths", spawnX: 22, spawnY: 5, label: "← Lò Rèn Lời Thề" },
      { x: 19, y: 7, toZone: "ice_cluster", spawnX: 1, spawnY: 3, label: "Vùng Đất Băng →", unlockQuestIds: ["quest_fire_cluster"], lockedLabel: "Hoàn thành Chương 10 để mở Vùng Đất Băng" },
    ],
    defaultSpawn: { x: 1, y: 3 },
  },

  ice_cluster: {
    id: "ice_cluster",
    name: "Vùng Đất Băng",
    grid: ICE_CLUSTER_GRID,
    npcs: [{ id: "npc_rift_scribe", name: "Học Giả Rạn", sprite: "scholar", x: 9, y: 1 }],
    spawns: [
      { spawnId: "frost_archon_1", monsterId: "frostbound_archon", name: "Chấp Chính Băng Phong", sprite: "frost_archon", x: 5, y: 4, respawnMs: 46000 },
      { spawnId: "frost_archon_2", monsterId: "frostbound_archon", name: "Chấp Chính Băng Phong", sprite: "frost_archon", x: 14, y: 4, respawnMs: 46000 },
      { spawnId: "frost_archon_3", monsterId: "frostbound_archon", name: "Chấp Chính Băng Phong", sprite: "frost_archon", x: 9, y: 7, respawnMs: 46000 },
      { spawnId: "crystal_yeti_1", monsterId: "crystal_yeti", name: "Cự Nhân Pha Lê Băng", sprite: "crystal_yeti", x: 10, y: 2, respawnMs: 52000 },
    ],
    portals: [
      { x: 0, y: 3, toZone: "fire_cluster", spawnX: 18, spawnY: 7, label: "← Vùng Đất Lửa" },
      { x: 19, y: 7, toZone: "water_cluster", spawnX: 1, spawnY: 3, label: "Vùng Đất Nước →", unlockQuestIds: ["quest_ice_cluster"], lockedLabel: "Hoàn thành Chương 11 để mở Vùng Đất Nước" },
    ],
    defaultSpawn: { x: 1, y: 3 },
  },

  water_cluster: {
    id: "water_cluster",
    name: "Vùng Đất Nước",
    grid: WATER_CLUSTER_GRID,
    npcs: [{ id: "npc_rift_scribe", name: "Học Giả Rạn", sprite: "scholar", x: 9, y: 1 }],
    spawns: [
      { spawnId: "tide_serpent_1", monsterId: "tide_serpent", name: "Giao Long Triều Sâu", sprite: "tide_serpent", x: 5, y: 4, respawnMs: 52000 },
      { spawnId: "tide_serpent_2", monsterId: "tide_serpent", name: "Giao Long Triều Sâu", sprite: "tide_serpent", x: 14, y: 4, respawnMs: 52000 },
      { spawnId: "tide_serpent_3", monsterId: "tide_serpent", name: "Giao Long Triều Sâu", sprite: "tide_serpent", x: 9, y: 8, respawnMs: 52000 },
      { spawnId: "abyssal_manta_1", monsterId: "abyssal_manta", name: "Manta Vực Triều", sprite: "abyssal_manta", x: 10, y: 2, respawnMs: 56000 },
    ],
    portals: [{ x: 0, y: 3, toZone: "ice_cluster", spawnX: 18, spawnY: 7, label: "← Vùng Đất Băng" }],
    defaultSpawn: { x: 1, y: 3 },
  },
};

export function getZoneCols(zone: ZoneDef): number {
  return Math.max(...zone.grid.map((row) => row.length));
}

export function getZoneRows(zone: ZoneDef): number {
  return zone.grid.length;
}

export function isBlocked(zone: ZoneDef, x: number, y: number): boolean {
  if (y < 0 || y >= zone.grid.length || x < 0 || x >= zone.grid[y].length) return true;
  const tile = zone.grid[y][x];
  return !tile || tile === "#" || tile === "~" || tile === "^" || tile === "i";
}

export function findPortal(zone: ZoneDef, x: number, y: number): PortalDef | undefined {
  return zone.portals.find((p) => p.x === x && p.y === y);
}
