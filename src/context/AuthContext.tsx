import { auth, db, isFirebaseConfigured } from '@/src/services/firebase';
import { signInWithGoogle as googleSignIn, signOutGoogleSession } from '@/src/services/googleAuthService';
import type { UserProfile } from '@/src/types/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  signInWithGoogle(): Promise<boolean>;
  signUp(name: string, email: string, password: string): Promise<void>;
  updateDisplayName(name: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const PROFILE_CACHE_PREFIX = 'dolphinlingo:profile:';

type CachedProfile = Pick<
  UserProfile,
  'uid' | 'displayName' | 'email' | 'avatarId' | 'reminderEnabled' | 'reminderHour' | 'reminderMinute'
>;

function profileCacheKey(uid: string) {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

function fallbackProfileFor(currentUser: User): CachedProfile {
  return {
    uid: currentUser.uid,
    displayName: currentUser.displayName || 'Người học',
    email: currentUser.email || '',
    avatarId: 'avt1',
    reminderEnabled: false,
    reminderHour: 20,
    reminderMinute: 0,
  };
}

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
      if (auth?.currentUser?.uid === currentUser.uid) setProfile(nextProfile);
      const cachedProfile: CachedProfile = {
        uid: currentUser.uid,
        displayName: nextProfile.displayName || 'Người học',
        email: nextProfile.email || currentUser.email || '',
        avatarId: nextProfile.avatarId || 'avt1',
        reminderEnabled: Boolean(nextProfile.reminderEnabled),
        reminderHour: nextProfile.reminderHour ?? 20,
        reminderMinute: nextProfile.reminderMinute ?? 0,
      };
      AsyncStorage.setItem(profileCacheKey(currentUser.uid), JSON.stringify(cachedProfile)).catch(() => undefined);
      setDoc(doc(db, 'leaderboard', currentUser.uid), { uid: currentUser.uid, displayName: nextProfile.displayName || 'Người học', avatarId: nextProfile.avatarId || 'avt1' }, { merge: true }).catch(() => undefined);
      return;
    }

    const fallbackProfile = {
      displayName: currentUser.displayName || 'Người học',
      email: currentUser.email || '',
      avatarId: 'avt1',
      reminderEnabled: false,
      reminderHour: 20,
      reminderMinute: 0,
      createdAt: serverTimestamp(),
    };
    await setDoc(profileRef, fallbackProfile);
    setDoc(doc(db, 'leaderboard', currentUser.uid), { uid: currentUser.uid, displayName: fallbackProfile.displayName, avatarId: 'avt1' }, { merge: true }).catch(() => undefined);
    const nextProfile = { uid: currentUser.uid, ...fallbackProfile, createdAt: null } as UserProfile;
    if (auth?.currentUser?.uid === currentUser.uid) setProfile(nextProfile);
    AsyncStorage.setItem(profileCacheKey(currentUser.uid), JSON.stringify(fallbackProfileFor(currentUser))).catch(() => undefined);
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (!nextUser) {
        setProfile(null);
        return;
      }

      const fallback = fallbackProfileFor(nextUser);
      setProfile({ ...fallback, createdAt: null } as UserProfile);

      AsyncStorage.getItem(profileCacheKey(nextUser.uid))
        .then((value) => {
          if (!value || auth?.currentUser?.uid !== nextUser.uid) return;
          setProfile({ ...(JSON.parse(value) as CachedProfile), createdAt: null } as UserProfile);
        })
        .catch(() => undefined);

      loadProfile(nextUser).catch(() => undefined);
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
    async signInWithGoogle() {
      if (!auth) throw new Error('Firebase chưa được cấu hình.');
      return googleSignIn(auth);
    },
    async signUp(name, email, password) {
      if (!auth || !db) throw new Error('Firebase chưa được cấu hình.');
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', credential.user.uid), {
        displayName: name.trim(),
        email: email.trim().toLowerCase(),
        avatarId: 'avt1',
        reminderEnabled: false,
        reminderHour: 20,
        reminderMinute: 0,
        createdAt: serverTimestamp(),
      });
      await loadProfile(credential.user);
    },
    async updateDisplayName(name) {
      if (!auth?.currentUser || !db) throw new Error('Firebase chưa được cấu hình.');
      const nextName = name.trim().replace(/\s+/g, ' ');
      await Promise.all([
        updateProfile(auth.currentUser, { displayName: nextName }),
        setDoc(doc(db, 'users', auth.currentUser.uid), {
          displayName: nextName,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(db, 'leaderboard', auth.currentUser.uid), {
          uid: auth.currentUser.uid,
          displayName: nextName,
        }, { merge: true }),
      ]);
      await loadProfile(auth.currentUser);
    },
    async signOut() {
      if (auth) {
        await signOutGoogleSession();
        await firebaseSignOut(auth);
      }
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
