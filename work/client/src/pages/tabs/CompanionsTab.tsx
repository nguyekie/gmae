import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface Companion {
  id: string;
  name: string;
  role: string;
  description: string;
  bonuses: Record<string, number>;
  recruit_cost_gold: number;
  required_items: Array<{ itemTypeId: string; name: string; quantity: number }>;
  owned_id: string | null;
  active: boolean;
}

interface Props {
  characterId: string;
  onChange: () => void;
}

const STAT_LABEL: Record<string, string> = { atk: "ATK", def: "DEF", spd: "SPD", hp: "HP", mp: "MP" };

export function CompanionsTab({ characterId, onChange }: Props) {
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.get(`/companions/${characterId}`).then((res) => setCompanions(res.data.companions));
  }

  useEffect(() => {
    load();
  }, [characterId]);

  async function recruit(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      await api.post("/companions/recruit", { characterId, companionTypeId: id });
      setMessage("Chiêu mộ thành công. Trợ thủ đã đi cùng bạn.");
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể chiêu mộ trợ thủ");
    } finally {
      setBusyId(null);
    }
  }

  async function activate(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      await api.post("/companions/activate", { characterId, companionTypeId: id });
      setMessage("Đã chọn trợ thủ đi cùng.");
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể chọn trợ thủ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Trợ thủ</h1>
      <p className="page-subtitle">Tuyển một trợ thủ đi cùng để nhận chỉ số cộng thêm trong chiến đấu.</p>

      {message && <div className="alert">{message}</div>}

      <div className="zone-grid">
        {companions.map((companion) => {
          const owned = Boolean(companion.owned_id);
          return (
            <div className="zone-card" key={companion.id}>
              <div className="zone-card__name">
                {companion.name} {companion.active && <span className="tag">Đang đi cùng</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--accent-shard)", marginTop: 4 }}>{companion.role}</div>
              <div className="zone-card__desc" style={{ marginTop: 8 }}>{companion.description}</div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(companion.bonuses ?? {}).map(([stat, value]) => (
                  <span className="tag" key={stat}>{STAT_LABEL[stat] ?? stat.toUpperCase()} +{value}</span>
                ))}
              </div>
              {!owned && (
                <div className="zone-card__desc" style={{ marginTop: 10 }}>
                  Cần {companion.recruit_cost_gold.toLocaleString("vi-VN")} vàng
                  {companion.required_items?.map((item) => ` · ${item.name} x${item.quantity}`).join("")}
                </div>
              )}
              <button
                className={owned ? "btn-secondary" : "btn-primary"}
                style={{ marginTop: 14 }}
                disabled={companion.active || busyId === companion.id}
                onClick={() => (owned ? activate(companion.id) : recruit(companion.id))}
              >
                {companion.active ? "Đang đi cùng" : owned ? "Cho đi cùng" : "Chiêu mộ"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
