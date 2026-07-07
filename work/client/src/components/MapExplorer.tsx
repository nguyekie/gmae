import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { PixelSprite } from "./PixelSprite";
import { CombatOverlay } from "./CombatOverlay";
import { QuestDialog } from "./QuestDialog";
import {
  TILE_SIZE,
  ZONES,
  getZoneCols,
  getZoneRows,
  isBlocked,
  findPortal,
  type NpcDef,
  type MonsterSpawnDef,
  type PortalDef,
} from "../data/mapData";
import { PLAYER_PALETTES, NPC_SPRITES, MONSTER_SPRITES, HUMANOID } from "../data/sprites";

type Dir = "up" | "down" | "left" | "right";

interface RemotePlayer {
  socketId: string;
  characterId: string;
  name: string;
  class: string;
  x: number;
  y: number;
  dir: Dir;
}

interface QuestTrackerEntry {
  npcName: string;
  title: string;
  objectives: { label: string; current: number; count: number; done: boolean }[];
  ready: boolean;
}

interface ActiveCompanion {
  id: string;
  name: string;
  active: boolean;
}

interface BossState {
  currentHp: number;
  maxHp: number;
  dead: boolean;
  respawnInSeconds: number;
}

interface QuickConsumable {
  id: string;
  name: string;
  quantity: number;
  base_stats: Record<string, number>;
}

interface Props {
  zoneId: string;
  spawnPoint: { x: number; y: number };
  characterId: string;
  characterName: string;
  characterClass: "warrior" | "mage" | "archer";
  characterLevel: number;
  appearance?: string;
  onChange: () => void;
  onPortal: (toZone: string, x: number, y: number) => void;
}

const TILE_CLASS: Record<string, string> = {
  ".": "map-tile map-tile--grass",
  ",": "map-tile map-tile--path",
  "#": "map-tile map-tile--tree",
  "~": "map-tile map-tile--water",
  "^": "map-tile map-tile--lava",
  "*": "map-tile map-tile--ash",
  "=": "map-tile map-tile--ice",
  "i": "map-tile map-tile--crystal",
  "w": "map-tile map-tile--shallows",
  ">": "map-tile map-tile--portal",
};

const COMPANION_SPRITES: Record<string, { matrix: string[]; palette: Record<string, string> }> = {
  lyra_falcon: {
    matrix: ["........", "..WWWW..", ".WYYWYW.", "WWWWWWWW", "..W..W..", ".W....W.", "........", "........"],
    palette: { W: "#8fd7d0", Y: "#ffd166" },
  },
  rift_sprite: {
    matrix: ["........", "...VV...", "..VYYV..", ".VYYYYV.", "..VYYV..", "...VV...", "....V...", "........"],
    palette: { V: "#9b6bd9", Y: "#d9fffb" },
  },
  oath_guardian: {
    matrix: ["..SSSS..", ".SSGGSS.", ".SGSSGS.", ".SSSSSS.", "..SSSS..", "..S..S..", ".S....S.", "........"],
    palette: { S: "#8b93a1", G: "#e0a93e" },
  },
};

const APPEARANCE_PALETTES: Record<string, Record<string, string>> = {
  fortune_fox: { H: "#f5d7a1", S: "#e3b389", E: "#1a1a1a", B: "#d88f45", L: "#7a4a22" },
  void_child: { H: "#1c1f2b", S: "#c9a877", E: "#c17ee9", B: "#2e1f3c", L: "#17121f" },
  shard_king: { H: "#c9a24b", S: "#e3b389", E: "#1a1a1a", B: "#5fb6d9", L: "#1d3b5f" },
};

