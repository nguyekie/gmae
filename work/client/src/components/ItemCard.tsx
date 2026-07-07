import type { ReactNode } from "react";
import { PixelSprite } from "./PixelSprite";
import { ITEM_SLOT_ICONS, getRarityIconPalette } from "../data/itemIcons";

interface ItemLike {
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic" | "sss_plus";
  slot?: string;
  base_stats?: Record<string, number> | null;
  level_requirement?: number;
  instance_stats?: any;
  special?: any;
}

const RARITY_LABEL: Record<string, string> = {
  common: "Thường",
  rare: "Hiếm",
  epic: "Quý",
  legendary: "Huyền thoại",
  mythic: "Thần thoại",
  sss_plus: "SSS+",
};

const SLOT_LABEL: Record<string, string> = {
  weapon: "Vũ khí",
  armor: "Giáp",
  helmet: "Mũ",
  gloves: "Găng",
  boots: "Giày",
  trinket: "Trang sức",
  shard: "Mảnh Nguyên Tố",
  costume: "Cải trang",
  consumable: "Tiêu hao",
  material: "Nguyên liệu",
};

const SPECIAL_LABEL: Record<string, string> = {
  drop_rate_bonus: "Rơi đồ",
  boss_drop_rate_bonus: "Rơi boss",
  boss_damage_bonus: "Sát thương boss",
  elite_damage_bonus: "Sát thương tinh anh",
  damage_reduction: "Giảm sát thương",
  exp_bonus: "EXP",
  power_bonus: "Sức mạnh",
  potential_per_hour_bonus: "Tiềm năng/giờ",
  atk_bonus: "ATK",
  def_bonus: "DEF",
  spd_bonus: "SPD",
  hp_bonus: "HP",
  mp_bonus: "MP",
};

const BUFF_LABEL: Record<string, string> = {
  potential_gain: "x2 tiềm năng",
  drop_rate: "x2 rơi đồ",
  gold_gain: "x2 vàng",
};

interface ItemCardProps {
  item: ItemLike;
  footer?: ReactNode;
  onClick?: () => void;
}

function formatSpecialValue(key: string, value: unknown) {
  if (typeof value !== "number") return String(value);
  if (key.includes("rate") || key.includes("damage") || key === "damage_reduction" || key === "exp_bonus") {
    return `+${Math.round(value * 100)}%`;
  }
  return value > 0 ? `+${value}` : String(value);
}

function formatInstanceValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

export function ItemCard({ item, footer, onClick }: ItemCardProps) {
  const instanceBonuses = Array.isArray(item.instance_stats?.bonuses)
    ? item.instance_stats.bonuses
    : item.instance_stats?.special
    ? [item.instance_stats.special]
    : [];

  return (
    <div
      className={`item-card item-card--${item.rarity}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="item-card__icon">
        <PixelSprite
          matrix={ITEM_SLOT_ICONS[item.slot ?? "material"] ?? ITEM_SLOT_ICONS.material}
          palette={getRarityIconPalette(item.rarity)}
          size={48}
        />
      </div>

      <div className="item-card__header">
        <span className={`item-card__rarity item-card__rarity--${item.rarity}`}>
          {RARITY_LABEL[item.rarity]}
        </span>
        {item.slot && <span className="item-card__slot">{SLOT_LABEL[item.slot] ?? item.slot}</span>}
      </div>

      <div className="item-card__name">{item.name}</div>

      {typeof item.level_requirement === "number" && (
        <div className="item-card__requirement">Cần cấp {item.level_requirement}</div>
      )}

      {item.base_stats && Object.keys(item.base_stats).length > 0 && (
        <div className="item-card__stats">
          {Object.entries(item.base_stats).map(([k, v]) => (
            <span key={k} className="item-card__stat">
              {k.toUpperCase()} +{v}
            </span>
          ))}
        </div>
      )}

      {item.instance_stats && (
        <div className="item-card__stats item-card__stats--instance">
          {instanceBonuses.length > 0
            ? instanceBonuses.map((bonus: any) => (
                <div className="item-card__special" key={bonus.stat}>
                  {String(bonus.stat).toUpperCase()} +{bonus.bonus} <small>(tùy biến)</small>
                </div>
              ))
            : Object.entries(item.instance_stats)
                .filter(([k]) => k !== "note")
                .map(([k, v]) => (
                  <span key={k} className="item-card__stat">
                    {k}: {formatInstanceValue(v)}
                  </span>
                ))}
        </div>
      )}

      {item.special && (
        <div className="item-card__special-meta">
          {item.special.use?.buff_type && (
            <div className="item-card__special-list">
              <span className="item-card__special-tag">
                Kích hoạt {BUFF_LABEL[item.special.use.buff_type] ?? item.special.use.buff_type}
              </span>
              <span className="item-card__special-tag">
                {item.special.use.duration_minutes ?? 60} phút
              </span>
            </div>
          )}

          {item.special.passive && (
            <div className="item-card__special-list">
              {Object.entries(item.special.passive).map(([k, v]) => (
                <span className="item-card__special-tag" key={k}>
                  {SPECIAL_LABEL[k] ?? k} {formatSpecialValue(k, v)}
                </span>
              ))}
            </div>
          )}

          {item.special.skill && (
            <div className="item-card__skill">
              <strong>Kỹ năng: {item.special.skill.name}</strong>
              <span>{item.special.skill.description}</span>
            </div>
          )}
        </div>
      )}

      {item.rarity === "sss_plus" && (
        <div className="item-card__special-meta">
          <div className="item-card__passive">Đặc quyền SSS+: tăng hiệu quả khi săn boss.</div>
        </div>
      )}

      {footer && <div className="item-card__footer">{footer}</div>}
    </div>
  );
}
