import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from './api/apiConfig'; 

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true, 

  // --- Check Authentication on App Load ---
  checkAuth: () => {
    console.log("🔄 checkAuth: Starting...");
    const token = localStorage.getItem('authToken');
    const userJson = localStorage.getItem('user');

    if (!token || !userJson) {
      console.log("ℹ️ checkAuth: No session found. Guest mode.");
      set({ loading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;

      if (decoded.exp > currentTime) {
        console.log("✅ checkAuth: Session valid.");
        const user = JSON.parse(userJson);
        set({
          user: user,
          token: token,
          isAuthenticated: true,
          loading: false,
        });
      } else {
        console.warn("⚠️ checkAuth: Token expired.");
        get().logout();
      }
    } catch (error) {
      console.error("❌ checkAuth: Token decode failed:", error);
      get().logout();
    }
  },

  // --- Login ---
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");

      localStorage.setItem('authToken', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
      });

      return true;

    } catch (err) {
      console.error("Login Error:", err);
      throw err;
    }
  },

  // --- Google Login with direct User Object fallback ---
  loginWithToken: (token, userData = null) => {
    try {
      let user = userData;

      if (!user) {
        const decoded = jwtDecode(token);
        user = {
          id: decoded.user_id || decoded.sub,
          email: decoded.sub || decoded.email,
          full_name: decoded.name || decoded.full_name || 'User',
        };
      }

      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        token: token,
        user: user,
        isAuthenticated: true,
        loading: false
      });

      return user;
    } catch (error) {
      console.error("External Token Error:", error);
      get().logout();
      return null;
    }
  },

  // --- Logout ---
  logout: () => {
    console.log("👋 Logging out...");
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false, 
    });
  },
}));