export function MapExplorer({ zoneId, spawnPoint, characterId, characterName, characterClass, characterLevel, appearance, onChange, onPortal }: Props) {
  const zone = ZONES[zoneId];
  const zoneCols = getZoneCols(zone);
  const zoneRows = getZoneRows(zone);
  const [pos, setPos] = useState(spawnPoint);
  const [dir, setDir] = useState<Dir>("down");
  const [otherPlayers, setOtherPlayers] = useState<Record<string, RemotePlayer>>({});
  const [defeated, setDefeated] = useState<Record<string, boolean>>({});
  const [combatTarget, setCombatTarget] = useState<MonsterSpawnDef | null>(null);
  const [questNpc, setQuestNpc] = useState<NpcDef | null>(null);
  const [nearNpc, setNearNpc] = useState<NpcDef | null>(null);
  const [tracker, setTracker] = useState<QuestTrackerEntry[]>([]);
  const [bossStates, setBossStates] = useState<Record<string, BossState>>({});
  const [completedQuestIds, setCompletedQuestIds] = useState<Set<string>>(new Set());
  const [portalMessage, setPortalMessage] = useState<string | null>(null);
  const [activeCompanion, setActiveCompanion] = useState<ActiveCompanion | null>(null);
  const [dungeonRemaining, setDungeonRemaining] = useState<number | null>(zone.timeLimitSeconds ?? null);
  const [quickItems, setQuickItems] = useState<QuickConsumable[]>([]);
  const [usingQuickItemId, setUsingQuickItemId] = useState<string | null>(null);
  const [quickItemMessage, setQuickItemMessage] = useState<string | null>(null);

  const bossSpawns = zone.spawns.filter((s) => s.isBoss);

  const isPortalUnlocked = useCallback(
    (portal: PortalDef) => {
      if (portal.requiredLevel && characterLevel < portal.requiredLevel) return false;
      if (!portal.unlockQuestIds || portal.unlockQuestIds.length === 0) return true;
      if (portal.unlockMode === "any") return portal.unlockQuestIds.some((id) => completedQuestIds.has(id));
      return portal.unlockQuestIds.every((id) => completedQuestIds.has(id));
    },
    [characterLevel, completedQuestIds]
  );

  const refreshCompletedQuests = useCallback(() => {
    api
      .get(`/quests/completed/${characterId}`)
      .then((res) => setCompletedQuestIds(new Set(res.data.completedQuestIds ?? [])))
      .catch(() => setCompletedQuestIds(new Set()));
  }, [characterId]);

  useEffect(() => {
    refreshCompletedQuests();
  }, [refreshCompletedQuests]);

  const refreshQuickItems = useCallback(() => {
    api
      .get(`/inventory/${characterId}`)
      .then((res) => {
        const consumables = (res.data.items ?? []).filter(
          (item: QuickConsumable & { slot: string }) =>
            item.slot === "consumable" && item.quantity > 0 && ((item.base_stats?.heal ?? 0) > 0 || (item.base_stats?.mana ?? 0) > 0)
        );
        setQuickItems(consumables);
      })
      .catch(() => setQuickItems([]));
  }, [characterId]);

  useEffect(() => {
    refreshQuickItems();
  }, [refreshQuickItems]);

  useEffect(() => {
    if (!zone.timeLimitSeconds) {
      setDungeonRemaining(null);
      return;
    }
    const start = Date.now();
    setDungeonRemaining(zone.timeLimitSeconds);
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, zone.timeLimitSeconds! - Math.floor((Date.now() - start) / 1000));
      setDungeonRemaining(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        onPortal("starting_village", 1, 8);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [zoneId, zone.timeLimitSeconds, onPortal]);

  useEffect(() => {
    api
      .get(`/companions/${characterId}`)
      .then((res) => {
        const active = (res.data.companions ?? []).find((c: ActiveCompanion) => c.active);
        setActiveCompanion(active ?? null);
      })
      .catch(() => setActiveCompanion(null));
  }, [characterId]);

  const refreshBossStates = useCallback(() => {
    for (const spawn of bossSpawns) {
      api
        .get(`/combat/boss/${spawn.monsterId}`)
        .then((res) => setBossStates((prev) => ({ ...prev, [spawn.spawnId]: res.data })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  useEffect(() => {
    refreshBossStates();
    // Cập nhật định kỳ để đếm ngược thời gian hồi sinh boss chính xác dù không tương tác gì
    const interval = setInterval(refreshBossStates, 15000);
    return () => clearInterval(interval);
  }, [refreshBossStates]);

  const defeatedRef = useRef(defeated);
  defeatedRef.current = defeated;
  const modalOpenRef = useRef(false);
  modalOpenRef.current = !!combatTarget || !!questNpc;

  const refreshTracker = useCallback(() => {
    if (zone.npcs.length === 0) {
      setTracker([]);
      return;
    }
    Promise.all(
      zone.npcs.map((npc) =>
        api
          .get(`/quests/npc/${npc.id}`, { params: { characterId } })
          .then((res) => ({ npc, quests: res.data.quests as any[] }))
      )
    ).then((results) => {
      const entries: QuestTrackerEntry[] = [];
      for (const { npc, quests } of results) {
        for (const q of quests) {
          if (q.state === "active" || q.state === "ready_to_turn_in") {
            entries.push({
              npcName: npc.name,
              title: q.title,
              objectives: q.objectives,
              ready: q.state === "ready_to_turn_in",
            });
          }
        }
      }
      setTracker(entries);
    });
  }, [characterId, zone]);

  useEffect(() => {
    refreshTracker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  // ===== Kết nối socket đa người chơi cho zone này =====
  // Lưu ý: KHÔNG gọi socket.connect()/disconnect() ở đây — kết nối được quản lý dùng chung
  // ở cấp Dashboard để chat/PvP vẫn hoạt động khi người chơi chuyển sang tab khác.
  useEffect(() => {
    const socket = getSocket(characterId);
    if (!socket) {
      console.warn("Socket chưa được kết nối khi vào vùng khám phá");
      return;
    }

    socket.emit("zone:join", {
      token: localStorage.getItem("etheria_token"),
      characterId,
      name: characterName,
      class: characterClass,
      zoneId,
      x: spawnPoint.x,
      y: spawnPoint.y,
    });

    function onPlayers(players: RemotePlayer[]) {
      const map: Record<string, RemotePlayer> = {};
      for (const p of players) map[p.socketId] = p;
      setOtherPlayers(map);
    }
    function onJoined(p: RemotePlayer) {
      setOtherPlayers((prev) => ({ ...prev, [p.socketId]: p }));
    }
    function onMoved({ socketId, x, y, dir: d }: { socketId: string; x: number; y: number; dir: Dir }) {
      setOtherPlayers((prev) => (prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], x, y, dir: d } } : prev));
    }
    function onLeft({ socketId }: { socketId: string }) {
      setOtherPlayers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    }

    socket.on("zone:players", onPlayers);
    socket.on("zone:player_joined", onJoined);
    socket.on("zone:player_moved", onMoved);
    socket.on("zone:player_left", onLeft);
    socket.on("world:boss_defeated", refreshBossStates);

    return () => {
      socket.emit("zone:leave");
      socket.off("zone:players", onPlayers);
      socket.off("zone:player_joined", onJoined);
      socket.off("zone:player_moved", onMoved);
      socket.off("zone:player_left", onLeft);
      socket.off("world:boss_defeated", refreshBossStates);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, zoneId]);

  // ===== Cập nhật NPC gần đó (để hiện gợi ý "nói chuyện") =====
  useEffect(() => {
    const near = zone.npcs.find((n) => Math.abs(n.x - pos.x) <= 1 && Math.abs(n.y - pos.y) <= 1);
    setNearNpc(near ?? null);
  }, [pos, zone]);

  const move = useCallback(
    (dx: number, dy: number, newDir: Dir) => {
      if (modalOpenRef.current) return;
      setDir(newDir);
      setPos((prev) => {
        const nx = prev.x + dx;
        const ny = prev.y + dy;
        if (isBlocked(zone, nx, ny)) return prev;
        if (zone.npcs.some((n) => n.x === nx && n.y === ny)) return prev;

        const spawn = zone.spawns.find((s) => s.x === nx && s.y === ny);
        if (spawn) {
          const isDefeated = spawn.isBoss ? bossStates[spawn.spawnId]?.dead : defeatedRef.current[spawn.spawnId];
          if (!isDefeated) {
            setCombatTarget(spawn);
            return prev;
          }
        }

        const portal = findPortal(zone, nx, ny);
        if (portal) {
          if (!isPortalUnlocked(portal)) {
            setPortalMessage(portal.lockedLabel ?? (portal.requiredLevel ? `Cần cấp ${portal.requiredLevel} để vào khu vực này.` : "Cần hoàn thành nhiệm vụ trước khi sang vùng đất tiếp theo."));
            window.setTimeout(() => setPortalMessage(null), 2800);
            return prev;
          }
          onPortal(portal.toZone, portal.spawnX, portal.spawnY);
          return prev;
        }

        const socket = getSocket(characterId);
        if (socket) {
          socket.emit("zone:move", { x: nx, y: ny, dir: newDir });
        }
        return { x: nx, y: ny };
      });
    },
    [characterId, zone, onPortal, isPortalUnlocked]
  );

  const interact = useCallback(() => {
    if (modalOpenRef.current) return;
    if (nearNpc) setQuestNpc(nearNpc);
  }, [nearNpc]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          move(0, -1, "up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          move(0, 1, "down");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          move(-1, 0, "left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          move(1, 0, "right");
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          interact();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move, interact]);

  function handleCombatClose(victory: boolean) {
    const spawn = combatTarget;
    setCombatTarget(null);
    if (!spawn) return;

    if (spawn.isBoss) {
      // Máu boss là sự thật từ server — luôn lấy lại trạng thái mới nhất sau khi đóng màn hình
      // chiến đấu, bất kể thắng/thua/chỉ góp sát thương, vì máu đã thay đổi trong mọi trường hợp.
      refreshBossStates();
      onChange();
      refreshTracker();
      return;
    }

    if (victory) {
      setDefeated((prev) => ({ ...prev, [spawn.spawnId]: true }));
      setTimeout(() => {
        setDefeated((prev) => ({ ...prev, [spawn.spawnId]: false }));
      }, spawn.respawnMs);
      onChange();
      refreshTracker();
    }
  }

  function handleQuestClose() {
    setQuestNpc(null);
  }

  function handleQuestChange() {
    onChange();
    refreshCompletedQuests();
    refreshTracker();
  }

  async function useQuickItem(item: QuickConsumable) {
    setUsingQuickItemId(item.id);
    setQuickItemMessage(null);
    try {
      await api.post("/inventory/use", { characterId, itemInstanceId: item.id });
      setQuickItemMessage(`Đã dùng ${item.name}`);
      refreshQuickItems();
      onChange();
      window.setTimeout(() => setQuickItemMessage(null), 2200);
    } catch (err: any) {
      setQuickItemMessage(err.response?.data?.error ?? "Không thể dùng vật phẩm");
      window.setTimeout(() => setQuickItemMessage(null), 2800);
    } finally {
      setUsingQuickItemId(null);
    }
  }

  const palette = (appearance && APPEARANCE_PALETTES[appearance]) || PLAYER_PALETTES[characterClass];
  const companionSprite = activeCompanion ? COMPANION_SPRITES[activeCompanion.id] ?? COMPANION_SPRITES.rift_sprite : null;
  const companionOffset =
    dir === "left" ? { x: 1, y: 0 } : dir === "right" ? { x: -1, y: 0 } : dir === "up" ? { x: 0, y: 1 } : { x: -1, y: 0 };
  const companionPos = {
    x: Math.max(0, Math.min(zoneCols - 1, pos.x + companionOffset.x)),
    y: Math.max(0, Math.min(zoneRows - 1, pos.y + companionOffset.y)),
  };
  const hpPotion = quickItems
    .filter((item) => (item.base_stats?.heal ?? 0) > 0)
    .sort((a, b) => (b.base_stats?.heal ?? 0) - (a.base_stats?.heal ?? 0))[0];
  const mpPotion = quickItems
    .filter((item) => (item.base_stats?.mana ?? 0) > 0)
    .sort((a, b) => (b.base_stats?.mana ?? 0) - (a.base_stats?.mana ?? 0))[0];

  return (
    <div>
      <div className="map-viewport" style={{ width: zoneCols * TILE_SIZE, height: zoneRows * TILE_SIZE }} tabIndex={0}>
        {zone.grid.map((row, y) =>
          row.split("").map((ch, x) => (
            <div
              key={`${x}-${y}`}
              className={TILE_CLASS[ch]}
              style={{ left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
            />
          ))
        )}

        {zone.portals.map((p) => (
          <div
            key={`${p.x}-${p.y}`}
            className={`map-portal-label${isPortalUnlocked(p) ? "" : " map-portal-label--locked"}`}
            style={{ left: p.x * TILE_SIZE, top: p.y * TILE_SIZE - 16, width: TILE_SIZE }}
          >
            {p.label}
          </div>
        ))}

        {zone.npcs.map((npc) => {
          const sprite = NPC_SPRITES[npc.sprite];
          return (
            <div
              key={npc.id}
              className={`map-entity${nearNpc?.id === npc.id ? " map-entity--highlight" : ""}`}
              style={{ left: npc.x * TILE_SIZE, top: npc.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
            >
              <PixelSprite matrix={sprite.matrix} palette={sprite.palette} size={TILE_SIZE} />
              <div className="map-entity__label">{npc.name}</div>
            </div>
          );
        })}

        {zone.spawns
          .filter((s) => (s.isBoss ? !bossStates[s.spawnId]?.dead : !defeated[s.spawnId]))
          .map((spawn) => {
            const sprite = MONSTER_SPRITES[spawn.sprite];
            const boss = spawn.isBoss ? bossStates[spawn.spawnId] : undefined;
            return (
              <div
                key={spawn.spawnId}
                className={`map-entity${spawn.isBoss ? " map-entity--boss" : ""}`}
                style={{ left: spawn.x * TILE_SIZE, top: spawn.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
              >
                {spawn.isBoss && <div className="map-entity__boss-tag">BOSS</div>}
                {spawn.isElite && !spawn.isBoss && <div className="map-entity__boss-tag">ELITE</div>}
                <PixelSprite matrix={sprite.matrix} palette={sprite.palette} size={spawn.isBoss ? TILE_SIZE * 1.4 : TILE_SIZE} bob />
                <div className="map-entity__label">{spawn.name}</div>
                {boss && (
                  <div className="map-entity__boss-hp">
                    <div className="map-entity__boss-hp-fill" style={{ width: `${(boss.currentHp / boss.maxHp) * 100}%` }} />
                  </div>
                )}
              </div>
            );
          })}

        {Object.values(otherPlayers).map((p) => {
          const pal = PLAYER_PALETTES[p.class] ?? PLAYER_PALETTES.warrior;
          return (
            <div
              key={p.socketId}
              className="map-entity map-entity--player-remote"
              style={{ left: p.x * TILE_SIZE, top: p.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
            >
              <PixelSprite matrix={HUMANOID} palette={pal} size={TILE_SIZE} flip={p.dir === "left"} />
              <div className="map-entity__label">{p.name}</div>
            </div>
          );
        })}

        <div
          className="map-entity map-entity--player-self"
          style={{ left: pos.x * TILE_SIZE, top: pos.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
        >
          <PixelSprite matrix={HUMANOID} palette={palette} size={TILE_SIZE} flip={dir === "left"} />
          <div className="map-entity__label map-entity__label--self">{characterName}</div>
        </div>

        {activeCompanion && companionSprite && (
          <div
            className="map-entity map-entity--companion"
            style={{ left: companionPos.x * TILE_SIZE + 9, top: companionPos.y * TILE_SIZE + 10, width: TILE_SIZE, height: TILE_SIZE }}
          >
            <PixelSprite matrix={companionSprite.matrix} palette={companionSprite.palette} size={30} bob />
            <div className="map-entity__label map-entity__label--companion">{activeCompanion.name}</div>
          </div>
        )}

        {tracker.length > 0 && (
          <div className="quest-tracker">
            <div className="quest-tracker__title">📜 Nhiệm vụ</div>
            {tracker.map((t, i) => (
              <div className="quest-tracker__entry" key={i}>
                <div className="quest-tracker__quest-title">{t.title}</div>
                {t.objectives.map((o, j) => (
                  <div className="quest-tracker__objective" key={j}>
                    {o.label} {o.current}/{o.count} {o.done ? "✓" : ""}
                  </div>
                ))}
                {t.ready && <div className="quest-tracker__ready">→ Quay lại {t.npcName} để trả nhiệm vụ</div>}
              </div>
            ))}
          </div>
        )}

        {dungeonRemaining !== null && (
          <div className="map-dungeon-timer">
            Dungeon còn {Math.floor(dungeonRemaining / 60)}:{String(dungeonRemaining % 60).padStart(2, "0")}
          </div>
        )}

        {nearNpc && (
          <div className="map-interact-hint">
            Nhấn <kbd>Enter</kbd> để nói chuyện với {nearNpc.name}
          </div>
        )}
        {portalMessage && <div className="map-interact-hint map-interact-hint--locked">{portalMessage}</div>}
      </div>

      <div className="map-controls">
        <div className="map-controls__dpad">
          <button className="small-btn" style={{ gridArea: "up" }} onClick={() => move(0, -1, "up")}>
            ↑
          </button>
          <button className="small-btn" style={{ gridArea: "left" }} onClick={() => move(-1, 0, "left")}>
            ←
          </button>
          <button className="small-btn" style={{ gridArea: "down" }} onClick={() => move(0, 1, "down")}>
            ↓
          </button>
          <button className="small-btn" style={{ gridArea: "right" }} onClick={() => move(1, 0, "right")}>
            →
          </button>
        </div>
        <button className="btn-secondary" disabled={!nearNpc} onClick={interact}>
          💬 Nói chuyện
        </button>
        <div className="map-quick-items">
          <button className="small-btn" disabled={!hpPotion || !!usingQuickItemId} onClick={() => hpPotion && useQuickItem(hpPotion)}>
            HP {hpPotion ? `x${hpPotion.quantity}` : "0"}
          </button>
          <button className="small-btn" disabled={!mpPotion || !!usingQuickItemId} onClick={() => mpPotion && useQuickItem(mpPotion)}>
            MP {mpPotion ? `x${mpPotion.quantity}` : "0"}
          </button>
          {quickItemMessage && <span className="map-quick-items__message">{quickItemMessage}</span>}
        </div>
      </div>

      {combatTarget && (
        <CombatOverlay
          characterId={characterId}
          monsterId={combatTarget.monsterId}
          monsterName={combatTarget.name}
          spriteKey={combatTarget.sprite}
          characterClass={characterClass}
          isBoss={combatTarget.isBoss}
          onClose={handleCombatClose}
          onChange={onChange}
        />
      )}

      {questNpc && (
        <QuestDialog
          characterId={characterId}
          npcId={questNpc.id}
          npcName={questNpc.name}
          spriteKey={questNpc.sprite}
          onClose={handleQuestClose}
          onChange={handleQuestChange}
        />
      )}
    </div>
  );
}
