import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api';
import { tokenStorage, userStorage, type StoredUser } from '../utils/storage';

interface AuthContextValue {
  user: StoredUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nickname: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => userStorage.get());

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    if (!result?.token) throw new Error('邮箱或密码错误');
    tokenStorage.set(result.token);
    userStorage.set(result.user);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, nickname: string, password: string) => {
    await authApi.register(email, nickname, password);
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    tokenStorage.clear();
    userStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, isLoggedIn: !!user, login, register, logout }), [user, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return context;
}
