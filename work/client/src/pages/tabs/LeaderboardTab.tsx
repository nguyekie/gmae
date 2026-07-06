import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface LeaderboardEntry {
  id: string;
  name: string;
  class: "warrior" | "mage" | "archer";
  level: number;
  powerScore: number;
  computedStats: { atk: number; def: number; spd: number; maxHp: number; maxMp: number };
}

const CLASS_LABEL: Record<string, string> = {
  warrior: "Chiến Binh",
  mage: "Pháp Sư",
  archer: "Xạ Thủ",
};

export function LeaderboardTab({ currentCharacterId }: { currentCharacterId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/characters/leaderboard/power")
      .then((res) => setEntries(res.data.leaderboard ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">BXH lực chiến</h1>
      <p className="page-subtitle">Xếp hạng theo cấp, chỉ số trang bị và trợ thủ đang đi cùng.</p>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Đang tải...</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Chưa có nhân vật nào trên bảng xếp hạng.</p>
      ) : (
        <div className="leaderboard">
          {entries.map((entry, index) => (
            <div className={`leaderboard-row ${entry.id === currentCharacterId ? "leaderboard-row--self" : ""}`} key={entry.id}>
              <div className="leaderboard-row__rank">#{index + 1}</div>
              <div className="leaderboard-row__main">
                <div className="leaderboard-row__name">{entry.name}</div>
                <div className="leaderboard-row__meta">
                  {CLASS_LABEL[entry.class]} · Cấp {entry.level}
                </div>
              </div>
              <div className="leaderboard-row__stats">
                ATK {entry.computedStats.atk} · DEF {entry.computedStats.def} · SPD {entry.computedStats.spd}
              </div>
              <div className="leaderboard-row__power">{entry.powerScore.toLocaleString("vi-VN")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
