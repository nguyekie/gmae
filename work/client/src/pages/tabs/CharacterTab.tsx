import { useState } from "react";
import { api } from "../../api/client";
import { ShardBar } from "../../components/ShardBar";
import type { CharacterDetail } from "../Dashboard";

const SLOT_ORDER = ["weapon", "armor", "helmet", "gloves", "boots", "trinket", "shard", "costume"];
const SLOT_LABEL: Record<string, string> = {
  weapon: "Vũ khí",
  armor: "Giáp",
  helmet: "Mũ",
  gloves: "Găng",
  boots: "Giày",
  trinket: "Trang sức",
  shard: "Mảnh Nguyên Tố",
  costume: "Cải trang",
};

const POTENTIAL_BRANCHES = [
  {
    id: "strength",
    name: "Sức mạnh",
    desc: "Tăng ATK",
    bonus: (detail: CharacterDetail) => `ATK +${detail.potentialBonus?.stats.atk ?? 0}`,
  },
  {
    id: "vitality",
    name: "Thể chất",
    desc: "Tăng HP và DEF",
    bonus: (detail: CharacterDetail) => `HP +${detail.potentialBonus?.stats.hp ?? 0} · DEF +${detail.potentialBonus?.stats.def ?? 0}`,
  },
  {
    id: "agility",
    name: "Nhanh nhẹn",
    desc: "Tăng SPD và tỉ lệ né",
    bonus: (detail: CharacterDetail) =>
      `SPD +${detail.potentialBonus?.stats.spd ?? 0} · Né ${((detail.potentialBonus?.combat.dodgeRate ?? 0) * 100).toFixed(1)}%`,
  },
  {
    id: "luck",
    name: "May mắn",
    desc: "Tăng rơi đồ, vàng và cơ hội SSS+",
    bonus: (detail: CharacterDetail) =>
      `Rơi đồ +${((detail.potentialBonus?.combat.dropRate ?? 0) * 100).toFixed(1)}% · Vàng +${((detail.potentialBonus?.combat.goldGain ?? 0) * 100).toFixed(0)}% · SSS+ +${((detail.potentialBonus?.combat.sssPlusDropRate ?? 0) * 100).toFixed(2)}%`,
  },
] as const;

interface Props {
  detail: CharacterDetail;
  onChange: () => void;
}

