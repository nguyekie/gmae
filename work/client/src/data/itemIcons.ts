import type { SpriteMatrix } from "./sprites";

// Icon vật phẩm — 1 hình dạng đại diện cho mỗi loại slot, được tô màu động theo độ hiếm
// của vật phẩm (xem getRarityPalette bên dưới) thay vì cố định — nên không cần vẽ riêng
// icon cho từng vật phẩm mà vẫn phân biệt được "độ xịn" bằng màu sắc + viền phát sáng
// (viền do CSS .item-icon--{rarity} đảm nhiệm, xem components.css).
export const ITEM_SLOT_ICONS: Record<string, SpriteMatrix> = {
  weapon: [
    ".....XX.",
    "....XXY.",
    "...XXY..",
    "..XXY...",
    ".XXY.X..",
    "XXYXXX..",
    ".XXX....",
    "..X.....",
  ],
  armor: [
    "..XXXX..",
    ".XXXXXX.",
    "XXXYYXXX",
    "XXXYYXXX",
    "XXXXXXXX",
    ".XXXXXX.",
    "..XXXX..",
    "...XX...",
  ],
  helmet: [
    "..XXXX..",
    ".XXXXXX.",
    "XXXXXXXX",
    "XXXYYXXX",
    "XXXXXXXX",
    "........",
    "..XX.XX.",
    "........",
  ],
  gloves: [
    "........",
    ".X.X.X..",
    ".X.X.X..",
    "XXXXXXX.",
    "XXXXXXX.",
    "XXXXXXX.",
    ".XXXXX..",
    "........",
  ],
  boots: [
    "..XX....",
    "..XX....",
    "..XX....",
    "..XX....",
    "..XXXXX.",
    ".XXXXXXX",
    ".XXXXXXX",
    "........",
  ],
  trinket: [
    "........",
    "..XXXX..",
    ".X....X.",
    "X..YY..X",
    "X..YY..X",
    ".X....X.",
    "..XXXX..",
    "........",
  ],
  shard: [
    "...XX...",
    "..XYYX..",
    ".XYYYYX.",
    "XYYYYYYX",
    ".XYYYYX.",
    "..XYYX..",
    "...XX...",
    "........",
  ],
  consumable: [
    "...XX...",
    "...XX...",
    "..XXXX..",
    ".XYYYYX.",
    ".XYYYYX.",
    ".XXXXXX.",
    "..XXXX..",
    "........",
  ],
  material: [
    "........",
    ".XXX....",
    "XXXXX...",
    "XXXYXX..",
    ".XXYXXX.",
    "..XXXX..",
    "...XX...",
    "........",
  ],
};

export function getRarityIconPalette(rarity: string): Record<string, string> {
  switch (rarity) {
    case "sss_plus":
      return { X: "#ff5f7d", Y: "#ffd36b" };
    case "legendary":
      return { X: "#e0a93e", Y: "#fbe7b5" };
    case "epic":
      return { X: "#a855f7", Y: "#e4cbff" };
    case "rare":
      return { X: "#4a90d9", Y: "#bfe0ff" };
    default:
      return { X: "#9098a8", Y: "#dfe3ea" };
  }
}
