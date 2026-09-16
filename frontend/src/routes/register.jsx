import { createFileRoute } from '@tanstack/react-router';
import { requireGuest } from '@/lib/guards';
import { RegisterPage } from '@/pages/RegisterPage';

export const Route = createFileRoute('/register')({
  beforeLoad: requireGuest,
  component: RegisterPage,
});
