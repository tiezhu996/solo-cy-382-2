const TOKEN_KEY = 'tripmatch_token';
const USER_KEY = 'tripmatch_user';

export interface StoredUser { id: number; nickname: string }

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

export const userStorage = {
  get: (): StoredUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as StoredUser : null;
  },
  set: (user: StoredUser) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => localStorage.removeItem(USER_KEY)
};
