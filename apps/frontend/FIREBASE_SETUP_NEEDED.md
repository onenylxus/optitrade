# Frontend Firebase Configuration Needed

## Issue
Frontend shows: **"Firebase config missing. Set NEXT_PUBLIC_FIREBASE_* environment variables."**

## What's Missing
The frontend needs **Firebase Web SDK configuration** (different from the backend's service account JSON).

## What to Ask Your Colleague

Send this message to your colleague:

```
Hi! I need the Firebase Web SDK configuration for the frontend. 

Can you provide these values from Firebase Console?
(Project Settings > Your apps > Web app > SDK setup and configuration)

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

Or just share the firebaseConfig object from the Firebase Console.
```

## How to Get These Values Yourself

If you have access to Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **optitrade-hku**
3. Click ⚙️ (Settings) > **Project settings**
4. Scroll down to **Your apps** section
5. Find the **Web app** (or create one if none exists)
6. Click **Config** radio button (not npm)
7. Copy the values from the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",              // ← NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "optitrade-hku.firebaseapp.com",  // ← NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "optitrade-hku",     // ← NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "optitrade-hku.firebasestorage.app",  // ← NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789", // ← NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123456789:web:abc123", // ← NEXT_PUBLIC_FIREBASE_APP_ID
  measurementId: "G-XXXXXXXXXX"   // ← NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)
};
```

## Where to Put These Values

I've created `apps/frontend/.env.local` for you. Fill in the values:

```bash
# File: apps/frontend/.env.local

NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=optitrade-hku.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=optitrade-hku
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=optitrade-hku.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## After Adding Values

1. **Restart the frontend dev server:**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart:
   npx nx run @optitrade/frontend:dev
   ```

2. **Test sign-in:**
   - Go to http://localhost:3000/auth
   - Click "Sign in"
   - Error should be gone!

## Important Notes

- ⚠️ **Different from backend:** Backend uses service account JSON, frontend uses web SDK config
- ✅ **Already have:** `NEXT_PUBLIC_FIREBASE_PROJECT_ID=optitrade-hku` (I filled this in)
- 🔒 **Security:** These are **public** values (safe to use in frontend), unlike the backend service account
- 📝 **File location:** `apps/frontend/.env.local` (already created, just needs values filled in)

## Alternative: Quick Test (Not Recommended for Production)

If you just want to test quickly, you can hardcode values in:
`apps/frontend/lib/firebase/config.ts` in the `directConfigOverride` object.

But using `.env.local` is the recommended approach.
