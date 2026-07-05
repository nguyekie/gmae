import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const CLASSES = [
  { id: "warrior", name: "Chiến Binh", icon: "⚔️", desc: "HP cao, cận chiến, dễ chơi" },
  { id: "mage", name: "Pháp Sư", icon: "🔮", desc: "Sát thương phép mạnh, HP thấp" },
  { id: "archer", name: "Xạ Thủ", icon: "🏹", desc: "Tốc độ cao, sát thương ổn định" },
] as const;

export function CreateCharacter() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [charClass, setCharClass] = useState<(typeof CLASSES)[number]["id"]>("warrior");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/characters", { name, class: charClass });
      navigate("/characters");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Không thể tạo nhân vật");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-title">Người Thức Tỉnh Mới</div>
        <div className="auth-subtitle">Chọn con đường của bạn tại Etheria</div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Tên nhân vật</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="field">
            <label>Hệ phái</label>
            <div className="class-grid">
              {CLASSES.map((c) => (
                <div
                  key={c.id}
                  className={`class-option ${charClass === c.id ? "class-option--selected" : ""}`}
                  onClick={() => setCharClass(c.id)}
                >
                  <span className="class-option__icon">{c.icon}</span>
                  <span className="class-option__name">{c.name}</span>
                  <span className="class-option__desc">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Đang tạo..." : "Bắt đầu hành trình"}
          </button>
        </form>
      </div>
    </div>
  );
}
