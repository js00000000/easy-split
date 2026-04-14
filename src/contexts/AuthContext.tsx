import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  handleGoogleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
        setAuthLoading(false);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Auth error:", error);
          setAuthError(error.message);
          setAuthLoading(false);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google login error:", error);
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error: any) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, authError, handleGoogleLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
