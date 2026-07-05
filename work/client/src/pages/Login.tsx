import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password });
      login(res.data.token, res.data.user);
      navigate("/characters");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-title">Tàn Tích Etheria</div>
        <div className="auth-subtitle">Đăng nhập để tiếp tục hành trình Người Thức Tỉnh</div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Tên đăng nhập</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text-muted)" }}>
          Chưa có tài khoản? <Link to="/register" style={{ color: "var(--accent-shard)" }}>Tạo tài khoản</Link>
        </p>
      </div>
    </div>
  );
}
