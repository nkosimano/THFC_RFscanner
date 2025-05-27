import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import { User, AuthState } from '../types';

// --- Types and Interfaces ---
export interface AppAuthState extends AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  session: Session | null;
}

interface AuthContextType {
  state: AppAuthState;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: { fullName: string; role: User['role'] }) => Promise<void>;
  logout: () => Promise<void>;
}

// --- Supabase Initialization ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required in your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AppAuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  session: null
};

// --- Auth Provider Component ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppAuthState>(initialState);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          // User is logged out
          setState({ ...initialState, isLoading: false });
          return;
        }

        // User is logged in, now fetch their profile.
        // The trigger from Step 1 should have already created it.
        const { data: profile, error } = await supabase
          .from('users')
          .select('*') // Fetches all columns
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          // If we can't fetch the profile, something is critically wrong.
          console.error("CRITICAL: Failed to fetch user profile after login.", error);
          await supabase.auth.signOut();
          setState({ ...initialState, isLoading: false, error: "Failed to load user profile. Please contact support." });
          return;
        }

        // Profile found, update the application state
        setState({
          isAuthenticated: true,
          user: {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name, // Note the snake_case from the database
            role: profile.role,
            isActive: profile.is_active,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          },
          isLoading: false,
          error: null,
          session,
        });
      }
    );

    // Cleanup the subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Fallback: reset loading state after 10 seconds if not already reset
      timeoutId = setTimeout(() => {
        setState(prev => ({ ...prev, isLoading: false, error: 'Login timed out. Please try again.' }));
      }, 10000);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setState(prev => ({ ...prev, isLoading: false, error: error.message }));
        throw error;
      }
      // onAuthStateChange will handle the success state.
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, error: err?.message || 'An unexpected error occurred.' }));
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const signUp = async (email: string, password: string, userData: { fullName: string; role: User['role'] }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    // This function now ONLY tells Supabase to create a user.
    // The database trigger you created in Step 1 handles creating the profile.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { // This metadata is passed to the database trigger
          full_name: userData.fullName,
          role: userData.role
        }
      }
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      throw error;
    }
    // onAuthStateChange will handle the new session.
    setState(prev => ({...prev, isLoading: false}));
  };

  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    await supabase.auth.signOut();
    // onAuthStateChange will set the state to logged-out.
  };

  return (
    <AuthContext.Provider value={{ state, login, signUp, logout }}>
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