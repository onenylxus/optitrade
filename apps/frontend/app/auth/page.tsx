import type { Metadata } from 'next';

import { AuthPortal } from '@/components/auth/auth-portal';

export const metadata: Metadata = {
  title: 'Auth | OptiTrade',
  description: 'Sign in to OptiTrade with Firebase and sync your Firestore-backed profile.',
};

export default function AuthPage() {
  return <AuthPortal />;
}
