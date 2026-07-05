import { api } from "../../api/client";
import { ShardBar } from "../../components/ShardBar";
import type { CharacterDetail } from "../Dashboard";

const SLOT_ORDER = ["weapon", "armor", "helmet", "gloves", "boots", "trinket", "shard"];
const SLOT_LABEL: Record<string, string> = {
  weapon: "Vũ khí",
  armor: "Giáp",
  helmet: "Mũ",
  gloves: "Găng",
  boots: "Giày",
  trinket: "Trang sức",
  shard: "Mảnh Nguyên Tố",
};

interface Props {
  detail: CharacterDetail;
  onChange: () => void;
}

export function CharacterTab({ detail, onChange }: Props) {
  const { character, equipment, computedStats } = detail;

  async function unequip(slotType: string) {
    await api.post("/inventory/unequip", { characterId: character.id, slotType });
    onChange();
  }

  async function sellEquipped(itemInstanceId: string) {
    try {
      await api.post('/shop/sell', { characterId: character.id, itemInstanceId });
      onChange();
    } catch (err: any) {
      console.error(err);
      onChange();
    }
  }

  const expNeeded = Math.floor(100 * Math.pow(character.level, 1.5));

  return (
    <div>
      <h1 className="page-title">{character.name}</h1>
      <p className="page-subtitle">Người Thức Tỉnh mang trong mình một mảnh vỡ của Lõi Nguyên Tố</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 32 }}>
        <div>
          <ShardBar label="Sinh lực" value={character.hp} max={character.max_hp} colorVar="--elem-fire" />
          <ShardBar label="Pháp lực" value={character.mp} max={character.max_mp} colorVar="--elem-water" />
          <ShardBar label="Kinh nghiệm" value={character.exp} max={expNeeded} colorVar="--accent-shard" />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <div>Sức tấn công (ATK): <span style={{ color: "var(--text-primary)" }}>{computedStats.atk}</span></div>
          <div>Phòng thủ (DEF): <span style={{ color: "var(--text-primary)" }}>{computedStats.def}</span></div>
          <div>Tốc độ (SPD): <span style={{ color: "var(--text-primary)" }}>{computedStats.spd}</span></div>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