export function CharacterTab({ detail, onChange }: Props) {
  const { character, equipment, computedStats } = detail;
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const companionBonus = detail.companionBonus ?? { atk: 0, def: 0, spd: 0, hp: 0, mp: 0 };
  const potentialBonus = detail.potentialBonus ?? {
    levels: {
      strength: character.potential_strength ?? 0,
      vitality: character.potential_vitality ?? 0,
      agility: character.potential_agility ?? 0,
      luck: character.potential_luck ?? 0,
    },
    stats: { atk: 0, def: 0, spd: 0, hp: 0, mp: 0 },
    combat: { dodgeRate: 0, dropRate: 0, goldGain: 0, sssPlusDropRate: 0 },
    breakthroughs: {
      strengthTier: 0,
      vitalityTier: 0,
      agilityTier: 0,
      luckTier: 0,
      skillDamageBonus: 0,
      damageReduction: 0,
      perfectDodgeRate: 0,
      counterRate: 0,
      extraDropRolls: 0,
    },
    nextCosts: { strength: 120, vitality: 120, agility: 120, luck: 120 },
  };
  const companionEntries = Object.entries(companionBonus).filter(([, value]) => value > 0);
  const bonusMp = Math.max(0, computedStats.maxMp - character.max_mp);
  const currentHp = Math.min(computedStats.maxHp, character.hp);
  const effectiveMp = Math.min(computedStats.maxMp, character.mp + bonusMp);
  const expNeeded = Math.floor(100 * Math.pow(character.level, 1.5));
  const breakthroughSummary = [
    potentialBonus.breakthroughs.skillDamageBonus > 0
      ? `Kỹ năng +${(potentialBonus.breakthroughs.skillDamageBonus * 100).toFixed(0)}% sát thương`
      : null,
    potentialBonus.breakthroughs.damageReduction > 0
      ? `Giảm ${(potentialBonus.breakthroughs.damageReduction * 100).toFixed(0)}% sát thương nhận`
      : null,
    potentialBonus.breakthroughs.perfectDodgeRate > 0
      ? `Né hoàn hảo +${(potentialBonus.breakthroughs.perfectDodgeRate * 100).toFixed(0)}%`
      : null,
    potentialBonus.breakthroughs.counterRate > 0
      ? `Phản đòn +${(potentialBonus.breakthroughs.counterRate * 100).toFixed(0)}%`
      : null,
    potentialBonus.breakthroughs.extraDropRolls > 0 ? `Roll drop phụ +${potentialBonus.breakthroughs.extraDropRolls}` : null,
  ].filter(Boolean);

  async function unequip(slotType: string) {
    await api.post("/inventory/unequip", { characterId: character.id, slotType });
    onChange();
  }

  async function sellEquipped(itemInstanceId: string) {
    try {
      await api.post("/shops/sell", { characterId: character.id, itemInstanceId });
      onChange();
    } catch (err) {
      console.error(err);
      onChange();
    }
  }

  async function upgradePotential(branch: string) {
    setUpgrading(branch);
    setUpgradeError(null);
    try {
      await api.post(`/characters/${character.id}/potential`, { branch });
      onChange();
    } catch (err: any) {
      setUpgradeError(err.response?.data?.error ?? "Không thể nâng tiềm năng");
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">{character.name}</h1>
      <div className="zone-card__desc" style={{ marginBottom: 10 }}>
        Mốc đột phá: {breakthroughSummary.length ? breakthroughSummary.join(" · ") : "Chưa có, mỗi 10 cấp tiềm năng sẽ mở hiệu ứng mới."}
      </div>
      <p className="page-subtitle">Người Thức Tỉnh mang trong mình một mảnh vỡ của Lõi Nguyên Tố</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 32 }}>
        <div>
          <ShardBar label="Sinh lực" value={currentHp} max={computedStats.maxHp} colorVar="--elem-fire" />
          <ShardBar label="Pháp lực" value={effectiveMp} max={computedStats.maxMp} colorVar="--elem-water" />
          <ShardBar label="Kinh nghiệm" value={character.exp} max={expNeeded} colorVar="--accent-shard" />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <div>ATK: <span style={{ color: "var(--text-primary)" }}>{computedStats.atk}</span></div>
          <div>DEF: <span style={{ color: "var(--text-primary)" }}>{computedStats.def}</span></div>
          <div>SPD: <span style={{ color: "var(--text-primary)" }}>{computedStats.spd}</span></div>
          <div>HP tối đa: <span style={{ color: "var(--text-primary)" }}>{computedStats.maxHp}</span></div>
          <div>MP tối đa: <span style={{ color: "var(--text-primary)" }}>{computedStats.maxMp}</span></div>
          <div>Lực chiến: <span style={{ color: "var(--accent-shard)" }}>{detail.powerScore.toLocaleString("vi-VN")}</span></div>
          <div>Tiềm năng: <span style={{ color: "var(--accent-shard)" }}>{Number(character.potential ?? 0).toLocaleString("vi-VN")}</span></div>
        </div>
      </div>

      <div className="zone-card" style={{ marginBottom: 24 }}>
        <div className="zone-card__name">Bảng nâng tiềm năng</div>
        <div className="zone-card__desc">
          Điểm còn lại: <strong style={{ color: "var(--accent-shard)" }}>{Number(character.potential ?? 0).toLocaleString("vi-VN")}</strong>
        </div>
        {upgradeError && <div className="zone-card__desc" style={{ marginTop: 10, color: "var(--elem-fire)" }}>{upgradeError}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
          {POTENTIAL_BRANCHES.map((branch) => {
            const level = potentialBonus.levels[branch.id];
            const cost = potentialBonus.nextCosts[branch.id];
            const canUpgrade = Number(character.potential ?? 0) >= cost;
            return (
              <div className="equip-slot" key={branch.id}>
                <div className="equip-slot__label">{branch.name} · Cấp {level}</div>
                <div className="equip-slot__item" style={{ marginTop: 6 }}>{branch.bonus(detail)}</div>
                <div className="equip-slot__empty" style={{ marginTop: 6 }}>{branch.desc}</div>
                <button
                  className="small-btn"
                  style={{ marginTop: 10 }}
                  disabled={!canUpgrade || upgrading === branch.id}
                  onClick={() => upgradePotential(branch.id)}
                >
                  {upgrading === branch.id ? "Đang nâng..." : `Nâng (${cost.toLocaleString("vi-VN")})`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="zone-card" style={{ marginBottom: 24 }}>
        <div className="zone-card__name">Tiềm năng chiến đấu</div>
        <div className="zone-card__desc">
          Đánh quái và boss để nhận tiềm năng. Mua bùa trong cửa hàng để x2 tiềm năng, x2 vàng hoặc x2 tỷ lệ rơi đồ trong thời gian buff.
        </div>
      </div>

      <div className="zone-card" style={{ marginBottom: 24 }}>
        <div className="zone-card__name">Trợ thủ đi cùng</div>
        <div className="zone-card__desc">
          {companionEntries.length === 0
            ? "Chưa có trợ thủ đang đi cùng hoặc trợ thủ chưa cộng chỉ số."
            : companionEntries.map(([stat, value]) => `${stat.toUpperCase()} +${value}`).join(" · ")}
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 14, color: "var(--text-muted)" }}>Trang bị đang mặc</h2>
      <div className="equip-grid">
        {SLOT_ORDER.map((slot) => {
          const eq = equipment.find((e) => e.slot_type === slot);
          return (
            <div className="equip-slot" key={slot}>
              <div className="equip-slot__label">{SLOT_LABEL[slot]}</div>
              {eq?.item_instance_id ? (
                <>
                  <div className="equip-slot__item">{eq.name}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="small-btn small-btn--danger" style={{ alignSelf: "flex-start" }} onClick={() => unequip(slot)}>
                      Gỡ ra
                    </button>
                    <button className="small-btn" onClick={() => sellEquipped(eq.item_instance_id!)}>
                      Bán cho cửa hàng
                    </button>
                  </div>
                </>
              ) : (
                <div className="equip-slot__empty">Trống</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
