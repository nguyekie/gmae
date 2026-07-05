export function isSpecialWeaponRarity(rarity?: string | null) {
  return ["rare", "epic", "legendary", "sss_plus"].includes(rarity ?? "");
}

export function getRaritySortRank(rarity?: string | null) {
  switch (rarity) {
    case "sss_plus":
      return 5;
    case "legendary":
      return 4;
    case "epic":
      return 3;
    case "rare":
      return 2;
    case "common":
      return 1;
    default:
      return 0;
  }
}

export function buildWeaponInstanceStats(rarity?: string | null, note?: string) {
  if (!isSpecialWeaponRarity(rarity)) return null;

  const possibleStats = ["atk", "def", "spd"];
  const stat = possibleStats[Math.floor(Math.random() * possibleStats.length)];
  let bonus = 0;

  if (rarity === "rare") bonus = 3 + Math.floor(Math.random() * 4);
  else if (rarity === "epic") bonus = 6 + Math.floor(Math.random() * 7);
  else if (rarity === "legendary") bonus = 12 + Math.floor(Math.random() * 9);
  else if (rarity === "sss_plus") bonus = 20 + Math.floor(Math.random() * 16);

  return {
    special: { stat, bonus },
    ...(note ? { note } : {}),
  };
}
