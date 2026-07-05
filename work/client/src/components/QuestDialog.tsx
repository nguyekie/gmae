import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PixelSprite } from "./PixelSprite";
import { NPC_SPRITES } from "../data/sprites";

interface QuestObjective {
  type: string;
  targetId: string;
  count: number;
  label: string;
  current: number;
  done: boolean;
}

interface QuestState {
  id: string;
  title: string;
  levelRequirement: number;
  state: "locked" | "not_started" | "active" | "ready_to_turn_in" | "completed";
  dialogue: string;
  objectives: QuestObjective[];
  rewards: { exp: number; gold: number; items: string[] };
}

interface Props {
  characterId: string;
  npcId: string;
  npcName: string;
  spriteKey: "elder" | "hunter" | "scholar" | "tablet" | "wanderer";
  onClose: () => void;
  onChange: () => void;
}

const STATE_LABEL: Record<QuestState["state"], string> = {
  locked: "Chưa đủ điều kiện",
  not_started: "Nhiệm vụ mới",
  active: "Đang thực hiện",
  ready_to_turn_in: "Sẵn sàng trả nhiệm vụ",
  completed: "Đã hoàn thành",
};

export function QuestDialog({ characterId, npcId, npcName, spriteKey, onClose, onChange }: Props) {
  const [quests, setQuests] = useState<QuestState[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);
  const sprite = NPC_SPRITES[spriteKey];

  function load() {
    api.get(`/quests/npc/${npcId}`, { params: { characterId } }).then((res) => setQuests(res.data.quests));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcId, characterId]);

  async function accept(questId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post("/quests/accept", { characterId, questId });
      load();
      onChange();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Không thể nhận nhiệm vụ");
    } finally {
      setBusy(false);
    }
  }

  async function turnIn(questId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post("/quests/turn-in", { characterId, questId });
      const r = res.data.rewards;
      setRewardMsg(
        `Nhận thưởng: +${r.exp} EXP, +${r.gold} vàng${r.items.length ? `, ${r.items.length} vật phẩm` : ""}${
          r.leveledUp ? ` — Lên cấp ${r.newLevel}!` : ""
        }`
      );
      load();
      onChange();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Không thể trả nhiệm vụ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <PixelSprite matrix={sprite.matrix} palette={sprite.palette} size={56} />
          <div>
            <div className="modal-card__title">{npcName}</div>
            <div className="modal-card__subtitle">Nhấn ra ngoài để đóng</div>
          </div>
        </div>

        {!quests && <p style={{ color: "var(--text-muted)" }}>Đang tải...</p>}

        {quests?.length === 0 && <p style={{ color: "var(--text-muted)" }}>Không có gì để nói lúc này.</p>}

        {quests?.map((q) => (
          <div className="quest-block" key={q.id}>
            <div className="quest-block__title-row">
              <span className="quest-block__title">{q.title}</span>
              <span className="tag">{STATE_LABEL[q.state]}</span>
            </div>
            <div className="quest-block__dialogue">&ldquo;{q.dialogue}&rdquo;</div>

            {q.state === "locked" && (
              <div className="quest-block__hint">Cần đạt cấp {q.levelRequirement} để nhận nhiệm vụ này.</div>
            )}

            {q.state !== "locked" && q.state !== "completed" && (
              <div className="quest-block__objectives">
                {q.objectives.map((o) => (
                  <div className="quest-block__objective" key={o.targetId}>
                    <span>{o.label}</span>
                    <span className={o.done ? "quest-block__objective-count--done" : "quest-block__objective-count"}>
                      {o.current}/{o.count}
                    </span>
                  </div>
                ))}
                <div className="quest-block__rewards">
                  🎁 Thưởng: {q.rewards.exp} EXP · {q.rewards.gold} vàng
                  {q.rewards.items.length ? ` · ${q.rewards.items.length} vật phẩm` : ""}
                </div>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              {q.state === "not_started" && (
                <button className="small-btn" disabled={busy} onClick={() => accept(q.id)}>
                  Nhận nhiệm vụ
                </button>
              )}
              {q.state === "active" && (
                <button className="small-btn" disabled>
                  Chưa hoàn thành mục tiêu
                </button>
              )}
              {q.state === "ready_to_turn_in" && (
                <button className="small-btn" disabled={busy} onClick={() => turnIn(q.id)}>
                  Hoàn thành nhiệm vụ
                </button>
              )}
            </div>
          </div>
        ))}

        {error && <div className="error-banner">{error}</div>}
        {rewardMsg && <div className="success-banner">{rewardMsg}</div>}

        <button className="btn-secondary" style={{ marginTop: 16 }} onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
