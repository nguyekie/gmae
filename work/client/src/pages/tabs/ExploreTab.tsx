import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { MapExplorer } from "../../components/MapExplorer";
import { ZONES } from "../../data/mapData";

interface Props {
  characterId: string;
  characterName: string;
  characterClass: "warrior" | "mage" | "archer";
  characterLevel: number;
  appearance?: string;
  onChange: () => void;
}

interface AutoFarmOption {
  id: string;
  name: string;
  zone: string;
  level: number;
  exp_reward: number;
  gold_min: number;
  gold_max: number;
}

interface AutoFarmActive {
  monsterId: string;
  monsterName: string;
  monsterLevel: number;
  zone: string;
  startedAt: string;
  pendingCycles: number;
  maxClaimHours: number;
}

export function ExploreTab({ characterId, characterName, characterClass, characterLevel, appearance, onChange }: Props) {
  const [zoneId, setZoneId] = useState("starting_village");
  const [spawn, setSpawn] = useState(ZONES["starting_village"].defaultSpawn);
  const [farmOptions, setFarmOptions] = useState<AutoFarmOption[]>([]);
  const [activeFarm, setActiveFarm] = useState<AutoFarmActive | null>(null);
  const [selectedFarmMonsterId, setSelectedFarmMonsterId] = useState("");
  const [farmLoading, setFarmLoading] = useState(false);
  const [farmMessage, setFarmMessage] = useState<string | null>(null);

  const refreshAutoFarm = useCallback(() => {
    api
      .get(`/auto-farm/${characterId}`)
      .then((res) => {
        const options = res.data.options ?? [];
        setFarmOptions(options);
        setActiveFarm(res.data.active ?? null);
        setSelectedFarmMonsterId((current) => current || options[0]?.id || "");
      })
      .catch(() => {
        setFarmOptions([]);
        setActiveFarm(null);
      });
  }, [characterId]);

  useEffect(() => {
    refreshAutoFarm();
    const interval = window.setInterval(refreshAutoFarm, 30000);
    return () => window.clearInterval(interval);
  }, [refreshAutoFarm]);

  function handlePortal(toZone: string, x: number, y: number) {
    setZoneId(toZone);
    setSpawn({ x, y });
  }

  const zone = ZONES[zoneId];

  async function startAutoFarm() {
    if (!selectedFarmMonsterId) return;
    setFarmLoading(true);
    setFarmMessage(null);
    try {
      const res = await api.post("/auto-farm/start", { characterId, monsterId: selectedFarmMonsterId });
      setFarmMessage(`Đã bắt đầu treo ${res.data.monsterName}`);
      refreshAutoFarm();
    } catch (err: any) {
      setFarmMessage(err.response?.data?.error ?? "Không thể bắt đầu treo quái");
    } finally {
      setFarmLoading(false);
    }
  }

  async function claimAutoFarm() {
    setFarmLoading(true);
    setFarmMessage(null);
    try {
      const res = await api.post("/auto-farm/claim", { characterId });
      const rewards = res.data.rewards;
      setFarmMessage(
        rewards.cycles > 0
          ? `Nhận ${rewards.cycles} lượt: +${rewards.exp} EXP, +${rewards.gold} vàng, +${rewards.potential} tiềm năng, ${rewards.items.length} vật phẩm`
          : "Chưa đủ 1 phút để nhận lượt treo mới"
      );
      refreshAutoFarm();
      onChange();
    } catch (err: any) {
      setFarmMessage(err.response?.data?.error ?? "Không thể nhận thưởng treo quái");
    } finally {
      setFarmLoading(false);
    }
  }

  async function stopAutoFarm() {
    setFarmLoading(true);
    setFarmMessage(null);
    try {
      await api.post("/auto-farm/stop", { characterId });
      setFarmMessage("Đã dừng treo quái");
      refreshAutoFarm();
    } catch (err: any) {
      setFarmMessage(err.response?.data?.error ?? "Không thể dừng treo quái");
    } finally {
      setFarmLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Khám phá Etheria</h1>
      <p className="page-subtitle">
        Dùng phím mũi tên (hoặc WASD) để di chuyển · chạm quái để vào trận · đứng cạnh NPC rồi nhấn Enter để nói chuyện
        · bước vào ô cổng phát sáng để sang vùng khác
      </p>

      <div className="zone-card" style={{ marginBottom: 16 }}>
        <div className="zone-card__name">Treo quái</div>
        <div className="zone-card__desc">
          Mỗi phút tính 1 lượt hạ quái thường, tối đa tích lũy {activeFarm?.maxClaimHours ?? 8} giờ. Boss thế giới không thể treo.
        </div>
        {activeFarm ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <span className="tag">
              Đang treo: {activeFarm.monsterName} cấp {activeFarm.monsterLevel}
            </span>
            <span className="tag">Lượt chờ nhận: {activeFarm.pendingCycles}</span>
            <button className="small-btn" disabled={farmLoading} onClick={claimAutoFarm}>
              Nhận thưởng
            </button>
            <button className="small-btn small-btn--danger" disabled={farmLoading} onClick={stopAutoFarm}>
              Dừng
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <select className="input" value={selectedFarmMonsterId} onChange={(e) => setSelectedFarmMonsterId(e.target.value)}>
              {farmOptions.map((monster) => (
                <option key={monster.id} value={monster.id}>
                  {monster.name} · cấp {monster.level} · {monster.exp_reward} EXP
                </option>
              ))}
            </select>
            <button className="small-btn" disabled={farmLoading || !selectedFarmMonsterId} onClick={startAutoFarm}>
              Bắt đầu treo
            </button>
          </div>
        )}
        {farmMessage && (
          <div className="zone-card__desc" style={{ marginTop: 10 }}>
            {farmMessage}
          </div>
        )}
      </div>

      <MapExplorer
        key={zoneId}
        zoneId={zoneId}
        spawnPoint={spawn}
        characterId={characterId}
        characterName={characterName}
        characterClass={characterClass}
        characterLevel={characterLevel}
        appearance={appearance}
        onChange={onChange}
        onPortal={handlePortal}
      />

      <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-faint)" }}>
        Đang ở: {zone.name}
      </p>
    </div>
  );
}
