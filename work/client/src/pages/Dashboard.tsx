import { useEffect, useState, useCallback } from "react";
import { Routes, Route, useNavigate, useParams, NavLink } from "react-router-dom";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuthStore } from "../store/authStore";
import { CharacterTab } from "./tabs/CharacterTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { MarketplaceTab } from "./tabs/MarketplaceTab";
import { ExploreTab } from "./tabs/ExploreTab";
import { StoryTab } from "./tabs/StoryTab";
import { FriendsTab } from "./tabs/FriendsTab";
import { ChatTab } from "./tabs/ChatTab";
import { ShopTab } from "./tabs/ShopTab";
import { CraftingTab } from "./tabs/CraftingTab";
import { CompanionsTab } from "./tabs/CompanionsTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { DailyTasksTab } from "./tabs/DailyTasksTab";
import { ShardBar } from "../components/ShardBar";
import { PixelSprite } from "../components/PixelSprite";
import { PvpBattleOverlay, type PvpResultData } from "../components/PvpBattleOverlay";
import { HUMANOID, PLAYER_PALETTES } from "../data/sprites";

const CLASS_LABEL: Record<string, string> = { warrior: "Chiến Binh", mage: "Pháp Sư", archer: "Xạ Thủ" };
const APPEARANCE_PALETTES: Record<string, Record<string, string>> = {
  fortune_fox: { H: "#f5d7a1", S: "#e3b389", E: "#1a1a1a", B: "#d88f45", L: "#7a4a22" },
  void_child: { H: "#1c1f2b", S: "#c9a877", E: "#c17ee9", B: "#2e1f3c", L: "#17121f" },
  shard_king: { H: "#c9a24b", S: "#e3b389", E: "#1a1a1a", B: "#5fb6d9", L: "#1d3b5f" },
};

export interface CharacterDetail {
  character: {
    id: string;
    name: string;
    class: string;
    level: number;
    exp: number;
    hp: number;
    max_hp: number;
    mp: number;
    max_mp: number;
    gold: number;
    potential: number;
    potential_strength: number;
    potential_vitality: number;
    potential_agility: number;
    potential_luck: number;
    base_atk: number;
    base_def: number;
    base_spd: number;
  };
  equipment: Array<{ slot_type: string; item_instance_id: string | null; name: string | null; rarity: string | null; base_stats: Record<string, number> | null; level_requirement?: number | null; special?: any }>;
  companionBonus: { atk: number; def: number; spd: number; hp: number; mp: number };
  potentialBonus?: {
    levels: { strength: number; vitality: number; agility: number; luck: number };
    stats: { atk: number; def: number; spd: number; hp: number; mp: number };
    combat: { dodgeRate: number; dropRate: number; goldGain: number; sssPlusDropRate: number };
    breakthroughs: {
      strengthTier: number;
      vitalityTier: number;
      agilityTier: number;
      luckTier: number;
      skillDamageBonus: number;
      damageReduction: number;
      perfectDodgeRate: number;
      counterRate: number;
      extraDropRolls: number;
    };
    nextCosts: { strength: number; vitality: number; agility: number; luck: number };
  };
  specialBonus?: { dropRate: number; exp: number; power: number; potentialPerHour: number };
  powerScore: number;
  computedStats: { atk: number; def: number; spd: number; maxHp: number; maxMp: number };
}

interface IncomingChallenge {
  challengeId: string;
  fromCharacterId: string;
  fromCharacterName: string;
  fromCharacterLevel: number;
}

interface Toast {
  id: string;
  message: string;
  tone: "info" | "error";
}

