import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useCharacterStore } from "../store/characterStore";
import { useAuthStore } from "../store/authStore";

const CLASS_LABEL: Record<string, string> = { warrior: "Chiến Binh", mage: "Pháp Sư", archer: "Xạ Thủ" };

export function CharacterSelect() {
  const navigate = useNavigate();
  const { characters, setCharacters, setActiveCharacter } = useCharacterStore();
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/characters")
      .then((res) => setCharacters(res.data.characters))
      .finally(() => setLoading(false));
  }, [setCharacters]);

  function enterGame(id: string) {
    setActiveCharacter(id);
    navigate(`/play/${id}`);
  }

  return (
    <div className="auth-screen">
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div className="auth-title" style={{ marginBottom: 8 }}>
          Chọn Người Thức Tỉnh
        </div>
        <p className="auth-subtitle">Tiếp tục hành trình hoặc bắt đầu một huyền thoại mới</p>

        {loading ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Đang tải...</p>
        ) : (
          <div className="character-select-grid">
            {characters.map((c) => (
              <div key={c.id} className="character-select-card" onClick={() => enterGame(c.id)}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--accent-shard)" }}>
                  {c.name}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, margin: "6px 0 12px" }}>
                  {CLASS_LABEL[c.class]} · Cấp {c.level}
                </div>
                <div className="small-btn" style={{ display: "inline-block" }}>
                  Vào game
                </div>
              </div>
            ))}
            <div
              className="character-select-card"
              style={{ borderStyle: "dashed", color: "var(--text-muted)" }}
              onClick={() => navigate("/characters/new")}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
              Tạo nhân vật mới
            </div>
          </div>
        )}

        <button className="btn-secondary" style={{ marginTop: 28 }} onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
