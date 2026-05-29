'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

import { firebaseConfig, isFirebaseConfigReady } from './config';

export function getFirebaseApp() {
  if (!isFirebaseConfigReady()) {
    throw new Error(
      'Firebase config is missing. Set NEXT_PUBLIC_FIREBASE_* in apps/frontend/.env.local or fill directConfigOverride in lib/firebase/config.ts.',
    );
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export async function getCurrentUserIdToken(forceRefresh = false): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No Firebase user is signed in on the frontend.');
  }
  return user.getIdToken(forceRefresh);
}
