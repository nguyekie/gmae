// Sprite "khối" (block pixel-art) vẽ hoàn toàn bằng CSS — không cần file ảnh.
// Mỗi sprite là 1 lưới 8x8 ký tự, mỗi ký tự ánh xạ sang 1 màu trong palette riêng.
// '.' luôn là trong suốt.

export type SpriteMatrix = string[];

export const HUMANOID: SpriteMatrix = [
  "..HHHH..",
  ".HSSSSH.",
  ".SSEESS.",
  ".SSSSSS.",
  "..BBBB..",
  ".BBBBBB.",
  ".BB..BB.",
  ".LL..LL.",
];

export const PLAYER_PALETTES: Record<string, Record<string, string>> = {
  warrior: { H: "#2b2118", S: "#e3b389", E: "#1a1a1a", B: "#8b93a1", L: "#4a4a52" },
  mage: { H: "#3d2a5c", S: "#e3b389", E: "#1a1a1a", B: "#5b3fa0", L: "#3d2a5c" },
  archer: { H: "#4a3319", S: "#e3b389", E: "#1a1a1a", B: "#4f7942", L: "#35502c" },
};

export const NPC_SPRITES: Record<string, { matrix: SpriteMatrix; palette: Record<string, string> }> = {
  elder: {
    matrix: HUMANOID,
    palette: { H: "#cfcfcf", S: "#d8a878", E: "#1a1a1a", B: "#7a5c2e", L: "#4a3a1e" },
  },
  hunter: {
    matrix: HUMANOID,
    palette: { H: "#7a3b1e", S: "#e3b389", E: "#1a1a1a", B: "#375a3a", L: "#2c4530" },
  },
  scholar: {
    matrix: HUMANOID,
    palette: { H: "#2b2438", S: "#d8a878", E: "#1a1a1a", B: "#3d3457", L: "#241f30" },
  },
  tablet: {
    matrix: [
      "........",
      ".DDDDDD.",
      "DDGGGGDD",
      "DGDGDGGD",
      "DGGDGGGD",
      "DGDGGDGD",
      "DDGGGGDD",
      ".DDDDDD.",
    ],
    palette: { D: "#4a4438", G: "#8f9f6b" },
  },
  wanderer: {
    matrix: HUMANOID,
    palette: { H: "#1c1f2b", S: "#c9a877", E: "#c9a24b", B: "#2c2f3d", L: "#1a1c24" },
  },
};

export type MonsterSpriteKey =
  | "slime"
  | "wolf"
  | "guardian"
  | "wraith"
  | "stalker"
  | "abyssal_hunter"
  | "rift_construct"
  | "wisp"
  | "titan";

export const MONSTER_SPRITES: Record<MonsterSpriteKey, { matrix: SpriteMatrix; palette: Record<string, string> }> = {
  slime: {
    matrix: [
      "........",
      "..GGGG..",
      ".GGGGGG.",
      "GGGDGDGG",
      "GGGGGGGG",
      "GGGGGGGG",
      ".GGGGGG.",
      "..G..G..",
    ],
    palette: { G: "#6fbf73", D: "#1a1a1a" },
  },
  wolf: {
    matrix: [
      "W......W",
      "WWW..WWW",
      ".WWWWWW.",
      ".WRWWRW.",
      ".WWWWWW.",
      "WWWWWWWW",
      ".WW..WW.",
      ".WW..WW.",
    ],
    palette: { W: "#2c2438", R: "#d9534a" },
  },
  guardian: {
    matrix: [
      ".SSSSSS.",
      "SSSSSSSS",
      "SSRRRRSS",
      "SSSSSSSS",
      ".SSSSSS.",
      "SS.SS.SS",
      "SS.SS.SS",
      "SS.SS.SS",
    ],
    palette: { S: "#8f9f6b", R: "#e0a93e" },
  },
  wraith: {
    matrix: [
      "..VVVV..",
      ".VVVVVV.",
      "VVOOVOOV",
      "VVVVVVVV",
      "VVVVVVVV",
      ".VVVVVV.",
      "..V..V..",
      ".V....V.",
    ],
    palette: { V: "#5b3fa0", O: "#e4572e" },
  },
  stalker: {
    matrix: [
      "V.V..V.V",
      ".VVVVVV.",
      "VVOVVOVV",
      "VVVVVVVV",
      ".VVVVVV.",
      "..VVVV..",
      ".V.VV.V.",
      "V.V..V.V",
    ],
    palette: { V: "#241f30", O: "#9b6bd9" },
  },
  abyssal_hunter: {
    matrix: [
      "..NNNN..",
      ".N..NNN.",
      "NNNWWNNN",
      "NNNWWNNN",
      ".NNWWNN.",
      "..N..N..",
      ".N.NN.N.",
      "N..NN..N",
    ],
    palette: { N: "#2e1f3c", W: "#c17ee9" },
  },
  rift_construct: {
    matrix: [
      ".MMMMMM.",
      "MMMMMMMM",
      "MMXXYYMM",
      "MMXXYYMM",
      ".MMMMMM.",
      "MXM..XMM",
      "MXX..XMM",
      ".M....M.",
    ],
    palette: { M: "#657b69", X: "#d3d3a4", Y: "#f4c94d" },
  },
  wisp: {
    matrix: [
      "........",
      "..OOOO..",
      ".OOOOOO.",
      "OOOFFOOO",
      ".OOOOOO.",
      "..OOOO..",
      "...OO...",
      "........",
    ],
    palette: { O: "#e4572e", F: "#f4d35e" },
  },
  // Boss — hình dáng to bản, gai góc hơn hẳn quái thường; dùng cùng lưới 8x8 nhưng phối màu
  // tối/đỏ đặc trưng "world boss", và luôn được render với kích thước lớn hơn (xem CombatOverlay).
  titan: {
    matrix: [
      "T.TTTT.T",
      "TTTTTTTT",
      "TRRTTRRT",
      "TTTTTTTT",
      "TTOOOOTT",
      "TTTOOTTT",
      "TT.TT.TT",
      "T..TT..T",
    ],
    palette: { T: "#3a2e2e", R: "#e0a93e", O: "#8b1e1e" },
  },
};
