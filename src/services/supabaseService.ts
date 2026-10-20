import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  getStoredSupabaseConfig,
  isSupabaseConfigured,
} from '../lib/supabaseClient';
import {
  User,
  UserRole,
  TechnicianProfile,
  ServiceRequest,
  ServiceRequestLog,
  NotificationItem,
  ServiceCategory,
  PriorityLevel,
  ServiceStatus,
  ServiceAddress,
  PartItem,
  ServiceRating,
  AutoDispatchResult,
  AIDispatchCandidate,
} from '../types';
import { store } from './store';

// Helper to convert snake_case Supabase request to camelCase ServiceRequest
export function mapSupabaseToServiceRequest(row: any): ServiceRequest {
  let parsedAddress: ServiceAddress = {
    street: '',
    city: '',
    state: '',
    zip: '',
  };

  if (row.service_address) {
    if (typeof row.service_address === 'object' && row.service_address !== null) {
      parsedAddress = {
        street: row.service_address.street || '',
        unit: row.service_address.unit || undefined,
        city: row.service_address.city || '',
        state: row.service_address.state || '',
        zip: row.service_address.zip || '',
        contactPhone: row.service_address.contactPhone || row.service_address.contact_phone || undefined,
      };
    } else if (typeof row.service_address === 'string') {
      try {
        const obj = JSON.parse(row.service_address);
        parsedAddress = {
          street: obj?.street || '',
          unit: obj?.unit || undefined,
          city: obj?.city || '',
          state: obj?.state || '',
          zip: obj?.zip || '',
          contactPhone: obj?.contactPhone || obj?.contact_phone || undefined,
        };
      } catch {
        parsedAddress = { street: String(row.service_address), city: '', state: '', zip: '' };
      }
    }
  }

  let parsedParts: PartItem[] = [];
  if (row.parts_used) {
    if (Array.isArray(row.parts_used)) {
      parsedParts = row.parts_used;
    } else if (typeof row.parts_used === 'string') {
      try {
        const arr = JSON.parse(row.parts_used);
        if (Array.isArray(arr)) parsedParts = arr;
      } catch {
        parsedParts = [];
      }
    }
  }

  let parsedRating: ServiceRating | undefined = undefined;
  if (row.rating) {
    if (typeof row.rating === 'object' && row.rating !== null) {
      parsedRating = {
        score: Number(row.rating.score) || 5,
        comment: row.rating.comment || undefined,
        createdAt: row.rating.createdAt || row.rating.created_at || new Date().toISOString(),
      };
    } else if (typeof row.rating === 'string') {
      try {
        const rObj = JSON.parse(row.rating);
        parsedRating = {
          score: Number(rObj?.score) || 5,
          comment: rObj?.comment || undefined,
          createdAt: rObj?.createdAt || rObj?.created_at || new Date().toISOString(),
        };
      } catch {
        parsedRating = undefined;
      }
    }
  }

  return {
    id: row.id,
    ticketNumber: row.ticket_number || `FXN-${String(row.id || '').slice(0, 8) || '0000'}`,
    customerId: row.customer_id,
    customerName: row.customer_name || 'Customer',
    customerPhone: row.customer_phone || '',
    customerEmail: row.customer_email || '',
    title: row.title || 'Service Request',
    category: (row.category || 'general') as ServiceCategory,
    description: row.description || '',
    priority: (row.priority || 'medium') as PriorityLevel,
    status: (row.status || 'pending') as ServiceStatus,
    serviceAddress: parsedAddress,
    preferredDate: row.preferred_date || new Date().toISOString().split('T')[0],
    preferredTimeSlot: row.preferred_time_slot || 'Morning (08:00 AM – 12:00 PM)',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    assignedTechnicianId: row.assigned_technician_id || undefined,
    assignedTechnicianName: row.assigned_technician_name || undefined,
    assignedTechnicianPhone: row.assigned_technician_phone || undefined,
    assignedAt: row.assigned_at || undefined,
    acceptedAt: row.accepted_at || undefined,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    rejectionReason: row.rejection_reason || undefined,
    workNotes: row.work_notes || undefined,
    partsUsed: parsedParts,
    laborHours: row.labor_hours ? Number(row.labor_hours) : undefined,
    resolutionSummary: row.resolution_summary || undefined,
    rating: parsedRating,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// Helper to convert snake_case Supabase log
export function mapSupabaseToLog(row: any): ServiceRequestLog {
  return {
    id: row.id,
    requestId: row.request_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByUserId: row.changed_by_user_id,
    changedByName: row.changed_by_name,
    changedByRole: row.changed_by_role as UserRole,
    note: row.note,
    timestamp: row.timestamp,
  };
}

// Helper to convert snake_case Supabase notification
export function mapSupabaseToNotification(row: any): NotificationItem {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    title: row.title,
    message: row.message,
    requestId: row.request_id || undefined,
    isRead: row.is_read,
    createdAt: row.created_at,
    type: row.type as any,
  };
}

export class SupabaseService {
  /**
   * AUTHENTICATION
   */
  public static isSigningIn = false;

  // Fetch user profile from public.profiles strictly
  public static async getProfile(userId: string, userEmail?: string): Promise<User | null> {
    const client = getSupabaseClient();
    if (!client) {
      const local =
        store.getUserById(userId) || (userEmail ? store.getUserByEmail(userEmail) : undefined);
      return local || null;
    }

    try {
      let { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Fallback lookup by email if profile row was queried before ID sync
      if (!data && userEmail) {
        const emailLookup = await client
          .from('profiles')
          .select('*')
          .ilike('email', userEmail.trim())
          .maybeSingle();
        if (!emailLookup.error && emailLookup.data) {
          data = emailLookup.data;
        }
      }

      if (error || !data) {
        console.error('Error fetching public.profiles:', error);
        return null;
      }

      const normalizedRole = String(data.role || '')
        .trim()
        .toLowerCase();

      // STRICT: Validate role exists and is in customer | technician | manager
      if (!normalizedRole || !['customer', 'technician', 'manager'].includes(normalizedRole)) {
        console.error('CRITICAL: Invalid or missing role in public.profiles for user:', userId);
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name || data.email,
        role: normalizedRole as UserRole,
        phone: data.phone || '',
        createdAt: data.created_at,
      };
    } catch (e) {
      console.error('Exception fetching profile:', e);
      return null;
    }
  }

  // Sign In with Supabase Auth
  public static async signIn(
    email: string,
    password: string,
    portalRole?: UserRole
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const client = getSupabaseClient();

    // Fallback to local store only if Supabase is not configured
    if (!client) {
      const user = store.getUserByEmail(email);
      if (!user) {
        return { success: false, error: 'User not found in local records.' };
      }
      if (portalRole && user.role !== portalRole) {
        return {
          success: false,
          error: `This account is authorized as a ${user.role.toUpperCase()}, not a ${portalRole.toUpperCase()}. Please sign in through the ${user.role.toUpperCase()} portal.`,
        };
      }
      store.setCurrentUserId(user.id);
      return { success: true, user };
    }

    this.isSigningIn = true;
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        return { success: false, error: error?.message || 'Invalid credentials' };
      }

      // Fetch profile strictly from public.profiles
      const profile = await this.getProfile(data.user.id, data.user.email || email);
      if (!profile) {
        await client.auth.signOut();
        return {
          success: false,
          error: `Authenticated in Supabase Auth (${data.user.email}), but no profile record was found in public.profiles for user ID ${data.user.id}. Please ensure a matching row exists in public.profiles with role = '${portalRole || 'customer'}'.`,
        };
      }

      if (profile.fullName.startsWith('[Removed]')) {
        await client.auth.signOut();
        return {
          success: false,
          error: 'This account has been removed by Operations Management. Access is revoked.',
        };
      }

      // Enforce portal match
      if (portalRole && profile.role !== portalRole) {
        await client.auth.signOut();
        return {
          success: false,
          error: `This account is authorized as a ${profile.role.toUpperCase()}, not a ${portalRole.toUpperCase()}. Please sign in through the ${profile.role.toUpperCase()} portal.`,
        };
      }

      // If technician, verify technician profile is active
      if (portalRole === 'technician') {
        const techProf = await this.getTechnicianProfile(profile.id);
        if (!techProf) {
          await client.auth.signOut();
          return {
            success: false,
            error: 'This technician account has been removed or deactivated by Operations Management. Access is revoked.',
          };
        }
      }

      // Sync to local active cache for fast rendering
      store.setCurrentUserId(profile.id);
      return { success: true, user: profile };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication error' };
    } finally {
      this.isSigningIn = false;
    }
  }

  // Customer Signup (Creates ONLY role = 'customer')
  public static async signUpCustomer(params: {
    email: string;
    password?: string;
    fullName: string;
    phone: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.registerCustomer(params);
    }

    try {
      const pwd = params.password || 'customer123';
      const { data: authData, error: authError } = await client.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: pwd,
        options: {
          data: {
            full_name: params.fullName.trim(),
            phone: params.phone.trim(),
            role: 'customer', // STRICT: customer ONLY
          },
        },
      });

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || 'Failed to create customer account.' };
      }

      // Explicitly insert into public.profiles with role = 'customer'
      const { error: profileError } = await client.from('profiles').upsert(
        {
          id: authData.user.id,
          email: params.email.trim().toLowerCase(),
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          role: 'customer', // STRICT: customer ONLY
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        console.warn('Upsert into profiles warning:', profileError);
      }

      const user: User = {
        id: authData.user.id,
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName.trim(),
        role: 'customer',
        phone: params.phone.trim(),
        createdAt: new Date().toISOString(),
      };

      store.setCurrentUserId(user.id);
      return { success: true, user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration error' };
    }
  }

  // Manager creates Technician (Strict role = 'technician')
  public static async createTechnicianByManager(params: {
    email: string;
    fullName: string;
    phone: string;
    password?: string;
    specialty: string;
    additionalSkills?: string[];
    experienceYears?: number;
    licenseNumber?: string;
    hourlyRate?: number;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.createTechnicianByManager(params);
    }

    try {
      const config = getStoredSupabaseConfig();
      // Use temporary client with persistSession: false so the Manager's session is not lost!
      const tempClient = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const pwd = params.password || 'tech1234';
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: pwd,
        options: {
          data: {
            full_name: params.fullName.trim(),
            phone: params.phone.trim(),
            role: 'technician', // CRITICAL: NEVER CUSTOMER
          },
        },
      });

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || 'Failed to create technician auth user.' };
      }

      const techId = authData.user.id;

      // Insert profile with role = 'technician'
      const { error: profileError } = await client.from('profiles').upsert(
        {
          id: techId,
          email: params.email.trim().toLowerCase(),
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          role: 'technician', // CRITICAL: STRICT TECHNICIAN
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        console.error('Error inserting technician profile:', profileError);
      }

      // Insert technician_profiles
      const { error: techProfileError } = await client.from('technician_profiles').upsert(
        {
          id: techId,
          specialty: params.specialty,
          additional_skills: params.additionalSkills || [],
          status: 'available',
          rating: 5.0,
          completed_jobs_count: 0,
          experience_years: params.experienceYears || 0,
          license_number: params.licenseNumber || null,
          hourly_rate: params.hourlyRate || 2000,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (techProfileError) {
        console.error('Error inserting technician details:', techProfileError);
      }

      const newTechUser: User = {
        id: techId,
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName.trim(),
        role: 'technician',
        phone: params.phone.trim(),
        createdAt: new Date().toISOString(),
      };

      return { success: true, user: newTechUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Technician creation error' };
    }
  }

  // Sign Out
  public static async signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    store.setCurrentUserId(null);
  }

  /**
   * SERVICE REQUESTS CRUD & AI DISPATCH SCHEDULING ENGINE
   */

  public static readonly WORKING_TIME_SLOTS = [
    'Morning (08:00 AM – 12:00 PM)',
    'Afternoon (12:00 PM – 04:00 PM)',
    'Evening (04:00 PM – 08:00 PM)',
  ] as const;

  private static dispatchingRequestIds = new Set<string>();

  /**
   * Maps any time slot string into a normalized working-hours window (08:00 AM – 08:00 PM).
   */
  public static parseTimeSlotWindow(slot?: string): {
    bucket: 'morning' | 'afternoon' | 'evening';
    startHour: number;
    endHour: number;
    canonical: string;
  } {
    const raw = (slot || '').trim();
    const lower = raw.toLowerCase();

    if (lower.includes('afternoon') || lower.includes('12:00 pm') || lower.includes('13:') || lower.includes('14:') || lower.includes('15:')) {
      return {
        bucket: 'afternoon',
        startHour: 12,
        endHour: 16,
        canonical: 'Afternoon (12:00 PM – 04:00 PM)',
      };
    }

    if (lower.includes('evening') || lower.includes('04:00 pm') || lower.includes('4:00 pm') || lower.includes('16:') || lower.includes('17:') || lower.includes('18:') || lower.includes('19:')) {
      return {
        bucket: 'evening',
        startHour: 16,
        endHour: 20,
        canonical: 'Evening (04:00 PM – 08:00 PM)',
      };
    }

    // Check if a custom HH:MM format was passed
    const hourMatch = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
    if (hourMatch) {
      let hr = parseInt(hourMatch[1], 10);
      const meridiem = hourMatch[3];
      if (meridiem === 'pm' && hr < 12) hr += 12;
      if (meridiem === 'am' && hr === 12) hr = 0;

      if (hr >= 12 && hr < 16) {
        return {
          bucket: 'afternoon',
          startHour: 12,
          endHour: 16,
          canonical: 'Afternoon (12:00 PM – 04:00 PM)',
        };
      }
      if (hr >= 16) {
        return {
          bucket: 'evening',
          startHour: 16,
          endHour: 20,
          canonical: 'Evening (04:00 PM – 08:00 PM)',
        };
      }
    }

    return {
      bucket: 'morning',
      startHour: 8,
      endHour: 12,
      canonical: 'Morning (08:00 AM – 12:00 PM)',
    };
  }

  /**
   * Returns true if two appointment time slots overlap on the same date.
   */
  public static doTimeSlotsConflict(slotA?: string, slotB?: string): boolean {
    const winA = this.parseTimeSlotWindow(slotA);
    const winB = this.parseTimeSlotWindow(slotB);
    return winA.bucket === winB.bucket || (winA.startHour < winB.endHour && winB.startHour < winA.endHour);
  }

  /**
   * Normalizes an appointment date to YYYY-MM-DD and ensures it is never in the past.
   */
  public static normalizeAppointmentDate(dateStr?: string): string {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    const cleaned = (dateStr || '').trim().split('T')[0];
    const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(cleaned);

    if (isValidFormat && cleaned >= localToday) {
      return cleaned;
    }

    // If current local hour is past 19:00 (7:00 PM), schedule starting tomorrow
    if (now.getHours() >= 19) {
      const tomorrow = new Date(now.getTime() + 86400000 - now.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
      return tomorrow;
    }

    return localToday;
  }

  /**
   * Checks whether a technician already has an active scheduled job on the given date and time slot.
   */
  public static hasTechnicianScheduleConflict(params: {
    technicianId: string;
    dateStr: string;
    timeSlot: string;
    allRequests: ServiceRequest[];
    excludeRequestId?: string;
    extraScheduledJobs?: Array<{ technicianId: string; date: string; timeSlot: string }>;
  }): { conflict: boolean; conflictingTicket?: string } {
    const targetDate = (params.dateStr || '').trim().split('T')[0];

    for (const req of params.allRequests) {
      if (params.excludeRequestId && req.id === params.excludeRequestId) continue;
      if (req.assignedTechnicianId !== params.technicianId) continue;
      if (!['assigned', 'accepted', 'in_progress'].includes(req.status)) continue;

      const reqDate = (req.preferredDate || '').trim().split('T')[0];
      if (reqDate === targetDate && this.doTimeSlotsConflict(req.preferredTimeSlot, params.timeSlot)) {
        return { conflict: true, conflictingTicket: req.ticketNumber };
      }
    }

    if (params.extraScheduledJobs) {
      for (const extra of params.extraScheduledJobs) {
        if (
          extra.technicianId === params.technicianId &&
          extra.date === targetDate &&
          this.doTimeSlotsConflict(extra.timeSlot, params.timeSlot)
        ) {
          return { conflict: true, conflictingTicket: 'concurrent batch dispatch' };
        }
      }
    }

    return { conflict: false };
  }

  /**
   * Selects a valid, conflict-free appointment date and working-hours time slot (08:00 AM – 08:00 PM)
   * for the given technician without ever overlapping existing assignments.
   */
  public static findConflictFreeScheduleForTechnician(params: {
    technicianId: string;
    preferredDate?: string;
    preferredTimeSlot?: string;
    allRequests: ServiceRequest[];
    excludeRequestId?: string;
    extraScheduledJobs?: Array<{ technicianId: string; date: string; timeSlot: string }>;
  }): { scheduledDate: string; scheduledTimeSlot: string; scheduleAdjusted: boolean } | null {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
    const currentHour = now.getHours();

    const baseDate = this.normalizeAppointmentDate(params.preferredDate);
    const requestedWindow = this.parseTimeSlotWindow(params.preferredTimeSlot);

    const isSlotInPastOnDate = (dateStr: string, slotStr: string): boolean => {
      if (dateStr > localToday) return false;
      if (dateStr < localToday) return true;
      const win = this.parseTimeSlotWindow(slotStr);
      // Allow scheduling in current window if at least 1 hour remains before window ends
      return currentHour >= win.endHour - 1;
    };

    const countTechJobsOnDate = (dateStr: string): number => {
      const fromDb = params.allRequests.filter(
        (r) =>
          r.id !== params.excludeRequestId &&
          r.assignedTechnicianId === params.technicianId &&
          ['assigned', 'accepted', 'in_progress'].includes(r.status) &&
          (r.preferredDate || '').trim().split('T')[0] === dateStr
      ).length;
      const fromExtra = (params.extraScheduledJobs || []).filter(
        (e) => e.technicianId === params.technicianId && e.date === dateStr
      ).length;
      return fromDb + fromExtra;
    };

    // 1. Try customer's preferred date and canonical working-hours slot first
    if (
      !isSlotInPastOnDate(baseDate, requestedWindow.canonical) &&
      countTechJobsOnDate(baseDate) < 3 &&
      !this.hasTechnicianScheduleConflict({
        technicianId: params.technicianId,
        dateStr: baseDate,
        timeSlot: requestedWindow.canonical,
        allRequests: params.allRequests,
        excludeRequestId: params.excludeRequestId,
        extraScheduledJobs: params.extraScheduledJobs,
      }).conflict
    ) {
      const rawDate = (params.preferredDate || '').trim().split('T')[0];
      const rawSlot = (params.preferredTimeSlot || '').trim();
      return {
        scheduledDate: baseDate,
        scheduledTimeSlot: requestedWindow.canonical,
        scheduleAdjusted: baseDate !== rawDate || requestedWindow.canonical !== rawSlot,
      };
    }

    // 2. Search next available conflict-free working-hours slot across the next 14 days
    const baseDateObj = new Date(baseDate + 'T00:00:00');
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const d = new Date(baseDateObj.getTime() + dayOffset * 86400000);
      const candidateDate = d.toISOString().split('T')[0];

      if (countTechJobsOnDate(candidateDate) >= 3) {
        continue;
      }

      for (const slotOption of this.WORKING_TIME_SLOTS) {
        if (isSlotInPastOnDate(candidateDate, slotOption)) {
          continue;
        }
        const conflictCheck = this.hasTechnicianScheduleConflict({
          technicianId: params.technicianId,
          dateStr: candidateDate,
          timeSlot: slotOption,
          allRequests: params.allRequests,
          excludeRequestId: params.excludeRequestId,
          extraScheduledJobs: params.extraScheduledJobs,
        });
        if (!conflictCheck.conflict) {
          return {
            scheduledDate: candidateDate,
            scheduledTimeSlot: slotOption,
            scheduleAdjusted: true,
          };
        }
      }
    }

    return null;
  }

  public static async fetchServiceRequests(): Promise<ServiceRequest[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getRequests();
    }

    try {
      const { data, error } = await client
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching service requests from Supabase:', error);
        return [];
      }

      return (data || []).map(mapSupabaseToServiceRequest);
    } catch (e) {
      console.error('Exception fetching service requests from Supabase:', e);
      return [];
    }
  }

  /**
   * Evaluates all technicians in Supabase and ranks eligible candidates by:
   * - Availability ('available', or 'on_job' with 0 actual in_progress requests)
   * - Active assignment workload (< 3 active jobs)
   * - Service category, specialty, and additional skills match
   * - Working hours (08:00 AM – 08:00 PM) and zero schedule conflicts
   */
  public static async evaluateEligibleTechnicians(params: {
    category: ServiceCategory;
    requiredSkill?: string;
    priority?: PriorityLevel;
    preferredDate?: string;
    preferredTimeSlot?: string;
    description?: string;
    title?: string;
    excludeRequestId?: string;
    additionalActiveAssignments?: Record<string, number>;
    extraScheduledJobs?: Array<{ technicianId: string; date: string; timeSlot: string }>;
  }): Promise<{
    bestCandidate: AIDispatchCandidate | null;
    allCandidates: AIDispatchCandidate[];
    diagnosticReason: string;
  }> {
    const client = getSupabaseClient();
    const technicians = (
      client
        ? await this.fetchTechnicians()
        : store.getUsers().filter((u) => u.role === 'technician')
    ).filter((t) => t.role === 'technician' && !t.fullName?.startsWith('[Removed]'));

    const rawProfiles = client ? await this.fetchTechnicianProfiles() : store.getTechnicianProfiles();
    const allRequests = client ? await this.fetchServiceRequests() : store.getRequests();

    if (!technicians.length) {
      return {
        bestCandidate: null,
        allCandidates: [],
        diagnosticReason:
          'No registered technicians found in Supabase (public.profiles with role = "technician"). Please create or authorize a technician account first.',
      };
    }

    // Ensure every active technician user has a corresponding profile record for evaluation
    const profilesById = new Map<string, TechnicianProfile>();
    for (const p of rawProfiles) {
      profilesById.set(p.id, p);
      if (p.userId) profilesById.set(p.userId, p);
    }

    const profiles: TechnicianProfile[] = technicians.map((tech) => {
      const existing = profilesById.get(tech.id);
      if (existing) return existing;
      return {
        id: tech.id,
        userId: tech.id,
        specialty: 'General Maintenance & Repairs',
        additionalSkills: ['general', 'diagnostics', 'repair'],
        status: 'available',
        rating: 5.0,
        completedJobsCount: 0,
        hourlyRate: 2000,
      };
    });

    // Check technician availability (must not be off_duty; if status is 'on_job', only eligible if they have 0 in_progress jobs)
    const availableProfiles = profiles.filter((p) => {
      if (p.status === 'available') return true;
      if (p.status === 'on_job') {
        const hasInProgress = allRequests.some(
          (r) =>
            r.id !== params.excludeRequestId &&
            r.assignedTechnicianId === p.id &&
            r.status === 'in_progress'
        );
        return !hasInProgress;
      }
      return false;
    });

    if (!availableProfiles.length) {
      const offDutyCount = profiles.filter((p) => p.status === 'off_duty').length;
      const onJobCount = profiles.filter((p) => p.status === 'on_job').length;
      return {
        bestCandidate: null,
        allCandidates: [],
        diagnosticReason: `No technicians are currently available for dispatch (${onJobCount} on active job, ${offDutyCount} off duty). Set a technician's duty status to Available.`,
      };
    }

    const categoryLower = (params.category || 'general').toLowerCase();
    const skillLower = (params.requiredSkill || '').toLowerCase();
    const textContext = `${params.title || ''} ${params.description || ''}`.toLowerCase();

    const categoryKeywords: Record<ServiceCategory, string[]> = {
      plumbing: ['plumbing', 'plumber', 'pipe', 'leak', 'water', 'drain', 'faucet', 'toilet', 'sink', 'heater', 'boiler', 'sewage', 'sanitary'],
      electrical: ['electrical', 'electrician', 'electric', 'wiring', 'circuit', 'breaker', 'outlet', 'switch', 'power', 'lighting', 'voltage', 'panel', 'spark'],
      hvac: ['hvac', 'climate', 'air condition', 'ac', 'cooling', 'heating', 'furnace', 'thermostat', 'condenser', 'ventilation', 'refrigerant', 'duct', 'chiller'],
      appliance: ['appliance', 'refrigerator', 'fridge', 'washer', 'dryer', 'dishwasher', 'oven', 'stove', 'microwave', 'freezer', 'ice maker'],
      carpentry: ['carpentry', 'carpenter', 'wood', 'framing', 'door', 'window', 'cabinet', 'hinge', 'lock', 'latch', 'trim', 'furniture', 'hardware'],
      general: ['general', 'maintenance', 'handyman', 'repair', 'field tech', 'multi-trade', 'diagnostics', 'inspection'],
    };

    const targetKeywords = categoryKeywords[params.category] || [categoryLower];

    const specialistCandidates: AIDispatchCandidate[] = [];
    const fallbackCandidates: AIDispatchCandidate[] = [];
    let skippedForWorkload = 0;
    let skippedForSchedule = 0;

    for (const prof of availableProfiles) {
      const techUser = technicians.find(
        (t) => (t.id === prof.id || t.id === prof.userId) && t.role === 'technician'
      );
      if (!techUser) continue;

      const existingActiveJobs = allRequests.filter(
        (r) =>
          r.id !== params.excludeRequestId &&
          r.assignedTechnicianId === techUser.id &&
          ['assigned', 'accepted', 'in_progress'].includes(r.status)
      ).length;

      const extraAssigned = params.additionalActiveAssignments?.[techUser.id] || 0;
      const totalActiveJobs = existingActiveJobs + extraAssigned;

      // Workload capacity check: max 3 concurrent active jobs
      if (totalActiveJobs >= 3) {
        skippedForWorkload++;
        continue;
      }

      // Schedule & working-hours conflict check
      const scheduleSlot = this.findConflictFreeScheduleForTechnician({
        technicianId: techUser.id,
        preferredDate: params.preferredDate,
        preferredTimeSlot: params.preferredTimeSlot,
        allRequests,
        excludeRequestId: params.excludeRequestId,
        extraScheduledJobs: params.extraScheduledJobs,
      });

      if (!scheduleSlot) {
        skippedForSchedule++;
        continue;
      }

      const specialtyLower = (prof.specialty || '').toLowerCase();
      const additionalSkills = (prof.additionalSkills || []).map((s) => s.toLowerCase());

      let skillScore = 0;
      const reasons: string[] = [];

      // 1. Direct or Synonym Specialty Match
      if (
        specialtyLower === categoryLower ||
        specialtyLower.includes(categoryLower) ||
        categoryLower.includes(specialtyLower) ||
        targetKeywords.some((kw) => kw.length > 2 && specialtyLower.includes(kw))
      ) {
        skillScore += 100;
        reasons.push(`Primary specialty match (${prof.specialty})`);
      }

      // 2. Additional Skills Match
      const matchedSkill = additionalSkills.find(
        (s) =>
          s.includes(categoryLower) ||
          targetKeywords.some((kw) => kw.length > 2 && s.includes(kw)) ||
          (skillLower && (s.includes(skillLower) || skillLower.includes(s)))
      );
      if (matchedSkill) {
        skillScore += 65;
        reasons.push(`Certified skill match (${matchedSkill})`);
      }

      // 3. Problem Description Keyword Match against Specialty or Skills
      if (skillScore === 0 && textContext) {
        const contextMatch = additionalSkills.find((s) => s.length > 3 && textContext.includes(s));
        if (contextMatch) {
          skillScore += 50;
          reasons.push(`Problem keyword skill match (${contextMatch})`);
        }
      }

      // 4. Generalist Technician Qualification
      const isGeneralist =
        specialtyLower.includes('general') ||
        specialtyLower.includes('maintenance') ||
        specialtyLower.includes('field tech') ||
        specialtyLower.includes('multi') ||
        categoryLower === 'general';

      if (skillScore === 0 && isGeneralist) {
        skillScore += 40;
        reasons.push(`General maintenance qualification (${prof.specialty})`);
      }

      // Compute quality, schedule fit, and workload balance adjustments
      let totalScore = skillScore;

      // Prefer technician who is free on the customer's exact preferred date/time slot
      if (!scheduleSlot.scheduleAdjusted) {
        totalScore += 25;
        reasons.push(`Available at preferred slot (${scheduleSlot.scheduledDate} · ${scheduleSlot.scheduledTimeSlot})`);
      } else {
        reasons.push(`Next conflict-free slot (${scheduleSlot.scheduledDate} · ${scheduleSlot.scheduledTimeSlot})`);
      }

      // Rating & Experience bonus
      totalScore += Math.round((prof.rating || 5.0) * 4);
      totalScore += Math.min(prof.completedJobsCount || 0, 15);

      // Workload balancing penalty (favor technicians with fewer active assignments)
      totalScore -= totalActiveJobs * 25;

      const candidateObj: AIDispatchCandidate = {
        technician: techUser,
        profile: prof,
        matchScore: totalScore,
        matchReason: `${reasons.join(' · ')} [Active workload: ${totalActiveJobs}/3, Rating: ${Number(prof.rating || 5.0).toFixed(1)}★]`,
        scheduledDate: scheduleSlot.scheduledDate,
        scheduledTimeSlot: scheduleSlot.scheduledTimeSlot,
        scheduleAdjusted: scheduleSlot.scheduleAdjusted,
        activeWorkload: totalActiveJobs,
      };

      if (skillScore > 0) {
        specialistCandidates.push(candidateObj);
      } else {
        // Cross-trade fallback candidate if no category specialist is available in the roster
        fallbackCandidates.push({
          ...candidateObj,
          matchScore: totalScore + 15,
          matchReason: `Available certified technician (${prof.specialty}) · ${
            !scheduleSlot.scheduleAdjusted
              ? `Available at preferred slot (${scheduleSlot.scheduledDate} · ${scheduleSlot.scheduledTimeSlot})`
              : `Scheduled for next conflict-free slot (${scheduleSlot.scheduledDate} · ${scheduleSlot.scheduledTimeSlot})`
          } [Active workload: ${totalActiveJobs}/3]`,
        });
      }
    }

    specialistCandidates.sort((a, b) => b.matchScore - a.matchScore);
    fallbackCandidates.sort((a, b) => b.matchScore - a.matchScore);

    const allCandidates =
      specialistCandidates.length > 0
        ? [...specialistCandidates, ...fallbackCandidates]
        : fallbackCandidates;

    if (allCandidates.length > 0) {
      return {
        bestCandidate: allCandidates[0],
        allCandidates,
        diagnosticReason: allCandidates[0].matchReason,
      };
    }

    if (skippedForWorkload > 0) {
      return {
        bestCandidate: null,
        allCandidates: [],
        diagnosticReason: `All ${availableProfiles.length} available technician(s) have reached the maximum concurrent workload (3 active jobs). Complete or reassign an active job before dispatching.`,
      };
    }

    if (skippedForSchedule > 0) {
      return {
        bestCandidate: null,
        allCandidates: [],
        diagnosticReason: `All available technicians have conflicting schedules across upcoming working-hour slots.`,
      };
    }

    return {
      bestCandidate: null,
      allCandidates: [],
      diagnosticReason: `No suitable available technician found for ${params.category} service request.`,
    };
  }

  /**
   * AI AUTO-DISPATCH ENGINE
   * Finds the single best available technician from real Supabase data matching
   * required category, specialty, additional skills, working hours, schedule conflicts, and active workload.
   */
  public static async findBestAvailableTechnician(params: {
    category: ServiceCategory;
    requiredSkill?: string;
    priority?: PriorityLevel;
    preferredDate?: string;
    preferredTimeSlot?: string;
    description?: string;
    title?: string;
    excludeRequestId?: string;
    additionalActiveAssignments?: Record<string, number>;
    extraScheduledJobs?: Array<{ technicianId: string; date: string; timeSlot: string }>;
  }): Promise<AIDispatchCandidate | null> {
    const evalResult = await this.evaluateEligibleTechnicians(params);
    return evalResult.bestCandidate;
  }

  /**
   * Previews the AI Dispatch recommendation and conflict-free schedule for a specific request.
   */
  public static async previewAIDispatch(requestId: string): Promise<{
    candidate: AIDispatchCandidate | null;
    allCandidates: AIDispatchCandidate[];
    error?: string;
  }> {
    const client = getSupabaseClient();
    let targetReq: ServiceRequest | undefined;

    if (client) {
      const { data, error } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      if (error || !data) {
        return { candidate: null, allCandidates: [], error: 'Service request not found.' };
      }
      targetReq = mapSupabaseToServiceRequest(data);
    } else {
      targetReq = store.getRequestById(requestId);
    }

    if (!targetReq) {
      return { candidate: null, allCandidates: [], error: 'Service request not found.' };
    }

    const evalRes = await this.evaluateEligibleTechnicians({
      category: targetReq.category,
      priority: targetReq.priority,
      preferredDate: targetReq.preferredDate,
      preferredTimeSlot: targetReq.preferredTimeSlot,
      description: targetReq.description,
      title: targetReq.title,
      excludeRequestId: targetReq.id,
    });

    if (!evalRes.bestCandidate) {
      return {
        candidate: null,
        allCandidates: [],
        error: evalRes.diagnosticReason,
      };
    }

    return {
      candidate: evalRes.bestCandidate,
      allCandidates: evalRes.allCandidates,
    };
  }

  /**
   * Confirms and saves AI Dispatch for a single Manager-Approved service request.
   * - Strictly requires request status === 'approved' (Requirement #2)
   * - Prevents duplicate assignments and concurrent double-clicks (Requirement #10)
   * - Selects an available technician and valid non-overlapping appointment date & time (Requirements #3, #4, #5)
   * - Saves technician assignment, appointment date (preferred_date), appointment time (preferred_time_slot),
   *   and status = 'assigned' to Supabase and verifies persistence via .select('*') (Requirements #6, #7, #9)
   */
  public static async aiDispatchServiceRequest(
    requestId: string,
    manager: User,
    scheduleOverride?: {
      preferredDate?: string;
      preferredTimeSlot?: string;
      technicianId?: string;
    }
  ): Promise<AutoDispatchResult> {
    if (!manager || manager.role !== 'manager') {
      return {
        assigned: false,
        requestId,
        ticketNumber: '',
        matchedCategory: 'general',
        matchedSkill: '',
        reason: 'Unauthorized',
        error: 'Unauthorized: Only Operations Managers can confirm AI Dispatch.',
      };
    }

    // Prevent concurrent duplicate clicks on the same request
    if (this.dispatchingRequestIds.has(requestId)) {
      return {
        assigned: false,
        requestId,
        ticketNumber: '',
        matchedCategory: 'general',
        matchedSkill: '',
        reason: 'Dispatch already in progress',
        error: 'AI Dispatch is already in progress for this request. Please wait.',
      };
    }

    this.dispatchingRequestIds.add(requestId);

    try {
      const client = getSupabaseClient();

      // Local store fallback when Supabase is not configured
      if (!client) {
        const req = store.getRequestById(requestId);
        if (!req) {
          return {
            assigned: false,
            requestId,
            ticketNumber: '',
            matchedCategory: 'general',
            matchedSkill: '',
            reason: 'Not found',
            error: 'Service request not found.',
          };
        }
        if (req.status === 'pending') {
          return {
            assigned: false,
            requestId,
            ticketNumber: req.ticketNumber,
            matchedCategory: req.category,
            matchedSkill: '',
            reason: 'Not approved',
            error: `Ticket ${req.ticketNumber} is still Pending. Please approve the service request before running AI Dispatch.`,
          };
        }
        if (req.status !== 'approved') {
          return {
            assigned: false,
            requestId,
            ticketNumber: req.ticketNumber,
            matchedCategory: req.category,
            matchedSkill: '',
            reason: 'Already assigned or closed',
            error: req.assignedTechnicianName
              ? `Ticket ${req.ticketNumber} is already assigned to ${req.assignedTechnicianName} (${req.preferredDate} · ${req.preferredTimeSlot}).`
              : `Ticket ${req.ticketNumber} cannot be dispatched from "${req.status}" status.`,
          };
        }

        const evalRes = await this.evaluateEligibleTechnicians({
          category: req.category,
          priority: req.priority,
          preferredDate: scheduleOverride?.preferredDate || req.preferredDate,
          preferredTimeSlot: scheduleOverride?.preferredTimeSlot || req.preferredTimeSlot,
          description: req.description,
          title: req.title,
          excludeRequestId: req.id,
        });

        const chosen = scheduleOverride?.technicianId
          ? evalRes.allCandidates.find((c) => c.technician.id === scheduleOverride.technicianId) || evalRes.bestCandidate
          : evalRes.bestCandidate;

        if (!chosen) {
          return {
            assigned: false,
            requestId: req.id,
            ticketNumber: req.ticketNumber,
            matchedCategory: req.category,
            matchedSkill: '',
            reason: evalRes.diagnosticReason,
            error: evalRes.diagnosticReason,
          };
        }

        const finalDate = scheduleOverride?.preferredDate
          ? this.normalizeAppointmentDate(scheduleOverride.preferredDate)
          : chosen.scheduledDate;
        const finalSlot = scheduleOverride?.preferredTimeSlot
          ? this.parseTimeSlotWindow(scheduleOverride.preferredTimeSlot).canonical
          : chosen.scheduledTimeSlot;

        const assignRes = store.assignTechnician(req.id, chosen.technician.id, manager, {
          preferredDate: finalDate,
          preferredTimeSlot: finalSlot,
        });

        if (!assignRes.success) {
          return {
            assigned: false,
            requestId: req.id,
            ticketNumber: req.ticketNumber,
            matchedCategory: req.category,
            matchedSkill: chosen.profile.specialty,
            reason: assignRes.error || 'Assignment failed',
            error: assignRes.error || 'Failed to save assignment.',
          };
        }

        return {
          assigned: true,
          requestId: req.id,
          ticketNumber: req.ticketNumber,
          technicianId: chosen.technician.id,
          technicianName: chosen.technician.fullName,
          technicianPhone: chosen.technician.phone,
          matchedCategory: req.category,
          matchedSkill: chosen.profile.specialty,
          scheduledDate: finalDate,
          scheduledTimeSlot: finalSlot,
          reason: chosen.matchReason,
          request: assignRes.request,
        };
      }

      // 1. Fetch fresh request from Supabase
      const { data: reqRow, error: fetchErr } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (fetchErr || !reqRow) {
        return {
          assigned: false,
          requestId,
          ticketNumber: '',
          matchedCategory: 'general',
          matchedSkill: '',
          reason: 'Request not found',
          error: fetchErr?.message || 'Service request not found in Supabase.',
        };
      }

      const currentReq = mapSupabaseToServiceRequest(reqRow);

      // 2. Enforce Requirement #2: Only dispatch manager-approved service requests
      if (currentReq.status === 'pending') {
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: '',
          reason: 'Request not approved yet',
          error: `Ticket ${currentReq.ticketNumber} is currently Pending. Please approve the service request before running AI Dispatch.`,
        };
      }

      // 3. Enforce Requirement #10: Prevent duplicate assignment if already dispatched
      if (currentReq.status !== 'approved') {
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: '',
          reason: 'Already dispatched or closed',
          error: currentReq.assignedTechnicianName
            ? `Ticket ${currentReq.ticketNumber} is already assigned to ${currentReq.assignedTechnicianName} scheduled for ${currentReq.preferredDate} (${currentReq.preferredTimeSlot}).`
            : `Ticket ${currentReq.ticketNumber} is currently in "${currentReq.status}" status and cannot be dispatched again.`,
        };
      }

      // 4. Evaluate eligible technicians & schedules from real Supabase records
      const evalRes = await this.evaluateEligibleTechnicians({
        category: currentReq.category,
        priority: currentReq.priority,
        preferredDate: scheduleOverride?.preferredDate || currentReq.preferredDate,
        preferredTimeSlot: scheduleOverride?.preferredTimeSlot || currentReq.preferredTimeSlot,
        description: currentReq.description,
        title: currentReq.title,
        excludeRequestId: currentReq.id,
      });

      const candidate = scheduleOverride?.technicianId
        ? evalRes.allCandidates.find((c) => c.technician.id === scheduleOverride.technicianId) || evalRes.bestCandidate
        : evalRes.bestCandidate;

      if (!candidate) {
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: '',
          reason: evalRes.diagnosticReason,
          error: evalRes.diagnosticReason,
        };
      }

      // Verify technician role in public.profiles
      const verifiedTech = await this.getProfile(candidate.technician.id);
      if (!verifiedTech || verifiedTech.role !== 'technician') {
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: '',
          reason: 'Technician verification failed',
          error: 'Selected technician profile is not an authorized technician in public.profiles.',
        };
      }

      // Determine final scheduled appointment date and time slot
      const finalDate = scheduleOverride?.preferredDate
        ? this.normalizeAppointmentDate(scheduleOverride.preferredDate)
        : candidate.scheduledDate;
      const finalSlot = scheduleOverride?.preferredTimeSlot
        ? this.parseTimeSlotWindow(scheduleOverride.preferredTimeSlot).canonical
        : candidate.scheduledTimeSlot;

      // Double-check zero overlapping schedule conflict for this technician on (finalDate, finalSlot)
      const allRequestsNow = await this.fetchServiceRequests();
      const conflictCheck = this.hasTechnicianScheduleConflict({
        technicianId: verifiedTech.id,
        dateStr: finalDate,
        timeSlot: finalSlot,
        allRequests: allRequestsNow,
        excludeRequestId: currentReq.id,
      });

      if (conflictCheck.conflict) {
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: candidate.profile.specialty,
          reason: 'Schedule conflict detected',
          error: `Schedule conflict: Technician ${verifiedTech.fullName} already has an active assignment (${conflictCheck.conflictingTicket}) on ${finalDate} during ${finalSlot}. Please choose a non-overlapping appointment slot.`,
        };
      }

      const nowIso = new Date().toISOString();
      const dispatchNote = `[AI Dispatch Scheduled] Assigned to ${verifiedTech.fullName} (${candidate.profile.specialty}) | Appointment: ${finalDate} · ${finalSlot}`;
      const existingNotes = (reqRow.work_notes || '').trim();
      const updatedWorkNotes = existingNotes
        ? existingNotes.includes('[AI Dispatch Scheduled]')
          ? existingNotes.replace(/\[AI Dispatch Scheduled\][^\n]*/, dispatchNote)
          : `${existingNotes}\n${dispatchNote}`
        : dispatchNote;

      // 5. Save confirmed assignment and appointment schedule to Supabase service_requests
      const { data: updatedRows, error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'assigned',
          assigned_technician_id: verifiedTech.id,
          assigned_technician_name: verifiedTech.fullName,
          assigned_technician_phone: verifiedTech.phone,
          assigned_at: nowIso,
          preferred_date: finalDate,
          preferred_time_slot: finalSlot,
          rejection_reason: null,
          work_notes: updatedWorkNotes,
          updated_at: nowIso,
        })
        .eq('id', currentReq.id)
        .eq('status', 'approved')
        .select('*');

      if (updateErr) {
        console.error('Supabase error saving AI Dispatch assignment:', updateErr);
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: candidate.profile.specialty,
          reason: updateErr.message,
          error: `Failed to save technician assignment to Supabase: ${updateErr.message}`,
        };
      }

      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
      if (!updatedRow) {
        return {
          assigned: false,
          requestId: currentReq.id,
          ticketNumber: currentReq.ticketNumber,
          matchedCategory: currentReq.category,
          matchedSkill: candidate.profile.specialty,
          reason: 'Database update affected 0 rows',
          error:
            'Failed to save assignment to Supabase (0 rows updated). Verify that your Manager account has role = "manager" in public.profiles and the Manager RLS UPDATE policy on public.service_requests is enabled.',
        };
      }

      const updatedRequest = mapSupabaseToServiceRequest(updatedRow);

      // Sync local store cache
      try {
        store.assignTechnician(currentReq.id, verifiedTech.id, manager, {
          preferredDate: finalDate,
          preferredTimeSlot: finalSlot,
        });
      } catch {
        // Non-fatal local cache sync
      }

      // 6. Record Audit Log
      try {
        await client.from('service_request_logs').insert({
          request_id: currentReq.id,
          from_status: 'approved',
          to_status: 'assigned',
          changed_by_user_id: manager.id,
          changed_by_name: manager.fullName,
          changed_by_role: 'manager',
          note: `AI Dispatch Confirmed: Assigned to ${verifiedTech.fullName} (${candidate.profile.specialty}) scheduled for ${finalDate} (${finalSlot}). ${candidate.matchReason}`,
        });
      } catch (logErr) {
        console.warn('Non-fatal audit log insert warning:', logErr);
      }

      // 7. Notify Assigned Technician & Customer
      try {
        await client.from('notifications').insert({
          recipient_user_id: verifiedTech.id,
          title: `New Job Dispatched: ${currentReq.ticketNumber}`,
          message: `You have been assigned to ${currentReq.category} ticket "${currentReq.title}" scheduled for ${finalDate} (${finalSlot}). Please review and accept.`,
          request_id: currentReq.id,
          type: 'assignment',
        });
      } catch (techNotifErr) {
        console.warn('Non-fatal technician notification warning:', techNotifErr);
      }

      try {
        await client.from('notifications').insert({
          recipient_user_id: currentReq.customerId,
          title: `Technician Dispatched: ${currentReq.ticketNumber}`,
          message: `Technician ${verifiedTech.fullName} has been assigned to your service request and scheduled for ${finalDate} (${finalSlot}).`,
          request_id: currentReq.id,
          type: 'status_change',
        });
      } catch (custNotifErr) {
        console.warn('Non-fatal customer notification warning:', custNotifErr);
      }

      return {
        assigned: true,
        requestId: updatedRequest.id,
        ticketNumber: updatedRequest.ticketNumber,
        technicianId: verifiedTech.id,
        technicianName: verifiedTech.fullName,
        technicianPhone: verifiedTech.phone,
        matchedCategory: updatedRequest.category,
        matchedSkill: candidate.profile.specialty,
        scheduledDate: finalDate,
        scheduledTimeSlot: finalSlot,
        reason: candidate.matchReason,
        request: updatedRequest,
      };
    } catch (err: any) {
      console.error('Exception during aiDispatchServiceRequest:', err);
      return {
        assigned: false,
        requestId,
        ticketNumber: '',
        matchedCategory: 'general',
        matchedSkill: '',
        reason: err.message || 'Dispatch error',
        error: err.message || 'An unexpected error occurred during AI Dispatch.',
      };
    } finally {
      this.dispatchingRequestIds.delete(requestId);
    }
  }

  /**
   * Batch AI Auto-Dispatch for all Manager-Approved unassigned service requests in the queue.
   * Strictly dispatches ONLY status === 'approved' requests (never unapproved 'pending' requests).
   */
  public static async autoAssignPendingRequests(manager?: User): Promise<AutoDispatchResult[]> {
    const client = getSupabaseClient();
    const results: AutoDispatchResult[] = [];

    let approvedRequests: ServiceRequest[] = [];
    if (client) {
      const { data, error } = await client
        .from('service_requests')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: true });
      if (error || !data) return [];
      approvedRequests = data
        .map(mapSupabaseToServiceRequest)
        .filter((r) => !r.assignedTechnicianId);
    } else {
      approvedRequests = store
        .getRequests()
        .filter((r) => r.status === 'approved' && !r.assignedTechnicianId);
    }

    if (!approvedRequests.length) return [];

    // Prioritize emergency and high urgency requests first
    const priorityWeight: Record<PriorityLevel, number> = {
      emergency: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    approvedRequests.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    const newlyAssignedMap: Record<string, number> = {};
    const extraScheduledJobs: Array<{ technicianId: string; date: string; timeSlot: string }> = [];

    for (const req of approvedRequests) {
      if (this.dispatchingRequestIds.has(req.id)) continue;

      const evalRes = await this.evaluateEligibleTechnicians({
        category: req.category,
        priority: req.priority,
        preferredDate: req.preferredDate,
        preferredTimeSlot: req.preferredTimeSlot,
        description: req.description,
        title: req.title,
        excludeRequestId: req.id,
        additionalActiveAssignments: newlyAssignedMap,
        extraScheduledJobs,
      });

      const bestCandidate = evalRes.bestCandidate;
      if (!bestCandidate) {
        results.push({
          assigned: false,
          requestId: req.id,
          ticketNumber: req.ticketNumber,
          matchedCategory: req.category,
          matchedSkill: '',
          reason: evalRes.diagnosticReason,
          error: evalRes.diagnosticReason,
        });
        continue;
      }

      if (client) {
        const verified = await this.getProfile(bestCandidate.technician.id);
        if (!verified || verified.role !== 'technician') {
          continue;
        }

        const assignedTime = new Date().toISOString();
        const dispatchNote = `[AI Dispatch Scheduled] Assigned to ${verified.fullName} (${bestCandidate.profile.specialty}) | Appointment: ${bestCandidate.scheduledDate} · ${bestCandidate.scheduledTimeSlot}`;
        const existingNotes = (req.workNotes || '').trim();
        const updatedWorkNotes = existingNotes
          ? `${existingNotes}\n${dispatchNote}`
          : dispatchNote;

        const { data: updatedRows, error: updateErr } = await client
          .from('service_requests')
          .update({
            status: 'assigned',
            assigned_technician_id: verified.id,
            assigned_technician_name: verified.fullName,
            assigned_technician_phone: verified.phone,
            assigned_at: assignedTime,
            preferred_date: bestCandidate.scheduledDate,
            preferred_time_slot: bestCandidate.scheduledTimeSlot,
            rejection_reason: null,
            work_notes: updatedWorkNotes,
            updated_at: assignedTime,
          })
          .eq('id', req.id)
          .eq('status', 'approved')
          .select('*');

        const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

        if (!updateErr && updatedRow) {
          newlyAssignedMap[verified.id] = (newlyAssignedMap[verified.id] || 0) + 1;
          extraScheduledJobs.push({
            technicianId: verified.id,
            date: bestCandidate.scheduledDate,
            timeSlot: bestCandidate.scheduledTimeSlot,
          });

          const updatedRequest = mapSupabaseToServiceRequest(updatedRow);

          // Audit Log
          try {
            await client.from('service_request_logs').insert({
              request_id: req.id,
              from_status: 'approved',
              to_status: 'assigned',
              changed_by_user_id: manager?.id || verified.id,
              changed_by_name: manager?.fullName || 'AI Auto-Dispatch Engine',
              changed_by_role: 'manager',
              note: `AI Dispatch Confirmed: Assigned approved ticket to ${verified.fullName} (${bestCandidate.profile.specialty}) scheduled for ${bestCandidate.scheduledDate} (${bestCandidate.scheduledTimeSlot}). ${bestCandidate.matchReason}`,
            });
          } catch (logErr) {
            console.warn('Non-fatal audit log warning:', logErr);
          }

          // Notify Technician
          try {
            await client.from('notifications').insert({
              recipient_user_id: verified.id,
              title: `New Job Dispatched: ${req.ticketNumber}`,
              message: `Approved ${req.category} ticket "${req.title}" has been assigned to you for ${bestCandidate.scheduledDate} (${bestCandidate.scheduledTimeSlot}).`,
              request_id: req.id,
              type: 'assignment',
            });
          } catch (techNotifErr) {
            console.warn('Non-fatal technician notification warning:', techNotifErr);
          }

          // Notify Customer
          try {
            await client.from('notifications').insert({
              recipient_user_id: req.customerId,
              title: `Technician Dispatched: ${req.ticketNumber}`,
              message: `Certified technician ${verified.fullName} has been assigned to your request and scheduled for ${bestCandidate.scheduledDate} (${bestCandidate.scheduledTimeSlot}).`,
              request_id: req.id,
              type: 'status_change',
            });
          } catch (custNotifErr) {
            console.warn('Non-fatal customer notification warning:', custNotifErr);
          }

          results.push({
            assigned: true,
            requestId: req.id,
            ticketNumber: req.ticketNumber,
            technicianId: verified.id,
            technicianName: verified.fullName,
            technicianPhone: verified.phone,
            matchedCategory: req.category,
            matchedSkill: bestCandidate.profile.specialty,
            scheduledDate: bestCandidate.scheduledDate,
            scheduledTimeSlot: bestCandidate.scheduledTimeSlot,
            reason: bestCandidate.matchReason,
            request: updatedRequest,
          });
        } else {
          results.push({
            assigned: false,
            requestId: req.id,
            ticketNumber: req.ticketNumber,
            matchedCategory: req.category,
            matchedSkill: bestCandidate.profile.specialty,
            reason: updateErr?.message || 'Database update affected 0 rows',
            error: updateErr?.message || 'Failed to save assignment in Supabase.',
          });
        }
      } else {
        const localResults = store.autoAssignPendingRequests();
        const foundLocal = localResults.find((lr) => lr.requestId === req.id);
        if (foundLocal && foundLocal.assigned) {
          results.push({
            assigned: true,
            requestId: req.id,
            ticketNumber: req.ticketNumber,
            technicianId: bestCandidate.technician.id,
            technicianName: bestCandidate.technician.fullName,
            technicianPhone: bestCandidate.technician.phone,
            matchedCategory: req.category,
            matchedSkill: bestCandidate.profile.specialty,
            scheduledDate: foundLocal.scheduledDate || bestCandidate.scheduledDate,
            scheduledTimeSlot: foundLocal.scheduledTimeSlot || bestCandidate.scheduledTimeSlot,
            reason: bestCandidate.matchReason,
          });
        }
      }
    }

    return results;
  }

  public static async createServiceRequest(params: {
    customerId: string;
    title: string;
    category: ServiceCategory;
    description: string;
    priority: PriorityLevel;
    serviceAddress: ServiceAddress;
    preferredDate: string;
    preferredTimeSlot: string;
    requiredSkill?: string;
    technicianSummary?: string;
    attachments?: string[];
  }): Promise<{ success: boolean; request?: ServiceRequest; autoDispatchedTo?: string | null; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      const req = store.createServiceRequest(params);
      return {
        success: true,
        request: req,
        autoDispatchedTo: null,
      };
    }

    try {
      const customer = await this.getProfile(params.customerId);
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `FXN-${year}-${randomSuffix}`;
      const nowIso = new Date().toISOString();

      // Customer service requests always enter 'pending' status awaiting Manager Approval first (Requirement #2)
      const insertData = {
        ticket_number: ticketNumber,
        customer_id: params.customerId,
        customer_name: customer?.fullName || 'Customer',
        customer_phone: customer?.phone || params.serviceAddress.contactPhone || '',
        customer_email: customer?.email || '',
        title: params.title.trim(),
        category: params.category,
        description: params.description.trim(),
        priority: params.priority,
        status: 'pending' as ServiceStatus,
        service_address: params.serviceAddress,
        preferred_date: params.preferredDate,
        preferred_time_slot: params.preferredTimeSlot,
        attachments: params.attachments || [],
        assigned_technician_id: null,
        assigned_technician_name: null,
        assigned_technician_phone: null,
        assigned_at: null,
        work_notes:
          params.technicianSummary || params.requiredSkill
            ? `[AI Technician Brief] Skill: ${params.requiredSkill || 'General'}. Summary: ${params.technicianSummary || ''}`
            : null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: insertedData, error } = await client
        .from('service_requests')
        .insert(insertData)
        .select('*');

      const data = Array.isArray(insertedData) ? insertedData[0] : insertedData;

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to create service request' };
      }

      const newRequest = mapSupabaseToServiceRequest(data);

      // Audit Log: Placed in Pending Queue awaiting Manager Approval
      try {
        await client.from('service_request_logs').insert({
          request_id: newRequest.id,
          from_status: 'pending',
          to_status: 'pending',
          changed_by_user_id: params.customerId,
          changed_by_name: newRequest.customerName,
          changed_by_role: 'customer',
          note: `Service request submitted by customer (${params.category}). Awaiting Operations Manager approval before AI Dispatch.`,
        });
      } catch (logErr) {
        console.warn('Non-fatal log insert warning:', logErr);
      }

      return {
        success: true,
        request: newRequest,
        autoDispatchedTo: null,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error creating request' };
    }
  }

  public static async approveServiceRequest(
    requestId: string,
    manager: User
  ): Promise<{ success: boolean; error?: string; request?: ServiceRequest }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.approveServiceRequest(requestId, manager);
    }

    try {
      const { data: req, error: fetchErr } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (fetchErr || !req) return { success: false, error: 'Request not found' };

      if (req.status !== 'pending') {
        return {
          success: false,
          error: `Only Pending requests can be approved (current status: ${req.status}).`,
        };
      }

      const nowIso = new Date().toISOString();
      const { data: updatedRows, error: updateErr } = await client
        .from('service_requests')
        .update({ status: 'approved', updated_at: nowIso })
        .eq('id', requestId)
        .select('*');

      if (updateErr) return { success: false, error: updateErr.message };

      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
      if (!updatedRow) {
        return {
          success: false,
          error:
            'Failed to approve request in Supabase (0 rows updated). Ensure your Manager profile has role = "manager" in public.profiles.',
        };
      }

      const updatedRequest = mapSupabaseToServiceRequest(updatedRow);

      try {
        store.approveServiceRequest(requestId, manager);
      } catch {
        // Non-fatal cache sync
      }

      // Audit log
      try {
        await client.from('service_request_logs').insert({
          request_id: requestId,
          from_status: req.status,
          to_status: 'approved',
          changed_by_user_id: manager.id,
          changed_by_name: manager.fullName,
          changed_by_role: 'manager',
          note: 'Service request approved by Operations Manager. Ready for AI Dispatch.',
        });
      } catch (logErr) {
        console.warn('Non-fatal approval log warning:', logErr);
      }

      // Notification
      try {
        await client.from('notifications').insert({
          recipient_user_id: req.customer_id,
          title: `Request Approved: ${req.ticket_number}`,
          message: 'Your service request has been approved and is ready for technician dispatch.',
          request_id: requestId,
          type: 'status_change',
        });
      } catch (notifErr) {
        console.warn('Non-fatal approval notification warning:', notifErr);
      }

      return { success: true, request: updatedRequest };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async assignTechnician(
    requestId: string,
    technicianId: string,
    manager: User,
    schedule?: { preferredDate?: string; preferredTimeSlot?: string }
  ): Promise<{ success: boolean; error?: string; request?: ServiceRequest }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.assignTechnician(requestId, technicianId, manager, schedule);
    }

    try {
      const techProfile = await this.getProfile(technicianId);
      if (!techProfile || techProfile.role !== 'technician') {
        return { success: false, error: 'Selected user is not an authorized technician.' };
      }

      const { data: req, error: fetchErr } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (fetchErr || !req) return { success: false, error: 'Request not found' };

      if (req.status === 'pending') {
        return {
          success: false,
          error: 'Please approve the service request before assigning a technician.',
        };
      }

      if (req.status !== 'approved' && req.status !== 'assigned') {
        return {
          success: false,
          error: `Cannot assign technician when request is in "${req.status}" status.`,
        };
      }

      const finalDate = schedule?.preferredDate
        ? this.normalizeAppointmentDate(schedule.preferredDate)
        : this.normalizeAppointmentDate(req.preferred_date);
      const finalSlot = schedule?.preferredTimeSlot
        ? this.parseTimeSlotWindow(schedule.preferredTimeSlot).canonical
        : this.parseTimeSlotWindow(req.preferred_time_slot).canonical;

      // Prevent overlapping schedules for the same technician
      const allRequests = await this.fetchServiceRequests();
      const conflictCheck = this.hasTechnicianScheduleConflict({
        technicianId: techProfile.id,
        dateStr: finalDate,
        timeSlot: finalSlot,
        allRequests,
        excludeRequestId: requestId,
      });

      if (conflictCheck.conflict) {
        return {
          success: false,
          error: `Schedule conflict: ${techProfile.fullName} is already scheduled for ticket ${conflictCheck.conflictingTicket} on ${finalDate} during ${finalSlot}.`,
        };
      }

      const nowIso = new Date().toISOString();
      const { data: updatedRows, error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'assigned',
          assigned_technician_id: techProfile.id,
          assigned_technician_name: techProfile.fullName,
          assigned_technician_phone: techProfile.phone,
          assigned_at: nowIso,
          preferred_date: finalDate,
          preferred_time_slot: finalSlot,
          rejection_reason: null,
          updated_at: nowIso,
        })
        .eq('id', requestId)
        .select('*');

      if (updateErr) return { success: false, error: updateErr.message };

      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
      if (!updatedRow) {
        return {
          success: false,
          error:
            'Failed to save assignment in Supabase (0 rows updated). Verify Manager RLS permissions on public.service_requests.',
        };
      }

      const updatedRequest = mapSupabaseToServiceRequest(updatedRow);

      try {
        store.assignTechnician(requestId, techProfile.id, manager, {
          preferredDate: finalDate,
          preferredTimeSlot: finalSlot,
        });
      } catch {
        // Non-fatal local cache sync
      }

      // Audit Log
      try {
        await client.from('service_request_logs').insert({
          request_id: requestId,
          from_status: req.status,
          to_status: 'assigned',
          changed_by_user_id: manager.id,
          changed_by_name: manager.fullName,
          changed_by_role: 'manager',
          note: `Assigned to technician ${techProfile.fullName} (${techProfile.phone}) scheduled for ${finalDate} (${finalSlot}).`,
        });
      } catch (logErr) {
        console.warn('Non-fatal assignment log warning:', logErr);
      }

      // Notify technician
      try {
        await client.from('notifications').insert({
          recipient_user_id: techProfile.id,
          title: `New Job Assigned: ${req.ticket_number}`,
          message: `You have been assigned to ${req.category} ticket "${req.title}" scheduled for ${finalDate} (${finalSlot}). Please accept or decline.`,
          request_id: requestId,
          type: 'assignment',
        });
      } catch (notifErr) {
        console.warn('Non-fatal assignment notification warning:', notifErr);
      }

      // Notify customer
      try {
        await client.from('notifications').insert({
          recipient_user_id: req.customer_id,
          title: `Technician Assigned: ${req.ticket_number}`,
          message: `Technician ${techProfile.fullName} has been assigned to your request for ${finalDate} (${finalSlot}).`,
          request_id: requestId,
          type: 'status_change',
        });
      } catch (custNotifErr) {
        console.warn('Non-fatal customer notification warning:', custNotifErr);
      }

      return { success: true, request: updatedRequest };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async acceptServiceRequest(
    requestId: string,
    technician: User
  ): Promise<{ success: boolean; error?: string; request?: ServiceRequest }> {
    const client = getSupabaseClient();
    if (!client) {
      const res = store.acceptServiceRequest(requestId, technician);
      return res;
    }

    try {
      const nowIso = new Date().toISOString();
      const { data: updatedResult, error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'accepted',
          accepted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', requestId)
        .select('*');

      if (updateErr) {
        console.error('Error updating status to accepted in Supabase:', updateErr);
        return { success: false, error: updateErr.message };
      }

      const updatedRow = Array.isArray(updatedResult) ? updatedResult[0] : updatedResult;

      if (!updatedRow) {
        return { success: false, error: 'Failed to update request: record not found in Supabase.' };
      }

      const updatedRequest = mapSupabaseToServiceRequest(updatedRow);

      // Keep local in-memory store cache in sync with Supabase update
      try {
        store.acceptServiceRequest(requestId, technician);
      } catch (storeErr) {
        // Non-fatal cache sync
      }

      // Safe Audit Log
      try {
        await client.from('service_request_logs').insert({
          request_id: requestId,
          from_status: 'assigned',
          to_status: 'accepted',
          changed_by_user_id: technician.id,
          changed_by_name: technician.fullName,
          changed_by_role: 'technician',
          note: `Job accepted by technician ${technician.fullName}.`,
        });
      } catch (logErr) {
        console.warn('Non-fatal error logging acceptance:', logErr);
      }

      // Safe Customer Notification
      try {
        if (updatedRow.customer_id) {
          await client.from('notifications').insert({
            recipient_user_id: updatedRow.customer_id,
            title: `Job Accepted: ${updatedRow.ticket_number}`,
            message: `Technician ${technician.fullName} has accepted your service request.`,
            request_id: requestId,
            type: 'status_change',
          });
        }
      } catch (noteErr) {
        console.warn('Non-fatal error notifying customer:', noteErr);
      }

      return { success: true, request: updatedRequest };
    } catch (err: any) {
      console.error('Exception accepting service request:', err);
      return { success: false, error: err.message || 'Failed to accept job' };
    }
  }

  public static async declineServiceRequest(
    requestId: string,
    reason: string,
    technician: User
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.declineServiceRequest(requestId, reason, technician);
    }

    try {
      const { error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'approved', // Reverts to Approved for manager to reassign
          assigned_technician_id: null,
          assigned_technician_name: null,
          assigned_technician_phone: null,
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

      await client.from('service_request_logs').insert({
        request_id: requestId,
        from_status: 'assigned',
        to_status: 'approved',
        changed_by_user_id: technician.id,
        changed_by_name: technician.fullName,
        changed_by_role: 'technician',
        note: `Technician declined assignment. Reason: ${reason}. Returned to Approved pool.`,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async startWork(
    requestId: string,
    technician: User
  ): Promise<{ success: boolean; error?: string; request?: ServiceRequest }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.startWork(requestId, technician);
    }

    try {
      const nowIso = new Date().toISOString();
      const { data: updatedResult, error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'in_progress',
          started_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', requestId)
        .select('*');

      if (updateErr) return { success: false, error: updateErr.message };

      const updatedRow = Array.isArray(updatedResult) ? updatedResult[0] : updatedResult;

      // Keep local in-memory store cache in sync with Supabase update
      try {
        store.startWork(requestId, technician);
      } catch (storeErr) {
        // Non-fatal cache sync
      }

      // Update technician status to 'on_job'
      try {
        await client
          .from('technician_profiles')
          .update({ status: 'on_job', updated_at: nowIso })
          .eq('id', technician.id);
      } catch (tpErr) {
        console.warn('Non-fatal error updating technician status to on_job:', tpErr);
      }

      try {
        await client.from('service_request_logs').insert({
          request_id: requestId,
          from_status: 'accepted',
          to_status: 'in_progress',
          changed_by_user_id: technician.id,
          changed_by_name: technician.fullName,
          changed_by_role: 'technician',
          note: 'Technician arrived on-site and commenced service.',
        });
      } catch (logErr) {
        console.warn('Non-fatal error logging start work:', logErr);
      }

      return { success: true, request: updatedRow ? mapSupabaseToServiceRequest(updatedRow) : undefined };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to start job' };
    }
  }

  public static async completeWork(
    requestId: string,
    params: {
      resolutionSummary: string;
      workNotes?: string;
      laborHours: number;
      partsUsed?: PartItem[];
    },
    technician: User
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.completeWork(requestId, params, technician);
    }

    try {
      const { error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          resolution_summary: params.resolutionSummary,
          work_notes: params.workNotes || null,
          labor_hours: params.laborHours,
          parts_used: params.partsUsed || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

      // Update technician status to available & increment completed_jobs_count
      const { data: techRow } = await client
        .from('technician_profiles')
        .select('completed_jobs_count')
        .eq('id', technician.id)
        .single();

      const newCount = (techRow?.completed_jobs_count || 0) + 1;
      await client
        .from('technician_profiles')
        .update({ status: 'available', completed_jobs_count: newCount })
        .eq('id', technician.id);

      await client.from('service_request_logs').insert({
        request_id: requestId,
        from_status: 'in_progress',
        to_status: 'completed',
        changed_by_user_id: technician.id,
        changed_by_name: technician.fullName,
        changed_by_role: 'technician',
        note: `Job completed. Resolution: ${params.resolutionSummary}. Labor: ${params.laborHours}h.`,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async cancelServiceRequest(
    requestId: string,
    reason: string,
    user: User
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.cancelServiceRequest(requestId, reason, user);
    }

    try {
      const { data: req, error: fetchErr } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchErr || !req) return { success: false, error: 'Request not found' };

      if (user.role === 'customer' && req.status !== 'pending') {
        return { success: false, error: 'Customers can only cancel requests in Pending status.' };
      }

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'cancelled',
          cancelled_at: nowIso,
          cancellation_reason: reason,
          updated_at: nowIso,
        })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

      if (req.assigned_technician_id) {
        try {
          await client
            .from('technician_profiles')
            .update({ status: 'available', updated_at: nowIso })
            .eq('id', req.assigned_technician_id);
        } catch {
          // Non-fatal technician status reset
        }
      }

      await client.from('service_request_logs').insert({
        request_id: requestId,
        from_status: req.status,
        to_status: 'cancelled',
        changed_by_user_id: user.id,
        changed_by_name: user.fullName,
        changed_by_role: user.role,
        note: `Service request cancelled. Reason: ${reason}`,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetches genuine customer feedback from real completed service requests
   */
  public static async fetchPublicFeedback(): Promise<
    Array<{
      id: string;
      ticketNumber: string;
      customerName: string;
      category: string;
      score: number;
      comment: string;
      createdAt: string;
      technicianName?: string;
    }>
  > {
    const client = getSupabaseClient();
    if (!client) {
      const requests = store.getRequests();
      return requests
        .filter(
          (r) =>
            r.status === 'completed' &&
            r.rating &&
            typeof r.rating.score === 'number' &&
            r.rating.comment &&
            r.rating.comment.trim().length > 0
        )
        .map((r) => ({
          id: r.id,
          ticketNumber: r.ticketNumber,
          customerName: r.customerName || 'Verified Customer',
          category: r.category,
          score: r.rating!.score,
          comment: r.rating!.comment!.trim(),
          createdAt: r.rating!.createdAt,
          technicianName: r.assignedTechnicianName,
        }));
    }

    try {
      const { data, error } = await client
        .from('service_requests')
        .select('id, ticket_number, customer_name, category, rating, status, assigned_technician_name, completed_at, updated_at')
        .eq('status', 'completed')
        .not('rating', 'is', null);

      if (error) {
        console.warn('Error fetching feedback from Supabase:', error);
        return [];
      }

      const feedbackList: Array<{
        id: string;
        ticketNumber: string;
        customerName: string;
        category: string;
        score: number;
        comment: string;
        createdAt: string;
        technicianName?: string;
      }> = [];

      for (const row of data || []) {
        let ratingObj: any = row.rating;
        if (typeof ratingObj === 'string') {
          try {
            ratingObj = JSON.parse(ratingObj);
          } catch {
            ratingObj = null;
          }
        }

        if (
          ratingObj &&
          typeof ratingObj.score === 'number' &&
          ratingObj.comment &&
          String(ratingObj.comment).trim().length > 0
        ) {
          feedbackList.push({
            id: row.id,
            ticketNumber: row.ticket_number || `FXN-${String(row.id).slice(0, 8)}`,
            customerName: row.customer_name || 'Verified Customer',
            category: row.category || 'general',
            score: Math.min(5, Math.max(1, Math.round(ratingObj.score))),
            comment: String(ratingObj.comment).trim(),
            createdAt: ratingObj.createdAt || ratingObj.created_at || row.completed_at || row.updated_at || new Date().toISOString(),
            technicianName: row.assigned_technician_name || undefined,
          });
        }
      }

      // Sort by newest feedback first
      feedbackList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return feedbackList;
    } catch (e) {
      console.warn('Exception fetching feedback from Supabase:', e);
      return [];
    }
  }

  public static async rateServiceRequest(
    requestId: string,
    rating: { score: number; comment?: string },
    customer: User
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.rateServiceRequest(requestId, rating, customer);
    }

    try {
      // 1. Ownership & status validation on real Supabase record
      const { data: req, error: fetchErr } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchErr || !req) {
        return { success: false, error: 'Service request not found.' };
      }

      if (req.customer_id !== customer.id) {
        return {
          success: false,
          error: 'Unauthorized: You can only submit feedback for your own service requests.',
        };
      }

      if (req.status !== 'completed') {
        return {
          success: false,
          error: 'Feedback can only be submitted for completed service requests.',
        };
      }

      const score = Math.min(5, Math.max(1, Math.round(rating.score)));
      const newRating: ServiceRating = {
        score,
        comment: rating.comment ? rating.comment.trim() : undefined,
        createdAt: new Date().toISOString(),
      };

      const { error: updateErr } = await client
        .from('service_requests')
        .update({
          rating: newRating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

      // 2. Audit log entry
      try {
        await client.from('service_request_logs').insert({
          request_id: requestId,
          from_status: 'completed',
          to_status: 'completed',
          changed_by_user_id: customer.id,
          changed_by_name: customer.fullName,
          changed_by_role: 'customer',
          note: `Customer submitted feedback: ${score} Stars${newRating.comment ? ` — "${newRating.comment}"` : ''}`,
        });
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }

      // 3. Technician notification and rolling average update if technician assigned
      if (req.assigned_technician_id) {
        try {
          await client.from('notifications').insert({
            recipient_user_id: req.assigned_technician_id,
            title: `New Customer Rating: ${score} ★`,
            message: `${customer.fullName} left feedback for job ${req.ticket_number}.`,
            request_id: requestId,
            type: 'status_change',
          });

          // Fetch current technician profile to update rolling average
          const { data: techProf } = await client
            .from('technician_profiles')
            .select('rating, completed_jobs_count')
            .eq('id', req.assigned_technician_id)
            .single();

          if (techProf) {
            const count = Number(techProf.completed_jobs_count) || 1;
            const currentRating = Number(techProf.rating) || 5.0;
            const updatedRating =
              count > 1 ? (currentRating * (count - 1) + score) / count : score;
            await client
              .from('technician_profiles')
              .update({
                rating: Number(updatedRating.toFixed(2)),
                updated_at: new Date().toISOString(),
              })
              .eq('id', req.assigned_technician_id);
          }
        } catch (techErr) {
          console.warn('Technician rating update warning:', techErr);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async updateTechnicianStatus(
    userId: string,
    status: 'available' | 'on_job' | 'off_duty'
  ): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      store.updateTechnicianStatus(userId, status);
      return;
    }

    try {
      await client
        .from('technician_profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (e) {
      console.error('Error updating tech duty status:', e);
    }
  }

  public static async fetchTechnicians(): Promise<User[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store
        .getUsers()
        .filter((u) => u.role === 'technician' && !u.fullName?.startsWith('[Removed]'));
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('role', 'technician');

      if (error) return [];
      return (data || [])
        .filter((d: any) => !d.full_name?.startsWith('[Removed]'))
        .map((d: any) => ({
          id: d.id,
          email: d.email,
          fullName: d.full_name,
          role: 'technician' as UserRole,
          phone: d.phone || '',
          createdAt: d.created_at,
        }));
    } catch (e) {
      return [];
    }
  }

  public static async fetchTechnicianProfiles(): Promise<TechnicianProfile[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getTechnicianProfiles();
    }

    try {
      // 1. Fetch active technicians from profiles table first to enforce strict role matching
      const { data: techUsers, error: techUserErr } = await client
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'technician');

      // 2. Fetch technician profiles
      const { data, error } = await client
        .from('technician_profiles')
        .select('*');

      const rawProfiles = !error && data ? data : [];
      const profileById = new Map<string, TechnicianProfile>();

      for (const d of rawProfiles) {
        profileById.set(d.id, {
          id: d.id,
          userId: d.id,
          specialty: d.specialty || 'General Field Tech',
          additionalSkills: d.additional_skills || [],
          status: d.status || 'available',
          rating: d.rating ? Number(d.rating) : 5.0,
          completedJobsCount: d.completed_jobs_count ? Number(d.completed_jobs_count) : 0,
          experienceYears: d.experience_years ? Number(d.experience_years) : undefined,
          licenseNumber: d.license_number || undefined,
          hourlyRate: d.hourly_rate ? Number(d.hourly_rate) : 2000,
        });
      }

      if (!techUserErr && techUsers && techUsers.length > 0) {
        const activeTechs = techUsers.filter((t: any) => !t.full_name?.startsWith('[Removed]'));
        return activeTechs.map((t: any) => {
          const existing = profileById.get(t.id);
          if (existing) return existing;
          return {
            id: t.id,
            userId: t.id,
            specialty: 'General Field Tech',
            additionalSkills: ['inspection', 'troubleshooting', 'general'],
            status: 'available',
            rating: 5.0,
            completedJobsCount: 0,
            experienceYears: 2,
            hourlyRate: 2000,
          };
        });
      }

      return Array.from(profileById.values());
    } catch (e) {
      console.error('Error fetching technician profiles:', e);
      return [];
    }
  }

  public static async getTechnicianProfile(userId: string): Promise<TechnicianProfile | null> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getTechnicianProfile(userId) || null;
    }

    try {
      const { data, error } = await client
        .from('technician_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          userId: data.id,
          specialty: data.specialty || 'General Field Tech',
          additionalSkills: data.additional_skills || [],
          status: data.status || 'available',
          rating: data.rating ? Number(data.rating) : 5.0,
          completedJobsCount: data.completed_jobs_count ? Number(data.completed_jobs_count) : 0,
          experienceYears: data.experience_years ? Number(data.experience_years) : undefined,
          licenseNumber: data.license_number || undefined,
          hourlyRate: data.hourly_rate ? Number(data.hourly_rate) : 2000,
        };
      }

      // Fallback if user has role = 'technician' in profiles but technician_profiles row is not yet created
      const userProf = await this.getProfile(userId);
      if (userProf && userProf.role === 'technician') {
        return {
          id: userId,
          userId,
          specialty: 'General Field Tech',
          additionalSkills: ['inspection', 'troubleshooting'],
          status: 'available',
          rating: 5.0,
          completedJobsCount: 0,
          experienceYears: 1,
          hourlyRate: 2000,
        };
      }

      return null;
    } catch (e) {
      console.error('Error fetching technician profile:', e);
      return null;
    }
  }

  public static async fetchCustomers(): Promise<User[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getUsers().filter((u) => u.role === 'customer');
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('role', 'customer');

      if (error) return [];
      return (data || [])
        .filter((d: any) => !d.full_name?.startsWith('[Removed]'))
        .map((d) => ({
          id: d.id,
          email: d.email,
          fullName: d.full_name,
          role: 'customer' as UserRole,
          phone: d.phone || '',
          createdAt: d.created_at,
        }));
    } catch (e) {
      return [];
    }
  }

  public static async fetchAllUsers(): Promise<User[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getUsers();
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.error('Error fetching all profiles from Supabase:', error);
        return [];
      }

      return data
        .filter((d: any) => !d.full_name?.startsWith('[Removed]'))
        .map((d: any) => ({
          id: d.id,
          email: d.email,
          fullName: d.full_name,
          role: (d.role as UserRole) || 'customer',
          phone: d.phone || '',
          createdAt: d.created_at,
        }));
    } catch (e) {
      console.error('Error in fetchAllUsers:', e);
      return [];
    }
  }

  /**
   * MANAGER ROLE EDITING
   * - Only Manager can change roles.
   * - Updates real public.profiles.role in Supabase.
   * - If role becomes technician, ensures a technician_profiles record exists.
   */
  public static async updateUserRole(
    userId: string,
    newRole: UserRole,
    requestingUser: User | null
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    // Role check: Only Manager can change roles
    if (!requestingUser || requestingUser.role !== 'manager') {
      return {
        success: false,
        error: 'Unauthorized: Only Operations Managers are authorized to change user roles.',
      };
    }

    if (!['customer', 'technician', 'manager'].includes(newRole)) {
      return {
        success: false,
        error: 'Invalid role. Role must be customer, technician, or manager.',
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return store.updateUserRole(userId, newRole);
    }

    try {
      // 1. Update public.profiles in Supabase
      const { data, error } = await client
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('*');

      if (error) {
        console.error('Error updating user role in Supabase:', error);
        return {
          success: false,
          error: error.message || 'Failed to update user role in database.',
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          error: 'User profile not found or permission denied by database.',
        };
      }

      const updatedRow = data[0];
      const updatedUser: User = {
        id: updatedRow.id,
        email: updatedRow.email,
        fullName: updatedRow.full_name,
        role: updatedRow.role as UserRole,
        phone: updatedRow.phone || '',
        createdAt: updatedRow.created_at,
      };

      // 2. If new role is 'technician', ensure technician_profiles record exists
      if (newRole === 'technician') {
        const { data: techRow } = await client
          .from('technician_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!techRow) {
          const { error: techInsertError } = await client
            .from('technician_profiles')
            .upsert(
              {
                id: userId,
                specialty: 'General Field Tech',
                additional_skills: ['inspection', 'troubleshooting'],
                status: 'available',
                rating: 5.0,
                completed_jobs_count: 0,
                experience_years: 1,
                hourly_rate: 2000,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );

          if (techInsertError) {
            console.warn('Note: Technician profile upsert warning:', techInsertError);
          }
        }
      } else {
        // Role is no longer technician: delete technician profile record completely
        const { error: delTpErr } = await client
          .from('technician_profiles')
          .delete()
          .eq('id', userId);

        if (delTpErr) {
          console.warn('Note: Technician profile delete warning:', delTpErr);
        }

        // Safely unassign active service requests currently assigned to this user
        const { data: activeJobs, error: activeErr } = await client
          .from('service_requests')
          .select('*')
          .eq('assigned_technician_id', userId)
          .in('status', ['assigned', 'accepted', 'in_progress']);

        if (!activeErr && activeJobs && activeJobs.length > 0) {
          for (const job of activeJobs) {
            const appendNote =
              (job.work_notes ? job.work_notes + '\n\n' : '') +
              `[Role Change] Technician role removed by Operations Manager on ${new Date().toLocaleString()}. Work order safely unassigned and returned to dispatch pool.`;

            await client
              .from('service_requests')
              .update({
                status: 'approved',
                assigned_technician_id: null,
                assigned_technician_name: null,
                assigned_technician_phone: null,
                work_notes: appendNote,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            // Insert audit log
            await client.from('service_request_logs').insert({
              request_id: job.id,
              from_status: job.status,
              to_status: 'approved',
              changed_by_user_id: requestingUser.id,
              changed_by_name: requestingUser.fullName,
              changed_by_role: 'manager',
              note: 'Technician role removed from assigned technician. Work order safely returned to dispatch pool.',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Insert notification for the user
      try {
        await client.from('notifications').insert({
          recipient_user_id: userId,
          title: 'Account Role Updated',
          message: `Your account role has been updated to ${newRole.toUpperCase()} by Operations Management.`,
          is_read: false,
          type: 'system',
        });
      } catch (notifErr) {
        console.warn('Notification insert warning:', notifErr);
      }

      // Also update local cache for smooth fallback
      store.updateUserRole(userId, newRole);

      return { success: true, user: updatedUser };
    } catch (e: any) {
      console.error('Exception updating user role:', e);
      return { success: false, error: e.message || 'Error updating user role' };
    }
  }

  /**
   * MANAGER REMOVE / FIRE TECHNICIAN
   * - Strict Manager-only authorization check
   * - Safely unassigns active jobs ('assigned', 'accepted', 'in_progress'), sets status to 'approved', adds audit logs
   * - Keeps completed jobs intact for historical records
   * - Deletes from technician_profiles table in Supabase
   * - Deletes from public.profiles table (or de-authorizes role to 'customer' with [Removed] tag if foreign keys from completed historical jobs prevent delete)
   * - Updates local store cache
   */
  public static async removeTechnician(
    technicianId: string,
    requestingUser: User | null
  ): Promise<{ success: boolean; unassignedCount?: number; error?: string }> {
    if (!requestingUser || requestingUser.role !== 'manager') {
      return {
        success: false,
        error: 'Unauthorized: Only Operations Managers are authorized to remove technicians from the platform.',
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return store.removeTechnician(technicianId, requestingUser);
    }

    try {
      // 1. Fetch active service requests for this technician
      const { data: activeJobs, error: jobsError } = await client
        .from('service_requests')
        .select('*')
        .eq('assigned_technician_id', technicianId)
        .in('status', ['assigned', 'accepted', 'in_progress']);

      let unassignedCount = 0;
      if (!jobsError && activeJobs && activeJobs.length > 0) {
        unassignedCount = activeJobs.length;
        for (const job of activeJobs) {
          const appendNote =
            (job.work_notes ? job.work_notes + '\n\n' : '') +
            `[Operations Action] Technician removed from platform on ${new Date().toLocaleString()}. Work order returned to dispatch pool.`;

          await client
            .from('service_requests')
            .update({
              status: 'approved',
              assigned_technician_id: null,
              assigned_technician_name: null,
              assigned_technician_phone: null,
              work_notes: appendNote,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // Insert audit log
          await client.from('service_request_logs').insert({
            request_id: job.id,
            from_status: job.status,
            to_status: 'approved',
            changed_by_user_id: requestingUser.id,
            changed_by_name: requestingUser.fullName,
            changed_by_role: 'manager',
            note: 'Technician removed from platform by Operations Manager. Work order returned to dispatch pool.',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 2. Delete from technician_profiles table in Supabase
      const { error: techProfileDelError } = await client
        .from('technician_profiles')
        .delete()
        .eq('id', technicianId);

      if (techProfileDelError) {
        console.error('Error deleting technician profile from Supabase:', techProfileDelError);
      }

      // 3. Delete or de-authorize from public.profiles in Supabase
      const { error: profileDelError } = await client
        .from('profiles')
        .delete()
        .eq('id', technicianId);

      if (profileDelError) {
        console.warn('Permanent profile delete constrained by historical FK, de-authorizing role:', profileDelError.message);
        // Fallback: fetch current profile to get name and tag as [Removed]
        const { data: curProf } = await client.from('profiles').select('full_name').eq('id', technicianId).maybeSingle();
        const taggedName = curProf?.full_name ? (curProf.full_name.startsWith('[Removed]') ? curProf.full_name : `[Removed] ${curProf.full_name}`) : '[Removed Technician]';

        await client
          .from('profiles')
          .update({
            role: 'customer',
            full_name: taggedName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', technicianId);
      }

      // 4. Update local store cache
      store.removeTechnician(technicianId, requestingUser);

      return { success: true, unassignedCount };
    } catch (err: any) {
      console.error('Exception removing technician in Supabase:', err);
      return { success: false, error: err.message || 'Failed to remove technician from database.' };
    }
  }

  public static async fetchLogs(requestId?: string): Promise<ServiceRequestLog[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getLogs(requestId);
    }

    try {
      let query = client.from('service_request_logs').select('*').order('timestamp', { ascending: false });
      if (requestId) {
        query = query.eq('request_id', requestId);
      }
      const { data, error } = await query;
      if (error) return [];
      return (data || []).map(mapSupabaseToLog);
    } catch (e) {
      return [];
    }
  }

  public static async fetchNotifications(userId: string): Promise<NotificationItem[]> {
    const client = getSupabaseClient();
    if (!client) {
      return store.getNotifications(userId);
    }

    try {
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(mapSupabaseToNotification);
    } catch (e) {
      return [];
    }
  }

  public static async markNotificationRead(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      store.markNotificationAsRead(id);
      return;
    }

    try {
      await client.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }

  public static async markAllNotificationsRead(userId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      store.markAllNotificationsAsRead(userId);
      return;
    }

    try {
      await client.from('notifications').update({ is_read: true }).eq('recipient_user_id', userId);
    } catch (e) {
      console.error(e);
    }
  }
}
