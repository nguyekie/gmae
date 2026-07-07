import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { ShardBar } from "../../components/ShardBar";

interface TaskReward {
  gold: number;
  potential: number;
  items: string[];
}

interface TaskEntry {
  id: string;
  period: "daily" | "weekly";
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewards: TaskReward;
}

const PERIOD_LABEL = {
  daily: "Hằng ngày",
  weekly: "Hằng tuần",
};

const ITEM_LABEL: Record<string, string> = {
  charm_double_potential: "Bùa x2 tiềm năng",
  charm_double_drop: "Bùa x2 rơi đồ",
  charm_double_gold: "Bùa x2 vàng",
  rift_core: "Tinh Hoa Rạn Nứt",
  abyssal_dust: "Bụi Hư Không",
  tempered_rift_core: "Lõi Rạn Tôi Luyện",
  oath_sigil: "Ấn Lời Thề",
};

interface Props {
  characterId: string;
  onChange: () => void;
}

export function DailyTasksTab({ characterId, onChange }: Props) {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get(`/daily-tasks/${characterId}`).then((res) => setTasks(res.data.tasks ?? []));
  }, [characterId]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(taskId: string) {
    setBusyId(taskId);
    setMessage(null);
    try {
      await api.post("/daily-tasks/claim", { characterId, taskId });
      setMessage("Đã nhận thưởng nhiệm vụ.");
      load();
      onChange();
    } catch (err: any) {
      setMessage(err.response?.data?.error ?? "Không thể nhận thưởng");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Nhiệm vụ ngày / tuần</h1>
      <p className="page-subtitle">Hoàn thành các mục tiêu lặp lại để nhận vàng, tiềm năng, bùa và nguyên liệu hiếm.</p>

      {message && (
        <div className="zone-card" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {tasks.map((task) => {
          const rewardText = [
            `${task.rewards.gold.toLocaleString("vi-VN")} vàng`,
            `${task.rewards.potential.toLocaleString("vi-VN")} tiềm năng`,
            ...task.rewards.items.map((itemId) => ITEM_LABEL[itemId] ?? itemId),
          ].join(" · ");

          return (
            <div className="zone-card" key={task.id}>
              <div className="zone-card__name">
                {task.title} <span className="tag">{PERIOD_LABEL[task.period]}</span>
              </div>
              <div className="zone-card__desc" style={{ marginTop: 8 }}>
                {task.description}
              </div>
              <div style={{ marginTop: 12 }}>
                <ShardBar label="Tiến độ" value={Math.min(task.progress, task.target)} max={task.target} colorVar="--accent-shard" />
              </div>
              <div className="zone-card__desc" style={{ marginTop: 8 }}>
                Thưởng: {rewardText}
              </div>
              <button
                className="small-btn"
                style={{ marginTop: 12 }}
                disabled={!task.completed || task.claimed || busyId === task.id}
                onClick={() => claim(task.id)}
              >
                {task.claimed ? "Đã nhận" : busyId === task.id ? "Đang nhận..." : "Nhận thưởng"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