export function Dashboard() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [pvpResult, setPvpResult] = useState<PvpResultData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function pushToast(message: string, tone: "info" | "error" = "info") {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }

  const refresh = useCallback(() => {
    if (!characterId) return;
    api.get(`/characters/${characterId}`).then((res) => setDetail(res.data));
  }, [characterId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!characterId || !detail) return;
    const token = localStorage.getItem('etheria_token');
    if (!token) return;
    import("../api/socket").then(({ connectSocket }) => {
      connectSocket(token, characterId);
    });
  }, [characterId, detail]);

  // Lắng nghe sự kiện PvP ở cấp toàn ứng dụng — hoạt động dù đang ở tab nào
  useEffect(() => {
    if (!characterId) return;
    const socket = getSocket(characterId);
    if (!socket) return;

    function onChallenged(c: IncomingChallenge) {
      setIncomingChallenge(c);
    }
    function onChallengeSent({ targetCharacterName }: { targetCharacterName: string }) {
      pushToast(`Đã gửi lời thách đấu tới ${targetCharacterName}`);
    }
    function onDeclined({ byName }: { byName: string }) {
      pushToast(`${byName} đã từ chối lời thách đấu`);
    }
    function onResult(data: PvpResultData) {
      setPvpResult(data);
      refresh();
    }
    function onPvpError(msg: string) {
      pushToast(msg, "error");
    }

    function onBossDefeated({ monsterName, byCharacterName }: { monsterName: string; byCharacterName: string }) {
      pushToast(`👑 ${byCharacterName} vừa hạ gục ${monsterName}! Boss sẽ hồi sinh sau ít phút.`);
    }

    socket.on("pvp:challenged", onChallenged);
    socket.on("pvp:challenge_sent", onChallengeSent);
    socket.on("pvp:declined", onDeclined);
    socket.on("pvp:result", onResult);
    socket.on("pvp:error", onPvpError);
    socket.on("world:boss_defeated", onBossDefeated);
    return () => {
      socket.off("pvp:challenged", onChallenged);
      socket.off("pvp:challenge_sent", onChallengeSent);
      socket.off("pvp:declined", onDeclined);
      socket.off("pvp:result", onResult);
      socket.off("pvp:error", onPvpError);
      socket.off("world:boss_defeated", onBossDefeated);
    };
  }, [characterId, refresh]);

  function respondChallenge(accept: boolean) {
    if (!incomingChallenge || !characterId) return;
    const socket = getSocket(characterId);
    socket?.emit("pvp:respond", { challengeId: incomingChallenge.challengeId, accept });
    setIncomingChallenge(null);
  }

  if (!detail) {
    return (
      <div className="auth-screen">
        <p style={{ color: "var(--text-muted)" }}>Đang tải nhân vật...</p>
      </div>
    );
  }

  const { character, computedStats } = detail;
  const appearance = detail.equipment.find((e) => e.slot_type === "costume")?.special?.appearance as string | undefined;
  const characterPalette = (appearance && APPEARANCE_PALETTES[appearance]) || PLAYER_PALETTES[character.class];
  const bonusMp = Math.max(0, computedStats.maxMp - character.max_mp);
  const currentHp = Math.min(computedStats.maxHp, character.hp);
  const effectiveMp = Math.min(computedStats.maxMp, character.mp + bonusMp);

  return (
    <div className="app-shell">
      <button className="mobile-menu-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="Mở menu">
        ☰ Menu
      </button>
      <div className={`sidebar-backdrop ${sidebarOpen ? "sidebar-backdrop--open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">Tàn Tích Etheria</div>

        <div className="sidebar__char">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PixelSprite matrix={HUMANOID} palette={characterPalette} size={56} bob />
            <div>
              <div className="sidebar__char-name">{character.name}</div>
              <div className="sidebar__char-meta">
                {CLASS_LABEL[character.class]} · Cấp {character.level}
              </div>
            </div>
          </div>
          <ShardBar label="HP" value={currentHp} max={computedStats.maxHp} colorVar="--elem-fire" />
          <ShardBar label="MP" value={effectiveMp} max={computedStats.maxMp} colorVar="--elem-water" />
          <div className="sidebar__gold">💰 {character.gold.toLocaleString("vi-VN")} vàng</div>
        </div>

        <nav className="nav-list" onClick={() => setSidebarOpen(false)}>
          <NavLink to={`/play/${characterId}`} end className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            🧍 Nhân vật
          </NavLink>
          <NavLink to={`/play/${characterId}/inventory`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            🎒 Túi đồ
          </NavLink>
          <NavLink to={`/play/${characterId}/marketplace`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            🏪 Chợ giao dịch
          </NavLink>
          <NavLink to={`/play/${characterId}/explore`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            ⚔️ Khám phá
          </NavLink>
          <NavLink to={`/play/${characterId}/daily-tasks`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            Nhiệm vụ ngày
          </NavLink>
          <NavLink to={`/play/${characterId}/friends`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            👥 Bạn bè
          </NavLink>
          <NavLink to={`/play/${characterId}/chat`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            💬 Chat
          </NavLink>
          <NavLink to={`/play/${characterId}/shop`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            🏬 Cửa hàng
          </NavLink>
          <NavLink to={`/play/${characterId}/crafting`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            ⚒ Rèn đồ
          </NavLink>
          <NavLink to={`/play/${characterId}/companions`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            🛡 Trợ thủ
          </NavLink>
          <NavLink to={`/play/${characterId}/leaderboard`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            BXH lực chiến
          </NavLink>
          <NavLink to={`/play/${characterId}/story`} className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}>
            📜 Cốt truyện
          </NavLink>
        </nav>

        <div className="sidebar__logout">
          <button className="btn-secondary" onClick={() => navigate("/characters")}>
            Đổi nhân vật
          </button>
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route index element={<CharacterTab detail={detail} onChange={refresh} />} />
          <Route path="inventory" element={<InventoryTab characterId={characterId!} onChange={refresh} />} />
          <Route path="marketplace" element={<MarketplaceTab characterId={characterId!} gold={character.gold} onChange={refresh} />} />
          <Route
            path="explore"
            element={
              <ExploreTab
                characterId={characterId!}
                characterName={character.name}
                characterClass={character.class as "warrior" | "mage" | "archer"}
                characterLevel={character.level}
                appearance={appearance}
                onChange={refresh}
              />
            }
          />
          <Route path="daily-tasks" element={<DailyTasksTab characterId={characterId!} onChange={refresh} />} />
          <Route path="friends" element={<FriendsTab characterId={characterId!} />} />
          <Route path="chat" element={<ChatTab characterId={characterId} />} />
          <Route path="shop" element={<ShopTab characterId={characterId!} gold={character.gold} onChange={refresh} />} />
          <Route path="crafting" element={<CraftingTab characterId={characterId!} onChange={refresh} />} />
          <Route path="companions" element={<CompanionsTab characterId={characterId!} onChange={refresh} />} />
          <Route path="leaderboard" element={<LeaderboardTab currentCharacterId={characterId!} />} />
          <Route path="story" element={<StoryTab characterLevel={character.level} />} />
        </Routes>
      </main>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "toast--challenge" : ""}`}>
            {t.message}
          </div>
        ))}
        {incomingChallenge && (
          <div className="toast toast--challenge">
            <strong>{incomingChallenge.fromCharacterName}</strong> (Cấp {incomingChallenge.fromCharacterLevel}) thách đấu bạn!
            <div className="toast__actions">
              <button className="small-btn" onClick={() => respondChallenge(true)}>
                Chấp nhận
              </button>
              <button className="small-btn small-btn--danger" onClick={() => respondChallenge(false)}>
                Từ chối
              </button>
            </div>
          </div>
        )}
      </div>

      {pvpResult && <PvpBattleOverlay result={pvpResult} onClose={() => setPvpResult(null)} />}
    </div>
  );
}
