import axios from "axios";

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
export const API_BASE = rawApiUrl && !/^https?:\/\//i.test(rawApiUrl) ? `https://${rawApiUrl}` : rawApiUrl;

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});
