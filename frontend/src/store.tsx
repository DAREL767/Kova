import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, send, ApiError } from './api';
import type { User, CartItem } from './types';
interface Store {
  user: User | null;
  ready: boolean;
  cart: CartItem[];
  notice: string;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshCart: () => Promise<void>;
  setCart: (items: CartItem[]) => Promise<void>;
  notify: (text: string) => void;
}
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [cart, updateCart] = useState<CartItem[]>([]);
  const [notice, notify] = useState('');
  async function refreshCart() {
    const data = await api<{ items: CartItem[] }>('/shop/cart');
    updateCart(data.items);
  }
  useEffect(() => {
    sessionStorage.removeItem('kova-token');
    api<User>('/auth/me')
      .then(async (u) => {
        setUser(u);
        await refreshCart();
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setReady(true));
    const expired = () => {
      setUser(null);
      updateCart([]);
      notify('Tu sesión terminó. Inicia sesión de nuevo.');
    };
    window.addEventListener('kova-session-expired', expired);
    return () => window.removeEventListener('kova-session-expired', expired);
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => notify(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function login(email: string, password: string) {
    const data = await api<{ user: User }>('/auth/login', send('POST', { email, password }));
    setUser(data.user);
    await refreshCart();
    return data.user;
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      updateCart([]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        updateCart([]);
      } else notify('No pudimos cerrar la sesión. Inténtalo de nuevo.');
    }
  }
  async function setCart(items: CartItem[]) {
    const data = await api<{ items: CartItem[] }>('/shop/cart', send('PUT', { items }));
    updateCart(data.items);
  }
  return (
    <Context.Provider
      value={{ user, ready, cart, notice, login, logout, refreshCart, setCart, notify }}
    >
      {children}
    </Context.Provider>
  );
}
