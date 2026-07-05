import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";

interface FriendEntry {
  user_id: string;
  username: string;
}

interface Props {
  characterId: string;
}

export function FriendsTab({ characterId }: Props) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<FriendEntry[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [usernameInput, setUsernameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.get("/friends").then((res) => {
      setPending(res.data.pending || []);
      setFriends(res.data.friends || []);
    });
  }

  useEffect(load, []);

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setError(null);
    setSuccess(null);
    try {
      const lookup = await api.get(`/friends/lookup/${encodeURIComponent(usernameInput.trim())}`);
      await api.post("/friends/request", { targetUserId: lookup.data.user.id });
      setSuccess(`Đã gửi lời mời kết bạn tới ${lookup.data.user.username}`);
      setUsernameInput("");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Không thể gửi lời mời");
    }
  }

  async function respond(reqId: string, accept: boolean) {
    setBusyId(reqId);
    try {
      await api.post("/friends/respond", { requesterUserId: reqId, accept });
      load();
    } finally {
      setBusyId(null);
    }
  }

  function openChat(userId: string) {
    navigate(`/play/${characterId}/chat?with=${userId}`);
  }

  async function challenge(friendUserId: string, friendName: string) {
    setError(null);
    setSuccess(null);
    try {
      const res = await api.get(`/friends/${friendUserId}/character`);
      const socket = getSocket(characterId);
      if (!socket) {
        setError("Chưa kết nối máy chủ realtime, thử tải lại trang");
        return;
      }
      socket.emit("pvp:challenge", { fromCharacterId: characterId, targetCharacterId: res.data.character.id });
      setSuccess(`Đã gửi lời thách đấu tới ${friendName}`);
    } catch (err: any) {
      setError(err.response?.data?.error ?? `${friendName} chưa có nhân vật để thách đấu`);
    }
  }

  return (
    <div>
      <h1 className="page-title">Bạn bè</h1>
      <p className="page-subtitle">Kết bạn, nhắn tin, hoặc thách đấu PvP giao hữu với người chơi khác</p>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <form className="add-friend-form" onSubmit={addFriend}>
        <input
          placeholder="Nhập tên đăng nhập..."
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
        />
        <button className="btn-primary" style={{ width: "auto", padding: "0 18px" }} type="submit">
          Kết bạn
        </button>
      </form>

      <h2 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 10 }}>Lời mời kết bạn</h2>
      {pending.length === 0 ? (
        <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Không có lời mời nào.</p>
      ) : (
        pending.map((p) => (
          <div className="friend-row" key={p.user_id}>
            <span className="friend-row__name">{p.username}</span>
            <div className="friend-row__actions">
              <button className="small-btn" disabled={busyId === p.user_id} onClick={() => respond(p.user_id, true)}>
                Chấp nhận
              </button>
              <button className="small-btn small-btn--danger" disabled={busyId === p.user_id} onClick={() => respond(p.user_id, false)}>
                Từ chối
              </button>
            </div>
          </div>
        ))
      )}

      <h2 style={{ fontSize: 14, color: "var(--text-muted)", margin: "24px 0 10px" }}>Danh sách bạn bè</h2>
      {friends.length === 0 ? (
        <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Chưa có bạn bè nào — hãy thêm bằng tên đăng nhập ở trên.</p>
      ) : (
        friends.map((f) => (
          <div className="friend-row" key={f.user_id}>
            <span className="friend-row__name">{f.username}</span>
            <div className="friend-row__actions">
              <button className="small-btn" onClick={() => openChat(f.user_id)}>
                💬 Nhắn tin
              </button>
              <button className="small-btn small-btn--danger" onClick={() => challenge(f.user_id, f.username)}>
                ⚔️ Thách đấu
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
