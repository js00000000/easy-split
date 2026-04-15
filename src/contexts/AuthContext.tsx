import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult,
  signOut,
  deleteUser,
} from 'firebase/auth';
import type { User, AuthError } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc 
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { AbandonGuestConfirmationModal } from '../components/MergeConfirmationModal';
import type { UserSettings } from '../types';

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  handleGoogleLogin: () => Promise<void>;
  handleGuestLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAbandonGuestConfirm, setShowAbandonGuestConfirm] = useState(false);

  useEffect(() => {
    // Handle redirect result (for cases where popup was blocked)
    getRedirectResult(auth).catch((error: unknown) => {
      console.error("Redirect error catch:", error);
      const authErr = error as AuthError;
      if (authErr.code === 'auth/credential-already-in-use') {
        // If they tried to link a Google account that already exists via redirect, 
        // we show the confirmation instead of auto-signing in
        setShowAbandonGuestConfirm(true);
      } else {
        setAuthError(authErr.message || "An error occurred during redirect.");
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          await linkWithPopup(auth.currentUser, googleProvider);
        } catch (err: unknown) {
          const error = err as AuthError;
          if (error.code === 'auth/popup-blocked') {
            await linkWithRedirect(auth.currentUser, googleProvider);
          } else if (error.code === 'auth/credential-already-in-use') {
            // Google account already exists, show confirmation before switching
            setShowAbandonGuestConfirm(true);
            setAuthLoading(false);
          } else {
            throw error;
          }
        }
      } else {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (err: unknown) {
          const error = err as AuthError;
          if (error.code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw error;
          }
        }
      }
    } catch (err: unknown) {
      const error = err as AuthError;
      console.error("Google login error:", error);
      setAuthError(error.message || "Failed to sign in with Google.");
      setAuthLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setAuthLoading(true);
      await signInAnonymously(auth);
    } catch (err: unknown) {
      const error = err as AuthError;
      console.error("Guest login error:", error);
      setAuthError(error.message || "Failed to sign in as guest.");
      setAuthLoading(false);
    }
  };

  const confirmAbandon = async () => {
    try {
      setAuthLoading(true);
      setShowAbandonGuestConfirm(false);
      
      const guestUser = auth.currentUser;
      if (guestUser && guestUser.isAnonymous) {
        const guestUid = guestUser.uid;
        
        // 1. Find all groups created by this guest user
        const createdGroupsQuery = query(collection(db, 'groups'), where('createdBy', '==', guestUid));
        const createdGroupsSnap = await getDocs(createdGroupsQuery);
        const deletedGroupIds = new Set<string>();

        for (const groupDoc of createdGroupsSnap.docs) {
          const gid = groupDoc.id;
          try {
            // Delete all expenses in the group
            const expensesSnap = await getDocs(collection(db, 'groups', gid, 'expenses'));
            for (const expDoc of expensesSnap.docs) {
              await deleteDoc(expDoc.ref);
            }
            // Delete all members in the group
            const membersSnap = await getDocs(collection(db, 'groups', gid, 'members'));
            for (const memberDoc of membersSnap.docs) {
              await deleteDoc(memberDoc.ref);
            }
            // Finally delete the group document
            await deleteDoc(groupDoc.ref);
            deletedGroupIds.add(gid);
          } catch (err) {
            console.error(`Error deleting group ${gid} and its data:`, err);
          }
        }

        // 2. Get user settings to find other joined groups
        const userDoc = await getDoc(doc(db, 'users', guestUid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserSettings;
          const joinedGroupIds = userData.joinedGroupIds || [];
          
          // 3. Clear userId from members in other groups the user joined but didn't create
          for (const gid of joinedGroupIds) {
            if (deletedGroupIds.has(gid)) continue;
            
            try {
              const membersRef = collection(db, 'groups', gid, 'members');
              const membersSnap = await getDocs(query(membersRef, where('userId', '==', guestUid)));
              for (const memberDoc of membersSnap.docs) {
                await updateDoc(memberDoc.ref, { userId: null });
              }
            } catch (err) {
              console.error(`Error clearing userId in group ${gid}:`, err);
            }
          }
          
          // 4. Delete user document
          await deleteDoc(doc(db, 'users', guestUid));
        }
        
        // 5. Delete the guest user from Auth
        await deleteUser(guestUser).catch(err => {
          console.error("Error deleting guest user from Auth:", err);
        });
      }

      // 6. Sign in with Google
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err: unknown) {
        const popupError = err as AuthError;
        if (popupError.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw popupError;
        }
      }
    } catch (err: unknown) {
      const error = err as AuthError;
      console.error("Confirm abandon error:", error);
      setAuthError(error.message || "Failed to switch account.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: unknown) {
      const error = err as AuthError;
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, authError, handleGoogleLogin, handleGuestLogin, handleLogout }}>
      {children}
      {showAbandonGuestConfirm && (
        <AbandonGuestConfirmationModal
          onClose={() => setShowAbandonGuestConfirm(false)}
          onConfirm={confirmAbandon}
        />
      )}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

