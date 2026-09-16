import { redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth';

/** beforeLoad guard for protected routes. */
export function requireAuth() {
  if (!useAuthStore.getState().isAuthenticated) {
    throw redirect({ to: '/login' });
  }
}

/** beforeLoad guard for auth pages — bounce logged-in users to the dashboard. */
export function requireGuest() {
  if (useAuthStore.getState().isAuthenticated) {
    throw redirect({ to: '/' });
  }
}
