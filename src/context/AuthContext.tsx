import { auth, db, isFirebaseConfigured } from '@/src/services/firebase';
import type { UserProfile } from '@/src/types/models';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

interface AuthValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  async function loadProfile(currentUser: User) {
    if (!db) return;
    const profileRef = doc(db, 'users', currentUser.uid);
    const snapshot = await getDoc(profileRef);
    if (snapshot.exists()) {
      const nextProfile = { uid: currentUser.uid, ...snapshot.data() } as UserProfile;
      setProfile(nextProfile);
      setDoc(doc(db, 'leaderboard', currentUser.uid), { uid: currentUser.uid, displayName: nextProfile.displayName || 'Người học' }, { merge: true }).catch(() => undefined);
      return;
    }

    const fallbackProfile = {
      displayName: currentUser.displayName || 'Người học',
      email: currentUser.email || '',
      reminderEnabled: false,
      reminderHour: 20,
      reminderMinute: 0,
      createdAt: serverTimestamp(),
    };
    await setDoc(profileRef, fallbackProfile);
    setDoc(doc(db, 'leaderboard', currentUser.uid), { uid: currentUser.uid, displayName: fallbackProfile.displayName }, { merge: true }).catch(() => undefined);
    setProfile({ uid: currentUser.uid, ...fallbackProfile, createdAt: null });
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      try {
        if (nextUser) await loadProfile(nextUser);
        else setProfile(null);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    profile,
    loading,
    configured: isFirebaseConfigured,
    async signIn(email, password) {
      if (!auth) throw new Error('Firebase chưa được cấu hình.');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    async signUp(name, email, password) {
      if (!auth || !db) throw new Error('Firebase chưa được cấu hình.');
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', credential.user.uid), {
        displayName: name.trim(),
        email: email.trim().toLowerCase(),
        reminderEnabled: false,
        reminderHour: 20,
        reminderMinute: 0,
        createdAt: serverTimestamp(),
      });
      await loadProfile(credential.user);
    },
    async signOut() {
      if (auth) await firebaseSignOut(auth);
    },
    async refreshProfile() {
      if (user) await loadProfile(user);
    },
  }), [loading, profile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider.');
  return value;
}
