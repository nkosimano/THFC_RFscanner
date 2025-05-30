import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable');
  throw new Error('VITE_SUPABASE_URL is not defined. Please check your environment variables.');
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable');
  throw new Error('VITE_SUPABASE_ANON_KEY is not defined. Please check your environment variables.');
}

if (!supabaseUrl.startsWith('https://')) {
  console.error('Invalid VITE_SUPABASE_URL format:', supabaseUrl);
  throw new Error('VITE_SUPABASE_URL must start with https://');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

// Create a single instance of the Supabase client with retries and timeouts
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'thfc_scanner'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});

// Test the connection immediately
(async () => {
  try {
    const start = Date.now();
    const { error } = await supabaseClient.from('users').select('count').limit(1);
    const duration = Date.now() - start;
    if (error) {
      console.error('Initial Supabase connection test failed:', error.message);
    } else {
      console.log(`Initial Supabase connection test successful (${duration}ms)`);
    }
  } catch (err) {
    console.error('Failed to connect to Supabase:', err);
  }
})();

// Prevent multiple instances
Object.freeze(supabaseClient);

export { supabaseClient as supabase }; 