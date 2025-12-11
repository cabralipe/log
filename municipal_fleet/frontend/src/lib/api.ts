import axios from "axios";

const RAW_API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
const API_URL = RAW_API_URL.replace(/^https:\/\//, "http://");
export const API_ROOT = API_URL;

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh");
      if (!refresh) return Promise.reject(error);
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
        localStorage.setItem("access", data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (e) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.error('Erro de rede detectado:', error);
    }
    return Promise.reject(error);
  }
);

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const driverPortalApi = axios.create({
  baseURL: API_URL,
});

driverPortalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("driver_portal_token");
  if (token) {
    (config.headers as any)["X-Driver-Token"] = token;
  }
  return config;
});
