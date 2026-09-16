import { create } from 'zustand';

/**
 * Auth state. The access token lives ONLY in memory (never localStorage); the
 * refresh token is an httpOnly cookie the browser manages, invisible to JS.
 */
export const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: ({ accessToken, user }) =>
    set((state) => ({
      accessToken: accessToken ?? state.accessToken,
      user: user ?? state.user,
      isAuthenticated: true,
    })),

  clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
