import { create } from "zustand";

interface User {
  id: string;
  username: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("etheria_token"),
  user: JSON.parse(localStorage.getItem("etheria_user") || "null"),
  login: (token, user) => {
    localStorage.setItem("etheria_token", token);
    localStorage.setItem("etheria_user", JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("etheria_token");
    localStorage.removeItem("etheria_user");
    set({ token: null, user: null });
  },
}));
