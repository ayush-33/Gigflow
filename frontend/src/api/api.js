import axios from "axios";
import { getAccessToken, setAccessToken, clearAccessToken } from "../utils/auth";
import { connectSocket } from "../utils/socket";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    const status = error.response?.status;
    const code   = error.response?.data?.code;

    const isAuthRoute =
      original.url.includes("/auth/login") ||
      original.url.includes("/auth/refresh");

    // Not a 401 or is an auth route — just reject, no refresh attempt
    if (status !== 401 || isAuthRoute) return Promise.reject(error);

    // 401 but not because token expired — wrong token, missing token etc
    if (code !== "TOKEN_EXPIRED") return Promise.reject(error);

    // Token is expired — attempt refresh
    if (original._retry) return Promise.reject(error);
    original._retry = true;

    console.log("🔄 Token expired, attempting refresh...");  // ← add this


    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(
        "http://localhost:5000/api/auth/refresh",
        {},
        { withCredentials: true }
      );

      setAccessToken(data.accessToken);
      connectSocket();
      processQueue(null, data.accessToken);

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);

    } catch (err) {
      processQueue(err, null);
      clearAccessToken();
      localStorage.removeItem("user");
      window.location.href = "/login";
      return Promise.reject(err);

    } finally {
      isRefreshing = false;
    }
  }
);

export default api;