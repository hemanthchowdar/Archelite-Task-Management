import { create } from 'zustand';
import i18n from '@/i18n';

export type Language = 'en' | 'hi' | 'te';

interface Employee {
  id: string;
  name: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  orgLevel: number;
  avatarUrl?: string;
}

interface AppState {
  // ── Auth ──────────────────────────────
  token: string | null;
  employee: Employee | null;
  isAuthenticated: boolean;
  login: (token: string, employee: Employee) => void;
  logout: () => void;

  // ── Settings ──────────────────────────
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // auth
  token: null,
  employee: null,
  isAuthenticated: false,

  login: (token, employee) =>
    set({ token, employee, isAuthenticated: true }),

  logout: () =>
    set({ token: null, employee: null, isAuthenticated: false }),

  // settings
  language: 'en',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
}));
