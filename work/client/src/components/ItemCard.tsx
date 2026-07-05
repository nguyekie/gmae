import type { ReactNode } from "react";
import { PixelSprite } from "./PixelSprite";
import { ITEM_SLOT_ICONS, getRarityIconPalette } from "../data/itemIcons";

interface ItemLike {
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  slot?: string;
  base_stats?: Record<string, number> | null;
  instance_stats?: any;
}

const RARITY_LABEL: Record<string, string> = {
  common: "Thường",
  rare: "Hiếm",
  epic: "Quý",
  legendary: "Huyền thoại",
};

const SLOT_LABEL: Record<string, string> = {
  weapon: "Vũ khí",
  armor: "Giáp",
  helmet: "Mũ",
  gloves: "Găng",
  boots: "Giày",
  trinket: "Trang sức",
  shard: "Mảnh Nguyên Tố",
  consumable: "Tiêu hao",
  material: "Nguyên liệu",
};

interface ItemCardProps {
  item: ItemLike;
  footer?: ReactNode;
  onClick?: () => void;
}

export function ItemCard({ item, footer, onClick }: ItemCardProps) {
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
              {item.instance_stats.special ? (
                <div className="item-card__special">{item.instance_stats.special.stat.toUpperCase()} +{item.instance_stats.special.bonus} <small>(tùy biến)</small></div>
              ) : (
                Object.entries(item.instance_stats).map(([k, v]) => (
                  <span key={k} className="item-card__stat">{k}: {JSON.stringify(v)}</span>
                ))
              )}
        </div>
      )}
          {/* Show item-level special metadata (skill/passive) if present */}
          {(item as any).special && (
            <div className="item-card__special-meta">
              {(item as any).special.passive && (
                <div className="item-card__passive">Passive: {Object.entries((item as any).special.passive).map(([k,v])=>`${k}=${v}`).join(', ')}</div>
              )}
              {(item as any).special.skill && (
                <div className="item-card__skill">Kỹ năng: <strong>{(item as any).special.skill.name}</strong> — {(item as any).special.skill.description}</div>
              )}
            </div>
          )}
      {footer && <div className="item-card__footer">{footer}</div>}
    </div>
  );
}
