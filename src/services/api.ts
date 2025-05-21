import type { Database } from '../types/supabase';
import { supabase } from '../contexts/AuthContext';

// Base URL for all API requests
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type UserRow = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];

// Field Worker Lambda function for Zoho integration
// Replace CrateData and LambdaResponse with inferred types
export type SubmitCrateData = {
  crate_id_input: string;
  bread_quantity: number;
  device_scan_id?: string;
  is_offline_scan?: boolean;
};

export type SubmitCrateResponse = {
  success: boolean;
  error?: string;
};

export const submitCrateData = async (crateData: SubmitCrateData): Promise<SubmitCrateResponse> => {
  try {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/submitCrateDataToZoho`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(crateData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to submit crate data');
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error. Please try again.',
    };
  }
};

// Admin functions using Supabase directly

// Create a new crate in Zoho via backend
export const createCrateInZoho = async (crateData: any): Promise<{ crate_id: string }> => {
  const { data, error } = await supabase.functions.invoke('createCrateInZoho', {
    body: crateData,
  });
  if (error) throw error;
  return data;
};

// Fetch crate details from Zoho via backend
export const fetchCrateDetails = async (crateId: string): Promise<any> => {
  const { data, error } = await supabase.functions.invoke('fetchCrateDetails', {
    body: { crateId },
  });
  if (error) throw error;
  return data;
};

export const listUsers = async (): Promise<UserRow[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) throw error;
  return data as UserRow[];
};

export const createUser = async (
  userData: Omit<UserInsert, 'id' | 'created_at' | 'updated_at' | 'last_login_at' | 'status' | 'hashed_password'> & { password: string }
): Promise<UserRow> => {
  try {
    // 1. Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.full_name,
        },
      },
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('Failed to create user');

    // 2. Insert user into users table
    const insertUser: UserInsert = {
      id: authData.user.id,
      user_code: userData.user_code,
      full_name: userData.full_name,
      email: userData.email,
      role: userData.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    };
    const { data: userRow, error: userInsertError } = await supabase
      .from('users')
      .insert([insertUser])
      .select()
      .single();
    if (userInsertError) throw userInsertError;
    return userRow as UserRow;
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new Error(error.message || 'Failed to create user');
  }
};