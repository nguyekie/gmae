import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function Register() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { username, email, password });
      login(res.data.token, res.data.user);
      navigate("/characters");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-title">Tàn Tích Etheria</div>
        <div className="auth-subtitle">Tạo tài khoản để bắt đầu Thức Tỉnh</div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Tên đăng nhập</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text-muted)" }}>
          Đã có tài khoản? <Link to="/login" style={{ color: "var(--accent-shard)" }}>Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
