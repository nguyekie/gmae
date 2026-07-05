import type { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

interface ZonePlayer {
  socketId: string;
  characterId: string;
  name: string;
  class: string;
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right";
}

// Trạng thái người chơi trong từng zone — lưu tạm ở bộ nhớ server (đủ dùng cho demo,
// không cần bền vững qua restart vì đây chỉ là vị trí hiển thị trên bản đồ, không phải dữ liệu game).
const zonePlayers = new Map<string, Map<string, ZonePlayer>>();

function getZoneMap(zoneId: string) {
  let map = zonePlayers.get(zoneId);
  if (!map) {
    map = new Map();
    zonePlayers.set(zoneId, map);
  }
  return map;
}

interface PendingChallenge {
  challengeId: string;
  fromUserId: string;
  fromCharacterId: string;
  fromCharacterName: string;
  targetUserId: string;
  targetCharacterId: string;
  targetCharacterName: string;
  expiresAt: number;
}

export function setupSockets(httpServer: HTTPServer, clientOrigin: string) {
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin },
  });

  // Map userId -> Set of socket ids (for multi-tab)
  const userSockets = new Map<string, Set<string>>();

  // Lời thách đấu PvP đang chờ phản hồi, theo challengeId — tự hết hạn sau 30s
  const pendingChallenges = new Map<string, PendingChallenge>();

  io.on("connection", (socket) => {
    // Kênh xác thực chung (giữ tương thích với các hệ thống khác dùng phòng theo nhân vật, ví dụ chợ giao dịch)
    socket.on("auth", ({ token, characterId }: { token: string; characterId: string }) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        socket.data.userId = payload.userId;
        socket.data.characterId = characterId;
        // Join rooms for this user and character
        socket.join(`character:${characterId}`);
        socket.join(`user:${payload.userId}`);
        // track socket
        let set = userSockets.get(payload.userId);
        if (!set) { set = new Set(); userSockets.set(payload.userId, set); }
        set.add(socket.id);
        socket.emit("auth:ok");
      } catch {
        socket.emit("auth:error", "Token không hợp lệ");
      }
    });

    socket.on('disconnect', () => {
      const uid = socket.data.userId as string | undefined;
      if (uid) {
        const set = userSockets.get(uid);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(uid);
        }
      }
    });

    // ===== Bản đồ khám phá đa người chơi =====
    socket.on(
      "zone:join",
      ({
        token,
        characterId,
        name,
        class: charClass,
        zoneId,
        x,
        y,
      }: {
        token: string;
        characterId: string;
        name: string;
        class: string;
        zoneId: string;
        x: number;
        y: number;
      }) => {
        try {
          jwt.verify(token, process.env.JWT_SECRET as string);
        } catch {
          socket.emit("zone:error", "Token không hợp lệ");
          return;
        }

        socket.data.zoneId = zoneId;
        socket.data.characterId = characterId;

        socket.join(`zone:${zoneId}`);

        const player: ZonePlayer = { socketId: socket.id, characterId, name, class: charClass, x, y, dir: "down" };
        const roomPlayers = getZoneMap(zoneId);
        roomPlayers.set(socket.id, player);

        // Gửi danh sách người chơi hiện có (trừ chính mình) cho người vừa vào
        socket.emit(
          "zone:players",
          Array.from(roomPlayers.values()).filter((p) => p.socketId !== socket.id)
        );
        // Báo cho những người khác trong zone biết có người mới vào
        socket.to(`zone:${zoneId}`).emit("zone:player_joined", player);
      }
    );

    socket.on("zone:move", ({ x, y, dir }: { x: number; y: number; dir: ZonePlayer["dir"] }) => {
      const zoneId = socket.data.zoneId as string | undefined;
      if (!zoneId) return;
      const roomPlayers = getZoneMap(zoneId);
      const player = roomPlayers.get(socket.id);
      if (!player) return;
      player.x = x;
      player.y = y;
      player.dir = dir;
      socket.to(`zone:${zoneId}`).emit("zone:player_moved", { socketId: socket.id, x, y, dir });
    });

    function leaveZone() {
      const zoneId = socket.data.zoneId as string | undefined;
      if (!zoneId) return;
      const roomPlayers = getZoneMap(zoneId);
      roomPlayers.delete(socket.id);
      socket.to(`zone:${zoneId}`).emit("zone:player_left", { socketId: socket.id });
      socket.leave(`zone:${zoneId}`);
      socket.data.zoneId = undefined;
    }

    socket.on("zone:leave", leaveZone);
    socket.on("disconnect", leaveZone);

    // ===== Realtime chat =====
    // Join global channel
    socket.on('chat:join', ({ channel }: { channel: string }) => {
      if (channel === 'global') {
        socket.join('global');
        socket.emit('chat:joined', { channel: 'global' });
      }
    });

    // chat:message { channel: 'global'|'private', characterId, toUserId?, content }
    socket.on('chat:message', async (data: any) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) { socket.emit('chat:error', 'Chưa auth'); return; }
      const { channel, characterId, toUserId, content } = data;
      if (!content || content.trim().length === 0) return;

      try {
        if (channel === 'global') {
          // charge gold per message (configurable)
          const cost = 1;
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const charRes = await client.query('SELECT id, gold FROM characters WHERE id = $1 AND user_id = $2 FOR UPDATE', [characterId, userId]);
            const char = charRes.rows[0];
            if (!char) { await client.query('ROLLBACK'); socket.emit('chat:error','Nhân vật không tồn tại'); return; }
            if (Number(char.gold) < cost) { await client.query('ROLLBACK'); socket.emit('chat:error','Không đủ vàng để gửi tin nhắn toàn cục'); return; }
            await client.query('UPDATE characters SET gold = gold - $1 WHERE id = $2', [cost, characterId]);
            await client.query('INSERT INTO messages (from_user_id, to_user_id, content) VALUES ($1,$2,$3)', [userId, null, content]);
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            socket.emit('chat:error','Lỗi khi gửi');
            return;
          } finally { client.release(); }
          // broadcast
          io.to('global').emit('chat:message', { fromUserId: userId, content, channel: 'global' });
        } else if (channel === 'private') {
          // insert into messages and emit to recipient
          await pool.query('INSERT INTO messages (from_user_id, to_user_id, content) VALUES ($1,$2,$3)', [userId, toUserId, content]);
          io.to(`user:${toUserId}`).emit('chat:message', { fromUserId: userId, toUserId, content, channel: 'private' });
          socket.emit('chat:message', { fromUserId: userId, toUserId, content, channel: 'private' });
        }
      } catch (err) {
        console.error('chat:message error', err);
        socket.emit('chat:error', 'Lỗi server');
      }
    });

    // ===== PvP challenge (có theo dõi lời mời đang chờ để chống giả mạo) =====
    // pendingChallenges: targetUserId -> { fromCharacterId, fromUserId, targetCharacterId, expiresAt }
    socket.on('pvp:challenge', async ({ fromCharacterId, targetCharacterId }: { fromCharacterId: string; targetCharacterId: string }) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) { socket.emit('pvp:error', 'Chưa xác thực'); return; }
      if (fromCharacterId === targetCharacterId) { socket.emit('pvp:error', 'Không thể tự thách đấu chính mình'); return; }

      const fromRes = await pool.query('SELECT user_id, name, level FROM characters WHERE id = $1', [fromCharacterId]);
      const fromChar = fromRes.rows[0];
      if (!fromChar || fromChar.user_id !== userId) { socket.emit('pvp:error', 'Không sở hữu nhân vật này'); return; }

      const targetRes = await pool.query('SELECT user_id, name, level FROM characters WHERE id = $1', [targetCharacterId]);
      const targetChar = targetRes.rows[0];
      if (!targetChar) { socket.emit('pvp:error', 'Không tìm thấy đối thủ'); return; }
      if (targetChar.user_id === userId) { socket.emit('pvp:error', 'Không thể tự thách đấu chính mình'); return; }

      const challengeId = `chal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      pendingChallenges.set(challengeId, {
        challengeId,
        fromUserId: userId,
        fromCharacterId,
        fromCharacterName: fromChar.name,
        targetUserId: targetChar.user_id,
        targetCharacterId,
        targetCharacterName: targetChar.name,
        expiresAt: Date.now() + 30_000,
      });
      setTimeout(() => pendingChallenges.delete(challengeId), 30_000);

      io.to(`user:${targetChar.user_id}`).emit('pvp:challenged', {
        challengeId,
        fromCharacterId,
        fromCharacterName: fromChar.name,
        fromCharacterLevel: fromChar.level,
        targetCharacterId,
      });
      socket.emit('pvp:challenge_sent', { challengeId, targetCharacterName: targetChar.name });
    });

    // pvp:respond { challengeId, accept }
    socket.on('pvp:respond', async ({ challengeId, accept }: { challengeId: string; accept: boolean }) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) { socket.emit('pvp:error', 'Chưa xác thực'); return; }

      const challenge = pendingChallenges.get(challengeId);
      if (!challenge) { socket.emit('pvp:error', 'Lời thách đấu đã hết hạn hoặc không tồn tại'); return; }
      // Chỉ đúng người bị mời (targetUserId) mới có quyền chấp nhận/từ chối — chống giả mạo
      if (challenge.targetUserId !== userId) { socket.emit('pvp:error', 'Bạn không phải người được mời'); return; }

      pendingChallenges.delete(challengeId);

      if (!accept) {
        io.to(`user:${challenge.fromUserId}`).emit('pvp:declined', { challengeId, byName: challenge.targetCharacterName });
        return;
      }

      const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { fromCharacterId, targetCharacterId, fromUserId, targetUserId } = challenge;

      io.to(`user:${fromUserId}`).emit('pvp:start', { matchId, players: [fromCharacterId, targetCharacterId] });
      io.to(`user:${targetUserId}`).emit('pvp:start', { matchId, players: [fromCharacterId, targetCharacterId] });

      try {
        const c1 = (await pool.query('SELECT id, name, class, hp, max_hp, base_atk, base_def, level FROM characters WHERE id = $1', [fromCharacterId])).rows[0];
        const c2 = (await pool.query('SELECT id, name, class, hp, max_hp, base_atk, base_def, level FROM characters WHERE id = $1', [targetCharacterId])).rows[0];

        let hp1 = c1.max_hp; let hp2 = c2.max_hp; // PvP giao hữu: luôn bắt đầu ở full HP, không dùng HP hiện tại (tránh bị ăn gian bằng cách thách đấu khi máu đối thủ đang thấp từ PvE)
        const atk1 = c1.base_atk; const def1 = c1.base_def; const atk2 = c2.base_atk; const def2 = c2.base_def;
        const log: string[] = [];
        let turn = 0;
        while (hp1 > 0 && hp2 > 0 && turn < 30) {
          const dmgTo2 = Math.max(1, atk1 - def2 + Math.floor(Math.random() * 5));
          hp2 -= dmgTo2; log.push(`${c1.name} gây ${dmgTo2} sát thương lên ${c2.name}`); if (hp2 <= 0) break;
          const dmgTo1 = Math.max(1, atk2 - def1 + Math.floor(Math.random() * 5));
          hp1 -= dmgTo1; log.push(`${c2.name} gây ${dmgTo1} sát thương lên ${c1.name}`);
          turn++;
        }
        const p1win = hp2 <= 0 && hp1 > 0;

        io.to(`user:${fromUserId}`).emit('pvp:result', {
          matchId, victory: p1win, log,
          self: { name: c1.name, class: c1.class, finalHp: Math.max(0, hp1), maxHp: c1.max_hp },
          opponent: { name: c2.name, class: c2.class, finalHp: Math.max(0, hp2), maxHp: c2.max_hp },
        });
        io.to(`user:${targetUserId}`).emit('pvp:result', {
          matchId, victory: !p1win, log,
          self: { name: c2.name, class: c2.class, finalHp: Math.max(0, hp2), maxHp: c2.max_hp },
          opponent: { name: c1.name, class: c1.class, finalHp: Math.max(0, hp1), maxHp: c1.max_hp },
        });
        // Lưu ý: PvP giao hữu trong bản demo này không trừ HP thật/không có phần thưởng —
        // chỉ để giải trí. Muốn có cược vàng/vật phẩm thì cần bọc trong DB transaction như combat.ts.
      } catch (err) {
        console.error('pvp error', err);
        io.to(`user:${fromUserId}`).emit('pvp:error', 'Lỗi khi xử lý trận đấu');
        io.to(`user:${targetUserId}`).emit('pvp:error', 'Lỗi khi xử lý trận đấu');
      }
    });
  });

  return io;
}
