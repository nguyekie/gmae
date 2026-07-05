import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { PixelSprite } from "./PixelSprite";
import { CombatOverlay } from "./CombatOverlay";
import { QuestDialog } from "./QuestDialog";
import {
  TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  ZONES,
  isBlocked,
  findPortal,
  type NpcDef,
  type MonsterSpawnDef,
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

interface BossState {
  currentHp: number;
  maxHp: number;
  dead: boolean;
  respawnInSeconds: number;
}

interface Props {
  zoneId: string;
  spawnPoint: { x: number; y: number };
  characterId: string;
  characterName: string;
  characterClass: "warrior" | "mage" | "archer";
  onChange: () => void;
  onPortal: (toZone: string, x: number, y: number) => void;
}

const TILE_CLASS: Record<string, string> = {
  ".": "map-tile map-tile--grass",
  ",": "map-tile map-tile--path",
  "#": "map-tile map-tile--tree",
  "~": "map-tile map-tile--water",
  ">": "map-tile map-tile--portal",
};

export function MapExplorer({ zoneId, spawnPoint, characterId, characterName, characterClass, onChange, onPortal }: Props) {
  const zone = ZONES[zoneId];
  const [pos, setPos] = useState(spawnPoint);
  const [dir, setDir] = useState<Dir>("down");
  const [otherPlayers, setOtherPlayers] = useState<Record<string, RemotePlayer>>({});
  const [defeated, setDefeated] = useState<Record<string, boolean>>({});
  const [combatTarget, setCombatTarget] = useState<MonsterSpawnDef | null>(null);
  const [questNpc, setQuestNpc] = useState<NpcDef | null>(null);
  const [nearNpc, setNearNpc] = useState<NpcDef | null>(null);
  const [tracker, setTracker] = useState<QuestTrackerEntry[]>([]);
  const [bossStates, setBossStates] = useState<Record<string, BossState>>({});

  const bossSpawns = zone.spawns.filter((s) => s.isBoss);

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
    [characterId, zone, onPortal]
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
    refreshTracker();
  }

  const palette = PLAYER_PALETTES[characterClass];

  return (
    <div>
      <div className="map-viewport" style={{ width: MAP_COLS * TILE_SIZE, height: MAP_ROWS * TILE_SIZE }} tabIndex={0}>
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
            className="map-portal-label"
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

        {nearNpc && (
          <div className="map-interact-hint">
            Nhấn <kbd>Enter</kbd> để nói chuyện với {nearNpc.name}
          </div>
        )}
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
      </div>

      {combatTarget && (
        <CombatOverlay
          characterId={characterId}
          monsterId={combatTarget.monsterId}
          monsterName={combatTarget.name}
          spriteKey={combatTarget.sprite}
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
