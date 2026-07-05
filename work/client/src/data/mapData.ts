import type { NpcSpriteKey, MonsterSpriteKey } from "./sprites";

// Dữ liệu bản đồ tĩnh cho "Khám phá" dạng đi lại được (client-side), hỗ trợ nhiều vùng
// nối với nhau qua cổng dịch chuyển (portal).
// Ghi chú: tương tự các game demo 2D nhẹ, việc di chuyển/va chạm được xử lý ở client để mượt và đơn giản.
// Toàn bộ phần có thể gian lận thật sự (kết quả chiến đấu, máu boss, tiến độ nhiệm vụ, phần thưởng)
// luôn được server tính toán và xác thực lại (xem server/src/routes/combat.ts và quest.ts).

export const TILE_SIZE = 40;
export const MAP_COLS = 16;
export const MAP_ROWS = 10;

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
  "################",
  "#..............#",
  "#..####..####..#",
  "#..#..#..#..#..#",
  ">....#....#....#",
  "#....#....#....#",
  "#..#..#..#..#..#",
  "#..####..####..#",
  "#..............>",
  "################",
];

const ASHFALL_GRID = [
  "################",
  "#..............#",
  "#..##......##..#",
  ">..............#",
  "#..............#",
  "#....######....#",
  "#....#....#....#",
  "#..............#",
  "#..............#",
  "################",
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
      { x: 15, y: 4, toZone: "shattered_tomb", spawnX: 1, spawnY: 8, label: "Hầm Mộ Đá Vỡ →" },
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
      { x: 15, y: 4, toZone: "void_abyss", spawnX: 1, spawnY: 4, label: "Vực Thẳm Hư Không →" },
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
      { x: 14, y: 4, toZone: "rift_fields", spawnX: 0, spawnY: 4, label: "Rạn Nứt →" },
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
      { x: 15, y: 8, toZone: "ashfall_plains", spawnX: 1, spawnY: 3, label: "Đồng Bằng Tro Tàn →" },
    ],
    defaultSpawn: { x: 8, y: 1 },
  },

  ashfall_plains: {
    id: "ashfall_plains",
    name: "Đồng Bằng Tro Tàn",
    grid: ASHFALL_GRID,
    npcs: [
      { id: "npc_vera", name: "Chỉ Huy Vera", sprite: "commander", x: 3, y: 1 },
      { id: "npc_kael", name: "Hiệp Sĩ Kael", sprite: "knight", x: 12, y: 1 },
    ],
    spawns: [
      { spawnId: "rogue_1", monsterId: "rogue_construct", name: "Cấu Trúc Nổi Loạn", sprite: "rogue_construct", x: 3, y: 7, respawnMs: 35000 },
      { spawnId: "rogue_2", monsterId: "rogue_construct", name: "Cấu Trúc Nổi Loạn", sprite: "rogue_construct", x: 12, y: 7, respawnMs: 35000 },
      { spawnId: "marauder_1", monsterId: "ash_marauder", name: "Cướp Tro Tàn", sprite: "ash_marauder", x: 6, y: 4, respawnMs: 32000 },
      { spawnId: "marauder_2", monsterId: "ash_marauder", name: "Cướp Tro Tàn", sprite: "ash_marauder", x: 9, y: 4, respawnMs: 32000 },
      {
        spawnId: "paladin_1",
        monsterId: "fallen_paladin",
        name: "Thánh Kỵ Sĩ Sa Ngã",
        sprite: "fallen_paladin",
        x: 7,
        y: 8,
        respawnMs: 1200000,
        isBoss: true,
      },
    ],
    portals: [{ x: 0, y: 3, toZone: "rift_fields", spawnX: 14, spawnY: 8, label: "← Cánh Đồng Rạn Nứt" }],
    defaultSpawn: { x: 1, y: 3 },
  },
};

export function isBlocked(zone: ZoneDef, x: number, y: number): boolean {
  if (y < 0 || y >= zone.grid.length || x < 0 || x >= zone.grid[0].length) return true;
  const tile = zone.grid[y][x];
  return tile === "#" || tile === "~";
}

export function findPortal(zone: ZoneDef, x: number, y: number): PortalDef | undefined {
  return zone.portals.find((p) => p.x === x && p.y === y);
}
