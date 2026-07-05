import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useAuthStore } from "../../store/authStore";

interface FriendEntry {
  user_id: string;
  username: string;
}

interface ChatMessage {
  fromUserId?: string;
  from_user_id?: string;
  from_username?: string;
  content: string;
  channel?: "global" | "private";
}

interface Props {
  characterId: string | undefined;
}

export function ChatTab({ characterId }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [activeChannel, setActiveChannel] = useState<"global" | string>(searchParams.get("with") ?? "global");
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/friends").then((res) => setFriends(res.data.friends || []));
  }, []);

  useEffect(() => {
    const withUser = searchParams.get("with");
    if (withUser) setActiveChannel(withUser);
  }, [searchParams]);

  useEffect(() => {
    if (activeChannel === "global" || !characterId) return;
    api.get(`/chat/private/${activeChannel}`).then((res) => {
      setPrivateMessages((prev) => ({ ...prev, [activeChannel]: res.data.messages || [] }));
    });
  }, [activeChannel, characterId]);

  useEffect(() => {
    if (!characterId) return;
    const sock = getSocket(characterId);
    if (!sock) return;

    function onMessage(m: ChatMessage) {
      if (m.channel === "global") {
        setGlobalMessages((s) => [...s, m]);
      } else {
        const otherId = m.fromUserId === currentUserId ? (m as any).toUserId : m.fromUserId;
        const key = otherId ?? m.fromUserId ?? "unknown";
        setPrivateMessages((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), m] }));
      }
    }
    function onError(err: any) {
      setError(typeof err === "string" ? err : "Lỗi chat");
    }

    sock.emit("chat:join", { channel: "global" });
    sock.on("chat:message", onMessage);
    sock.on("chat:error", onError);
    return () => {
      sock.off("chat:message", onMessage);
      sock.off("chat:error", onError);
    };
  }, [characterId, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [globalMessages, privateMessages, activeChannel]);

  function selectFriend(userId: string) {
    setActiveChannel(userId);
    setSearchParams({ with: userId });
    setError(null);
  }

  function selectGlobal() {
    setActiveChannel("global");
    setSearchParams({});
    setError(null);
  }

  function send() {
    if (!text.trim() || !characterId) return;
    const sock = getSocket(characterId);
    if (!sock) {
      setError("Chưa kết nối máy chủ realtime");
      return;
    }
    if (activeChannel === "global") {
      sock.emit("chat:message", { channel: "global", characterId, content: text });
    } else {
      sock.emit("chat:message", { channel: "private", toUserId: activeChannel, content: text });
    }
    setText("");
  }

  const activeFriend = friends.find((f) => f.user_id === activeChannel);
  const messages = activeChannel === "global" ? globalMessages : privateMessages[activeChannel] ?? [];

  return (
    <div>
      <h1 className="page-title">Chat</h1>
      <p className="page-subtitle">Kênh toàn cục tốn 1 vàng mỗi tin nhắn · chat riêng với bạn bè miễn phí</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="chat-shell">
        <div className="chat-sidebar">
          <div className="chat-sidebar__section-title">Kênh chung</div>
          <div className={`chat-contact ${activeChannel === "global" ? "chat-contact--active" : ""}`} onClick={selectGlobal}>
            <span className="chat-contact__dot" style={{ background: "var(--accent-shard)" }} />
            Toàn cục
          </div>

          <div className="chat-sidebar__section-title">Bạn bè</div>
          {friends.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-faint)", padding: "0 10px" }}>
              Chưa có bạn bè — thêm ở tab Bạn bè.
            </p>
          )}
          {friends.map((f) => (
            <div
              key={f.user_id}
              className={`chat-contact ${activeChannel === f.user_id ? "chat-contact--active" : ""}`}
              onClick={() => selectFriend(f.user_id)}
            >
              <span className="chat-contact__dot" />
              {f.username}
            </div>
          ))}
        </div>

        <div className="chat-panel">
          <div className="chat-panel__header">
            {activeChannel === "global" ? "🌐 Kênh toàn cục" : `💬 ${activeFriend?.username ?? "Chat riêng"}`}
          </div>

          <div className="chat-panel__messages" ref={scrollRef}>
            {messages.length === 0 && <div className="chat-panel__empty">Chưa có tin nhắn nào. Hãy bắt đầu trò chuyện!</div>}
            {messages.map((m, i) => {
              const mine = (m.fromUserId ?? m.from_user_id) === currentUserId;
              return (
                <div key={i} className={`chat-bubble ${mine ? "chat-bubble--mine" : "chat-bubble--theirs"}`}>
                  {!mine && activeChannel === "global" && (
                    <div className="chat-bubble__author">{m.from_username ?? "Người chơi"}</div>
                  )}
                  {m.content}
                </div>
              );
            })}
          </div>

          <div className="chat-panel__input">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={activeChannel === "global" ? "Nhắn gì đó cho mọi người... (tốn 1 vàng)" : "Nhắn tin..."}
            />
            <button className="small-btn" onClick={send}>
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
