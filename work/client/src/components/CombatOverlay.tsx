import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PixelSprite } from "./PixelSprite";
import { ShardBar } from "./ShardBar";
import { MONSTER_SPRITES } from "../data/sprites";

interface CombatResult {
  victory: boolean;
  log: string[];
  isBoss?: boolean;
  bossDead?: boolean;
  dailyLimitReached?: boolean;
  attemptsUsed?: number;
  attemptsLimit?: number;
  respawnInSeconds?: number;
  bossHp?: number;
  bossMaxHp?: number;
  rewards?: { exp: number; gold: number; items: string[]; leveledUp: boolean; newLevel: number; contribution?: boolean };
}

interface BossPreview {
  currentHp: number;
  maxHp: number;
  dead: boolean;
  respawnInSeconds: number;
}

import type { MonsterSpriteKey } from "../data/sprites";

interface Props {
  characterId: string;
  monsterId: string;
  monsterName: string;
  spriteKey: MonsterSpriteKey;
  isBoss?: boolean;
  onClose: (victory: boolean) => void;
  onChange: () => void;
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CombatOverlay({ characterId, monsterId, monsterName, spriteKey, isBoss, onClose, onChange }: Props) {
  const [fighting, setFighting] = useState(false);
  const [result, setResult] = useState<CombatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bossPreview, setBossPreview] = useState<BossPreview | null>(null);
  const sprite = MONSTER_SPRITES[spriteKey];

  useEffect(() => {
    if (!isBoss) return;
    api.get(`/combat/boss/${monsterId}`).then((res) => setBossPreview(res.data)).catch(() => {});
  }, [isBoss, monsterId]);

  async function fight() {
    setFighting(true);
    setError(null);
    try {
      const res = await api.post("/combat/explore", { characterId, monsterId });
      setResult(res.data);
      onChange();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Không thể chiến đấu lúc này");
    } finally {
      setFighting(false);
    }
  }

  const bossAlreadyDead = isBoss && bossPreview?.dead && !result;
  const overlayClass = `modal-backdrop${isBoss ? " combat-overlay--boss" : ""}`;

  return (
    <div className={overlayClass} onClick={() => !fighting && onClose(result?.victory ?? false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {isBoss && <div className="boss-banner">👑 BOSS THẾ GIỚI — MÁU KHÔNG HỒI GIỮA CÁC LƯỢT ĐÁNH</div>}

        <div className="modal-card__header">
          <PixelSprite matrix={sprite.matrix} palette={sprite.palette} size={isBoss ? 84 : 56} bob />
          <div>
            <div className="modal-card__title">{monsterName}</div>
            <div className="modal-card__subtitle">
              {isBoss
                ? "Nhiều người có thể cùng cày boss này — sát thương của bạn luôn được lưu lại."
                : "Bạn chạm vào quái — bắt đầu trận đấu?"}
            </div>
          </div>
        </div>

        {isBoss && bossPreview && !result && !bossAlreadyDead && (
          <ShardBar label="Máu Boss (toàn server)" value={bossPreview.currentHp} max={bossPreview.maxHp} colorVar="--rarity-legendary" />
        )}

        {bossAlreadyDead && (
          <div className="respawn-banner">
            💀 {monsterName} đã bị hạ gục và đang hồi sinh. Quay lại sau{" "}
            <strong>{formatCountdown(bossPreview!.respawnInSeconds)}</strong>.
          </div>
        )}

        {!result && !bossAlreadyDead && (
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" disabled={fighting} onClick={fight}>
              {fighting ? "Đang chiến đấu..." : "⚔️ Tấn công"}
            </button>
            <button className="btn-secondary" disabled={fighting} onClick={() => onClose(false)}>
              Bỏ qua
            </button>
          </div>
        )}

        {bossAlreadyDead && (
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => onClose(false)}>
            Quay lại bản đồ
          </button>
        )}

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <div>
            {result.dailyLimitReached ? (
              <div className="error-banner">
                ⏳ Bạn đã dùng hết {result.attemptsLimit}/{result.attemptsLimit} lượt đánh {monsterName} hôm nay. Quay lại
                vào ngày mai!
              </div>
            ) : result.bossDead ? (
              <div className="respawn-banner">
                💀 {monsterName} vừa bị hạ gục bởi người khác ngay trước bạn! Còn{" "}
                {formatCountdown(result.respawnInSeconds ?? 0)} nữa mới hồi sinh.
              </div>
            ) : result.victory ? (
              <div className="success-banner">
                {isBoss ? "🎉 Bạn đã ra đòn kết liễu! " : "Chiến thắng! "}+{result.rewards?.exp} EXP, +{result.rewards?.gold}{" "}
                vàng
                {result.rewards?.items.length ? `, nhận được ${result.rewards.items.length} vật phẩm` : ""}
                {result.rewards?.leveledUp ? ` — Lên cấp ${result.rewards.newLevel}!` : ""}
              </div>
            ) : isBoss && result.rewards?.contribution ? (
              <div className="contribution-banner">
                💪 Bạn đã gây sát thương lên {monsterName} và nhận +{result.rewards.exp} EXP, +{result.rewards.gold} vàng
                đóng góp. Máu boss còn lại sẽ được lưu — hãy rủ thêm người quay lại kết liễu!
              </div>
            ) : (
              <div className="error-banner">Bạn đã thua trận này và phải rút lui.</div>
            )}

            {isBoss && typeof result.bossHp === "number" && !result.victory && !result.bossDead && (
              <ShardBar label="Máu Boss còn lại" value={result.bossHp} max={result.bossMaxHp ?? 1} colorVar="--rarity-legendary" />
            )}

            {isBoss && typeof result.attemptsUsed === "number" && !result.dailyLimitReached && (
              <div className="tag" style={{ marginTop: 8, display: "inline-block" }}>
                Lượt đánh hôm nay: {result.attemptsUsed}/{result.attemptsLimit}
              </div>
            )}

            <div className="combat-log">
              {result.log.map((line, i) => (
                <div className="combat-log__line" key={i}>
                  {line}
                </div>
              ))}
            </div>
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => onClose(result.victory)}>
              Quay lại bản đồ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
