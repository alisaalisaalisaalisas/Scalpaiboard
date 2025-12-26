import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/api/auth/login', { email, password });
          const { token, user } = response.data;
          
          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Set token for future API calls
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          return true;
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || error.message || 'Login failed',
          });
          return false;
        }
      },

      register: async (email: string, username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/api/auth/register', { email, username, password });
          const { token, user } = response.data;
          
          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          return true;
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || error.message || 'Registration failed',
          });
          return false;
        }
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshToken: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await api.post('/api/auth/refresh');
          const newToken = response.data.token;
          set({ token: newToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        } catch {
          // Token expired, logout
          get().logout();
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        try {
          const response = await api.get('/api/auth/me');
          set({ user: response.data, isAuthenticated: true });
        } catch {
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'scalpaiboard-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
