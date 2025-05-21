import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthState } from '../types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initial state for authentication
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,
  session: null
};

// Create the auth context
interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: 'field_worker' | 'admin';
  user_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: { fullName: string; role: 'field_worker' | 'admin' }) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // Check for existing session on mount
  useEffect(() => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    // Check active sessions and set the user
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single<ProfileData>();

          if (error) {
            console.error('Error fetching user profile:', error);
            // Sign out and reset state if user profile fails to load
            await supabase.auth.signOut();
            setState({ ...initialState, isLoading: false, error: 'Failed to load user profile.' });
            return;
          }

          if (userData) {
            // Check if user is inactive
            if (!userData.is_active) {
              await supabase.auth.signOut();
              setState({ ...initialState, isLoading: false, error: 'Your account is inactive.' });
              return;
            }
            setState({
              isAuthenticated: true,
              user: {
                id: session.user.id,
                email: session.user.email || '',
                fullName: userData.full_name,
                role: userData.role,
                userCode: userData.user_code,
                isActive: userData.is_active,
                createdAt: userData.created_at,
                updatedAt: userData.updated_at || userData.created_at
              },
              isLoading: false,
              error: null,
              session
            });
          }
        } else {
          setState(initialState);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        throw signInError;
      }

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed. Please check your credentials.'
      }));
    }
  };
  
  // Sign up function
  const signUp = async (email: string, password: string, userData: { fullName: string; role: 'field_worker' | 'admin' }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Generate a random user code
      const userCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create the user in Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.fullName
          }
        }
      });
      
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');
      
      // Add user to users table
      const { error: userInsertError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            full_name: userData.fullName,
            email,
            role: userData.role,
            user_code: userCode,
            is_active: true
          }
        ]);
      
      if (userInsertError) throw userInsertError;
      
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Sign up failed. Please try again.'
      }));
      throw error;
    }
  };
  
  // Logout function
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      // The onAuthStateChange listener will handle the state update
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to log out.'
      }));
      throw error;
    }
  };
  
  // Reset password function
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to send password reset email.'
      }));
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        signUp,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};