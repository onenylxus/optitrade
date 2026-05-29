export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Option A (recommended): fill these using NEXT_PUBLIC_FIREBASE_* vars in apps/frontend/.env.local.
const envConfig: FirebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

// Option B: paste Firebase console values directly in this object.
// Keep it as an override for quick local testing.
const directConfigOverride: Partial<FirebaseWebConfig> = {
  // apiKey: '...'
  // authDomain: '...'
  // projectId: '...'
  // storageBucket: '...'
  // messagingSenderId: '...'
  // appId: '...'
  // measurementId: '...'
};

export const firebaseConfig: FirebaseWebConfig = {
  ...envConfig,
  ...directConfigOverride,
};

export function isFirebaseConfigReady(config: FirebaseWebConfig = firebaseConfig): boolean {
  return Boolean(
    config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.storageBucket &&
    config.messagingSenderId &&
    config.appId,
  );
}
