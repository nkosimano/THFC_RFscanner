/*
  # Create users table

  1. New Tables
    - `users` 
      - `id` (uuid, primary key)
      - `full_name` (text, not null)
      - `email` (text, unique, not null)
      - `user_code` (text, unique, not null)
      - `hashed_short_code` (text, not null)
      - `role` (text, not null)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on users table
    - Add policy for authenticated admins to read all users
    - Add policy for users to read their own data
    - Add policy for admins to insert new users
    - Add policy for admins to update users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  user_code text UNIQUE NOT NULL,
  hashed_short_code text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'field_worker')),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on user_code for faster lookups
CREATE INDEX IF NOT EXISTS users_user_code_idx ON users (user_code);

-- Create index on role for filtering
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
-- Admin users can read all users
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Users can read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Only admins can insert new users
CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Only admins can update users
CREATE POLICY "Admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');