import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { CharacterSelect } from "./pages/CharacterSelect";
import { CreateCharacter } from "./pages/CreateCharacter";
import { Dashboard } from "./pages/Dashboard";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/characters"
          element={
            <RequireAuth>
              <CharacterSelect />
            </RequireAuth>
          }
        />
        <Route
          path="/characters/new"
          element={
            <RequireAuth>
              <CreateCharacter />
            </RequireAuth>
          }
        />
        <Route
          path="/play/:characterId/*"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/characters" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
