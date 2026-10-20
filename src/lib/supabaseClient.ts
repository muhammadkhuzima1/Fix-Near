import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';

const STORAGE_KEY = 'fixnear_supabase_config';

/**
 * Normalizes a Supabase URL by trimming whitespace, removing trailing slashes,
 * and stripping accidental API subpaths like /rest/v1, /auth/v1, /realtime/v1, or /storage/v1.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/(rest|auth|realtime|storage)\/v1$/i, '');
  return cleaned.replace(/\/+$/, '');
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const rawEnvUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    '';

  const rawEnvKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    '';

  const envUrl = normalizeSupabaseUrl(String(rawEnvUrl));
  const envKey = String(rawEnvKey).trim();

  // If environment variables are configured (e.g. on Vercel), prioritize them
  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      isConnected: true,
    };
  }

  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const url = normalizeSupabaseUrl(parsed.url || envUrl || '');
      const anonKey = String(parsed.anonKey || envKey || '').trim();
      return {
        url,
        anonKey,
        isConnected: Boolean(url && anonKey),
      };
    } catch {
      // ignore malformed storage
    }
  }

  return {
    url: envUrl,
    anonKey: envKey,
    isConnected: Boolean(envUrl && envKey),
  };
}

export function saveSupabaseConfig(config: { url: string; anonKey: string }): void {
  const cleanUrl = normalizeSupabaseUrl(config.url);
  const cleanKey = config.anonKey.trim();
  const isConnected = Boolean(cleanUrl && cleanKey);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      url: cleanUrl,
      anonKey: cleanKey,
      isConnected,
    })
  );
  // Reset cached client to force re-instantiation with new credentials
  cachedClient = null;
}

export async function testSupabaseCredentials(
  url: string,
  anonKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanKey = anonKey.trim();
    if (!cleanUrl || !cleanKey) {
      return { success: false, error: 'Both Supabase URL and Anon Key are required.' };
    }
    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Check connectivity to Supabase
    const { error } = await testClient.from('profiles').select('count', { count: 'exact', head: true });
    if (error && error.message && error.message.includes('Failed to fetch')) {
      return { success: false, error: 'Network error or invalid Supabase URL: ' + error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' };
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (cachedClient && cachedUrl === config.url && cachedKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedUrl = config.url;
    cachedKey = config.anonKey;
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const config = getStoredSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export const SUPABASE_SQL_SCHEMA = `-- FixNear Production PostgreSQL / Supabase Migration
-- Schema Version: 1.0.0
-- Compliant with Role-Based Access Control (Customer, Technician, Manager)

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'technician', 'manager');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE service_status AS ENUM (
    'pending',
    'approved',
    'assigned',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'emergency');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Technician Profiles (Only for role = 'technician')
CREATE TABLE IF NOT EXISTS public.technician_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  additional_skills TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_job', 'off_duty')),
  rating NUMERIC(3,2) DEFAULT 5.00 NOT NULL,
  completed_jobs_count INTEGER DEFAULT 0 NOT NULL,
  experience_years INTEGER,
  license_number TEXT,
  hourly_rate NUMERIC(10,2),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Service Requests Table
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  priority priority_level DEFAULT 'medium' NOT NULL,
  status service_status DEFAULT 'pending' NOT NULL,
  service_address JSONB NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_technician_name TEXT,
  assigned_technician_phone TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  rejection_reason TEXT,
  work_notes TEXT,
  parts_used JSONB DEFAULT '[]',
  labor_hours NUMERIC(5,2),
  resolution_summary TEXT,
  rating JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Service Request Audit Logs
CREATE TABLE IF NOT EXISTS public.service_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  from_status service_status NOT NULL,
  to_status service_status NOT NULL,
  changed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT NOT NULL,
  changed_by_role user_role NOT NULL,
  note TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  request_id UUID REFERENCES public.service_requests(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false NOT NULL,
  type TEXT DEFAULT 'status_change' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security Policies:
-- Profiles
CREATE POLICY "Public profiles can be read by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Managers full access to profiles
CREATE POLICY "Managers can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

-- Technician Profiles
CREATE POLICY "Authenticated can view technician profiles"
  ON public.technician_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Technicians can update own profile"
  ON public.technician_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Managers can manage technician profiles"
  ON public.technician_profiles FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

-- Service Requests
CREATE POLICY "Customers view own requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Customers create own requests"
  ON public.service_requests FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers cancel own pending requests"
  ON public.service_requests FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid() AND status = 'pending');

CREATE POLICY "Technicians view assigned requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (assigned_technician_id = auth.uid());

CREATE POLICY "Technicians update assigned requests"
  ON public.service_requests FOR UPDATE
  TO authenticated
  USING (assigned_technician_id = auth.uid());

CREATE POLICY "Managers full access to service requests"
  ON public.service_requests FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

-- Logs & Notifications
CREATE POLICY "Authenticated read logs"
  ON public.service_request_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert logs"
  ON public.service_request_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Authenticated insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
`;
