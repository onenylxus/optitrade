'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { syncBackendAuthSession } from '@/lib/api/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { isFirebaseConfigReady } from '@/lib/firebase/config';

type AuthMode = 'signin' | 'register';

export function AuthPortal() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const router = useRouter();
  const [firebaseAuth] = useState<ReturnType<typeof getFirebaseAuth> | null>(() => {
    if (!isFirebaseConfigReady()) return null;
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!isFirebaseConfigReady()) {
      return 'Firebase config missing. Set NEXT_PUBLIC_FIREBASE_* environment variables.';
    }
    try {
      getFirebaseAuth();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Unable to initialize Firebase.';
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Firebase is initialized lazily above; avoid setting state synchronously in an effect.

  useEffect(() => {
    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);

      if (!user) {
        setErrorMessage(null);
        return;
      }

      try {
        const idToken = await user.getIdToken(true);
        await syncBackendAuthSession(idToken);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to sync profile.');
      } finally {
        router.replace('/');
      }
    });

    return unsubscribe;
  }, [firebaseAuth, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseAuth) {
      setErrorMessage('Firebase is not ready yet.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (authMode === 'register') {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (displayName.trim()) {
          await updateProfile(credential.user, { displayName: displayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isAuthenticated = firebaseUser != null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Account Access</CardTitle>
          <CardDescription>
            {isAuthenticated ? 'You are signed in.' : 'Sign in or create an account to continue.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isAuthReady ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Checking your session...
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Redirecting you to the dashboard...
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={authMode === 'signin' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setAuthMode('signin')}
                >
                  Sign In
                </Button>
                <Button
                  type="button"
                  variant={authMode === 'register' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setAuthMode('register')}
                >
                  Register
                </Button>
              </div>

              <form className="space-y-3" onSubmit={handleSubmit}>
                {authMode === 'register' ? (
                  <div className="space-y-1">
                    <label htmlFor="displayName" className="text-xs font-medium text-foreground">
                      Display Name
                    </label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="nickname"
                    />
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-medium text-foreground">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="password" className="text-xs font-medium text-foreground">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Working…'
                    : authMode === 'register'
                      ? 'Create Account'
                      : 'Sign In'}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
