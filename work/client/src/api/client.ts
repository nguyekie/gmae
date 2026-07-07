import axios from "axios";

// Đổi giá trị này bằng URL backend thật khi deploy (hoặc dùng biến môi trường VITE_API_URL)
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

export const api = axios.create({ baseURL: `${API_BASE_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("etheria_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("etheria_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const SOCKET_URL = API_BASE_URL;
