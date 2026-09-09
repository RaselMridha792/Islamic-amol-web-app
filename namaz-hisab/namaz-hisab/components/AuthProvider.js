'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../lib/cloud';
import { clearPersonCache } from '../lib/store';

const AuthCtx = createContext(null);

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, cloud: false, user: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetchMe();
      setState({ loading: false, cloud: Boolean(res.cloud), user: res.user || null });
      return res.user || null;
    } catch (err) {
      // সার্ভারে পৌঁছানো গেল না — লগইনের পাতা দেখাই, ভাঙা পাতা নয়
      setState({ loading: false, cloud: false, user: null });
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    setState({ loading: false, cloud: true, user: res.user });
    return res.user;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const res = await apiRegister(username, password, displayName);
    setState({ loading: false, cloud: true, user: res.user });
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      // সার্ভারে না পৌঁছালেও এই ডিভাইসে বের করে দিই
    }
    // সঙ্গীর নাম-ছবি যেন এই ডিভাইসে পড়ে না থাকে
    clearPersonCache();
    setState((s) => ({ ...s, user: null }));
  }, []);

  return (
    <AuthCtx.Provider value={{ ...state, refresh, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
