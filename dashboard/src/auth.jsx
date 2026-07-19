// Auth context: tracks the Firebase user and loads their app profile (role, company)
// from the backend. Wraps the whole app.
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // Firebase user
  const [profile, setProfile] = useState(null); // { user, company } from backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setError(null);
      if (fbUser) {
        try {
          setProfile(await api.me());
        } catch (e) {
          // Signed in to Firebase but not provisioned in a company yet.
          setProfile(null);
          setError(e.message);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (email, password) => {
    setError(null);
    await signInWithEmailAndPassword(auth, email, password);
  };
  const signOut = () => fbSignOut(auth);

  return (
    <AuthCtx.Provider value={{ user, profile, loading, error, login, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
