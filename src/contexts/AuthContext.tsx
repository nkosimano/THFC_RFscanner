import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { User, AuthState } from '../types/index.js';
import { supabase } from '../lib/supabase';

// --- Types and Interfaces ---
export interface AppAuthState extends AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  session: Session | null;
  isOnline: boolean;
  lastSyncTime: number | null;
}

interface AuthContextType {
  state: AppAuthState;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: { fullName: string; role: User['role'] }) => Promise<void>;
  logout: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds
const AUTH_TIMEOUT = 15000; // 15 seconds
const SESSION_STORAGE_KEY = 'auth_session_cache';

const initialState: AppAuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  session: null,
  isOnline: navigator.onLine,
  lastSyncTime: null
};

// Utility function for retrying operations
const retryOperation = async <T,>(
  operation: () => Promise<T>,
  attempts: number = RETRY_ATTEMPTS,
  delay: number = RETRY_DELAY
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (attempts <= 1) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryOperation(operation, attempts - 1, delay);
  }
};

// --- Auth Provider Component ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppAuthState>(initialState);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      // Try to sync when coming back online
      checkConnection().then(online => {
        if (online && state.session) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              setState(prev => ({ 
                ...prev, 
                session,
                lastSyncTime: Date.now()
              }));
            }
          });
        }
      });
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Session persistence
  useEffect(() => {
    if (state.session) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        session: state.session,
        user: state.user,
        timestamp: Date.now()
      }));
    }
  }, [state.session, state.user]);

  // Initial session recovery
  useEffect(() => {
    const cachedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (cachedData) {
      const { session, user, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) { // 24 hours
        setState(prev => ({
          ...prev,
          session,
          user,
          isAuthenticated: true,
          lastSyncTime: timestamp
        }));
      }
    }
  }, []);

  const checkConnection = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/auth/v1/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          setState(prev => ({ ...prev, ...initialState, isLoading: false }));
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          return;
        }

        try {
          const { data: profile, error } = await retryOperation(async () => 
            supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()
          );

          if (error || !profile) {
            throw new Error("Failed to fetch user profile");
          }

          setState({
            isAuthenticated: true,
            user: {
              id: profile.id,
              email: profile.email,
              fullName: profile.full_name,
              role: profile.role,
              isActive: profile.is_active,
              createdAt: profile.created_at,
              updatedAt: profile.updated_at,
            },
            isLoading: false,
            error: null,
            session,
            isOnline: true,
            lastSyncTime: Date.now()
          });
        } catch (err) {
          // If offline, try to use cached data
          const cachedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
          if (cachedData) {
            const { user } = JSON.parse(cachedData);
            setState(prev => ({
              ...prev,
              isAuthenticated: true,
              user,
              session,
              isLoading: false,
              error: 'Working in offline mode. Some features may be limited.',
              isOnline: false
            }));
          } else {
            console.error("Failed to load user profile:", err);
            await supabase.auth.signOut();
            setState(prev => ({
              ...prev,
              ...initialState,
              isLoading: false,
              error: "Network error. Please check your connection and try again."
            }));
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const isConnected = await checkConnection();
      if (!isConnected) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      const loginPromise = retryOperation(async () => 
        supabase.auth.signInWithPassword({ email, password })
      );

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Login request timed out. Please check your connection and try again.'));
        }, AUTH_TIMEOUT);
      });

      const result = await Promise.race([loginPromise, timeoutPromise]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      if (result.error) {
        let errorMessage = 'Invalid email or password. Please try again.';
        if (result.error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before logging in.';
        } else if (result.error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
        throw new Error(errorMessage);
      }

      if (!result.data?.session) {
        throw new Error('Login failed. Please try again.');
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Login failed. Please try again.';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const signUp = async (email: string, password: string, userData: { fullName: string; role: User['role'] }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const isConnected = await checkConnection();
      if (!isConnected) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      const { error } = await retryOperation(async () =>
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: userData.fullName,
              role: userData.role
            }
          }
        })
      );

      if (error) {
        setState(prev => ({ ...prev, isLoading: false, error: error.message }));
        throw error;
      }

      setState(prev => ({...prev, isLoading: false}));
    } catch (err: any) {
      const errorMessage = err?.message || 'Sign up failed. Please try again.';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw err;
    }
  };

  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await retryOperation(async () => supabase.auth.signOut());
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      console.error('Logout error:', err);
      // Force logout locally even if the server request fails
      setState({ ...initialState, isLoading: false });
    }
  };

  return (
    <AuthContext.Provider value={{ state, login, signUp, logout, checkConnection }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Custom Hook ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};