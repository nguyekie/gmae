export function isSpecialWeaponRarity(rarity?: string | null) {
  return ["rare", "epic", "legendary", "mythic", "sss_plus"].includes(rarity ?? "");
}

export function getRaritySortRank(rarity?: string | null) {
  switch (rarity) {
    case "sss_plus":
      return 6;
    case "mythic":
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

  const possibleStats = rarity === "sss_plus" || rarity === "mythic" ? ["atk", "def", "spd", "hp", "mp"] : ["atk", "def", "spd"];
  const statCount =
    rarity === "sss_plus" ? 3 :
    rarity === "mythic" ? 3 :
    rarity === "legendary" ? 2 + Math.floor(Math.random() * 2) :
    rarity === "epic" ? 2 :
    1;

  const rollBonus = (stat: string) => {
    if (rarity === "rare") return 4 + Math.floor(Math.random() * 5);
    if (rarity === "epic") return 8 + Math.floor(Math.random() * 8);
    if (rarity === "legendary") return 15 + Math.floor(Math.random() * 11);
    if (rarity === "mythic") {
      if (stat === "hp") return 160 + Math.floor(Math.random() * 141);
      if (stat === "mp") return 80 + Math.floor(Math.random() * 81);
      return 32 + Math.floor(Math.random() * 25);
    }
    if (rarity === "sss_plus") {
      if (stat === "hp") return 260 + Math.floor(Math.random() * 181);
      if (stat === "mp") return 120 + Math.floor(Math.random() * 101);
      return 55 + Math.floor(Math.random() * 31);
    }
    return 0;
  };

  const shuffledStats = [...possibleStats].sort(() => Math.random() - 0.5);
  const bonuses = shuffledStats.slice(0, statCount).map((stat) => ({ stat, bonus: rollBonus(stat) }));

  return {
    bonuses,
    special: bonuses[0],
    ...(note ? { note } : {}),
  };
}
