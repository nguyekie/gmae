import { PixelSprite } from "./PixelSprite";
import { ShardBar } from "./ShardBar";
import { HUMANOID, PLAYER_PALETTES } from "../data/sprites";

interface Fighter {
  name: string;
  class: string;
  finalHp: number;
  maxHp: number;
}

export interface PvpResultData {
  matchId: string;
  victory: boolean;
  log: string[];
  self: Fighter;
  opponent: Fighter;
}

interface Props {
  result: PvpResultData;
  onClose: () => void;
}

export function PvpBattleOverlay({ result, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-card__header">
          <div>
            <div className="modal-card__title">⚔️ Đấu Trường PvP</div>
            <div className="modal-card__subtitle">Trận giao hữu — không mất vật phẩm hay vàng</div>
          </div>
        </div>

        <div className="pvp-vs">
          <div className="pvp-vs__side">
            <PixelSprite matrix={HUMANOID} palette={PLAYER_PALETTES[result.self.class] ?? PLAYER_PALETTES.warrior} size={56} />
            <div className="pvp-vs__name">{result.self.name}</div>
            <ShardBar label="HP" value={result.self.finalHp} max={result.self.maxHp} colorVar="--elem-fire" />
          </div>
          <div className="pvp-vs__badge">VS</div>
          <div className="pvp-vs__side">
            <PixelSprite matrix={HUMANOID} palette={PLAYER_PALETTES[result.opponent.class] ?? PLAYER_PALETTES.warrior} size={56} flip />
            <div className="pvp-vs__name">{result.opponent.name}</div>
            <ShardBar label="HP" value={result.opponent.finalHp} max={result.opponent.maxHp} colorVar="--elem-fire" />
          </div>
        </div>

        {result.victory ? (
          <div className="success-banner">Bạn đã chiến thắng {result.opponent.name}!</div>
        ) : (
          <div className="error-banner">Bạn đã thua trước {result.opponent.name}. Rèn luyện thêm rồi thách đấu lại nhé!</div>
        )}

        <div className="combat-log">
          {result.log.map((line, i) => (
            <div className="combat-log__line" key={i}>
              {line}
            </div>
          ))}
        </div>

        <button className="btn-primary" style={{ marginTop: 14 }} onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
