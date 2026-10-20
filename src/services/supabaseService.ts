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

      // Check if newly added technician can immediately fulfill pending requests
      setTimeout(() => {
        SupabaseService.autoAssignPendingRequests().catch(console.error);
      }, 500);

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
   * SERVICE REQUESTS CRUD
   */

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
   * AI AUTO-DISPATCH ENGINE
   * Finds the single best available technician from real Supabase data matching
   * required category, specialty, additional skills, and current active workload.
   */
  public static async findBestAvailableTechnician(params: {
    category: ServiceCategory;
    requiredSkill?: string;
    priority?: PriorityLevel;
    additionalActiveAssignments?: Record<string, number>;
  }): Promise<{
    technician: User;
    profile: TechnicianProfile;
    matchScore: number;
    matchReason: string;
  } | null> {
    const client = getSupabaseClient();
    const technicians = (client ? await this.fetchTechnicians() : store.getUsers().filter((u) => u.role === 'technician'))
      .filter((t) => t.role === 'technician' && !t.fullName.startsWith('[Removed]'));
    const profiles = client ? await this.fetchTechnicianProfiles() : store.getTechnicianProfiles();
    const allRequests = client ? await this.fetchServiceRequests() : store.getRequests();

    if (!technicians.length || !profiles.length) {
      return null;
    }

    // Only active technicians whose profile is currently marked 'available'
    const validTechIds = new Set(technicians.map((t) => t.id));
    const availableProfiles = profiles.filter((p) => p.status === 'available' && validTechIds.has(p.id));
    if (!availableProfiles.length) {
      return null;
    }

    const categoryLower = params.category.toLowerCase();
    const skillLower = (params.requiredSkill || '').toLowerCase();

    let bestCandidate: {
      technician: User;
      profile: TechnicianProfile;
      matchScore: number;
      matchReason: string;
    } | null = null;

    for (const prof of availableProfiles) {
      const techUser = technicians.find((t) => (t.id === prof.id || t.id === prof.userId) && t.role === 'technician');
      if (!techUser || techUser.role !== 'technician') continue;

      // Active workload (tickets currently assigned, accepted, or in progress)
      const existingActiveJobs = allRequests.filter(
        (r) => r.assignedTechnicianId === techUser.id && ['assigned', 'accepted', 'in_progress'].includes(r.status)
      ).length;

      const extraAssigned = params.additionalActiveAssignments?.[techUser.id] || 0;
      const totalActiveJobs = existingActiveJobs + extraAssigned;

      // Strict workload capacity guard: max 3 concurrent active jobs
      if (totalActiveJobs >= 3) {
        continue;
      }

      const specialtyLower = (prof.specialty || '').toLowerCase();
      const additionalSkills = (prof.additionalSkills || []).map((s) => s.toLowerCase());

      let score = 0;
      const reasons: string[] = [];

      // 1. Direct Specialty Match
      if (specialtyLower === categoryLower) {
        score += 100;
        reasons.push(`Primary specialty match: ${prof.specialty}`);
      } else if (specialtyLower.includes(categoryLower) || categoryLower.includes(specialtyLower)) {
        score += 80;
        reasons.push(`Related specialty: ${prof.specialty}`);
      }

      // 2. Additional Skills Match
      const matchedSkill = additionalSkills.find(
        (s) =>
          s.includes(categoryLower) ||
          (skillLower && (s.includes(skillLower) || skillLower.includes(s)))
      );
      if (matchedSkill) {
        score += 50;
        reasons.push(`Certified skill: ${matchedSkill}`);
      }

      // 3. Generalist Backup
      if (score === 0 && (specialtyLower === 'general' || categoryLower === 'general')) {
        score += 25;
        reasons.push('General maintenance qualification');
      }

      // If no relevant skills match, technician is ineligible
      if (score === 0) {
        continue;
      }

      // 4. Rating & Quality Weight
      score += Math.round((prof.rating || 5.0) * 4);

      // 5. Workload Balancing (favor technicians with lower active commitments)
      score -= totalActiveJobs * 25;

      // 6. Experience Bonus
      score += Math.min(prof.completedJobsCount || 0, 15);

      if (!bestCandidate || score > bestCandidate.matchScore) {
        bestCandidate = {
          technician: techUser,
          profile: prof,
          matchScore: score,
          matchReason: `${reasons.join(', ')} (Workload: ${totalActiveJobs} active jobs, Rating: ${prof.rating || 5.0})`,
        };
      }
    }

    return bestCandidate;
  }

  /**
   * Automatically assigns all pending service requests when technicians become available.
   */
  public static async autoAssignPendingRequests(): Promise<AutoDispatchResult[]> {
    const client = getSupabaseClient();
    const results: AutoDispatchResult[] = [];

    let pendingRequests: ServiceRequest[] = [];
    if (client) {
      const { data, error } = await client
        .from('service_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error || !data) return [];
      pendingRequests = data.map(mapSupabaseToServiceRequest);
    } else {
      pendingRequests = store.getRequests().filter((r) => r.status === 'pending');
    }

    if (!pendingRequests.length) return [];

    // Prioritize emergency and high urgency requests first
    const priorityWeight: Record<PriorityLevel, number> = {
      emergency: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    pendingRequests.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    const newlyAssignedMap: Record<string, number> = {};

    for (const req of pendingRequests) {
      const bestCandidate = await this.findBestAvailableTechnician({
        category: req.category,
        priority: req.priority,
        additionalActiveAssignments: newlyAssignedMap,
      });

      if (bestCandidate) {
        // Enforce: Verify candidate profile role is strictly 'technician'
        if (client) {
          const verified = await this.getProfile(bestCandidate.technician.id);
          if (!verified || verified.role !== 'technician') {
            continue;
          }
        }

        newlyAssignedMap[bestCandidate.technician.id] = (newlyAssignedMap[bestCandidate.technician.id] || 0) + 1;
        const assignedTime = new Date().toISOString();
        if (client) {
          const { error: updateErr } = await client
            .from('service_requests')
            .update({
              status: 'assigned',
              assigned_technician_id: bestCandidate.technician.id,
              assigned_technician_name: bestCandidate.technician.fullName,
              assigned_technician_phone: bestCandidate.technician.phone,
              assigned_at: assignedTime,
              updated_at: assignedTime,
            })
            .eq('id', req.id);

          if (!updateErr) {
            // Audit Log
            await client.from('service_request_logs').insert({
              request_id: req.id,
              from_status: 'pending',
              to_status: 'assigned',
              changed_by_user_id: bestCandidate.technician.id,
              changed_by_name: 'AI Auto-Dispatch Engine',
              changed_by_role: 'manager',
              note: `AI Auto-Dispatch: Automatically assigned pending ticket to ${bestCandidate.technician.fullName} (${bestCandidate.profile.specialty}) as technician became available.`,
            });

            // Notify Technician
            await client.from('notifications').insert({
              recipient_user_id: bestCandidate.technician.id,
              title: `New Job Auto-Dispatched: ${req.ticketNumber}`,
              message: `Pending ${req.category} ticket was auto-assigned to you upon availability: "${req.title}".`,
              request_id: req.id,
              type: 'assignment',
            });

            // Notify Customer
            await client.from('notifications').insert({
              recipient_user_id: req.customerId,
              title: `Technician Dispatched: ${req.ticketNumber}`,
              message: `Good news! Certified technician ${bestCandidate.technician.fullName} is available and has been auto-assigned to your request.`,
              request_id: req.id,
              type: 'status_change',
            });

            results.push({
              assigned: true,
              requestId: req.id,
              ticketNumber: req.ticketNumber,
              technicianId: bestCandidate.technician.id,
              technicianName: bestCandidate.technician.fullName,
              technicianPhone: bestCandidate.technician.phone,
              matchedCategory: req.category,
              matchedSkill: bestCandidate.profile.specialty,
              reason: bestCandidate.matchReason,
            });
          }
        } else {
          // Local Store
          store.autoAssignPendingRequests();
          results.push({
            assigned: true,
            requestId: req.id,
            ticketNumber: req.ticketNumber,
            technicianId: bestCandidate.technician.id,
            technicianName: bestCandidate.technician.fullName,
            technicianPhone: bestCandidate.technician.phone,
            matchedCategory: req.category,
            matchedSkill: bestCandidate.profile.specialty,
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
        autoDispatchedTo: req.assignedTechnicianName || null,
      };
    }

    try {
      const customer = await this.getProfile(params.customerId);
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `FXN-${year}-${randomSuffix}`;

      // Check real Supabase technician data for matching skills, availability, and active-job capacity
      let bestCandidate = await this.findBestAvailableTechnician({
        category: params.category,
        requiredSkill: params.requiredSkill,
        priority: params.priority,
      });

      if (bestCandidate) {
        const verified = await this.getProfile(bestCandidate.technician.id);
        if (!verified || verified.role !== 'technician') {
          bestCandidate = null;
        }
      }

      const isAutoAssigned = Boolean(bestCandidate);
      const initialStatus = isAutoAssigned ? 'assigned' : 'pending';
      const nowIso = new Date().toISOString();

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
        status: initialStatus,
        service_address: params.serviceAddress,
        preferred_date: params.preferredDate,
        preferred_time_slot: params.preferredTimeSlot,
        attachments: params.attachments || [],
        assigned_technician_id: isAutoAssigned ? bestCandidate!.technician.id : null,
        assigned_technician_name: isAutoAssigned ? bestCandidate!.technician.fullName : null,
        assigned_technician_phone: isAutoAssigned ? bestCandidate!.technician.phone : null,
        assigned_at: isAutoAssigned ? nowIso : null,
        work_notes: params.technicianSummary || params.requiredSkill ? `[AI Technician Brief] Skill: ${params.requiredSkill || 'General'}. Summary: ${params.technicianSummary || ''}` : null,
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

      if (isAutoAssigned && bestCandidate) {
        // Audit Log: Auto-Dispatched
        await client.from('service_request_logs').insert({
          request_id: newRequest.id,
          from_status: 'pending',
          to_status: 'assigned',
          changed_by_user_id: bestCandidate.technician.id,
          changed_by_name: 'AI Auto-Dispatch Engine',
          changed_by_role: 'manager',
          note: `AI Auto-Dispatch: Automatically matched and assigned to technician ${bestCandidate.technician.fullName} (${bestCandidate.profile.specialty}). Reason: ${bestCandidate.matchReason}`,
        });

        // Notify Technician
        await client.from('notifications').insert({
          recipient_user_id: bestCandidate.technician.id,
          title: `New Job Auto-Dispatched: ${newRequest.ticketNumber}`,
          message: `AI dispatched ${newRequest.category} ticket "${newRequest.title}" to you based on your certified skills.`,
          request_id: newRequest.id,
          type: 'assignment',
        });
      } else {
        // Audit Log: Placed in Pending Queue
        await client.from('service_request_logs').insert({
          request_id: newRequest.id,
          from_status: 'pending',
          to_status: 'pending',
          changed_by_user_id: params.customerId,
          changed_by_name: newRequest.customerName,
          changed_by_role: 'customer',
          note: `AI Dispatch Queue: No matching technician currently available with '${params.category}' skill. Request placed in Pending queue for auto-assignment when a technician becomes available.`,
        });
      }

      return {
        success: true,
        request: newRequest,
        autoDispatchedTo: isAutoAssigned ? bestCandidate!.technician.fullName : null,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error creating request' };
    }
  }

  public static async approveServiceRequest(
    requestId: string,
    manager: User
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.approveServiceRequest(requestId, manager);
    }

    try {
      const { data: req, error: fetchErr } = await client
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchErr || !req) return { success: false, error: 'Request not found' };

      const { error: updateErr } = await client
        .from('service_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

      // Audit log
      await client.from('service_request_logs').insert({
        request_id: requestId,
        from_status: req.status,
        to_status: 'approved',
        changed_by_user_id: manager.id,
        changed_by_name: manager.fullName,
        changed_by_role: 'manager',
        note: 'Service request approved by Operations Manager for technician assignment.',
      });

      // Notification
      await client.from('notifications').insert({
        recipient_user_id: req.customer_id,
        title: `Request Approved: ${req.ticket_number}`,
        message: 'Your service request has been approved and is ready for technician dispatch.',
        request_id: requestId,
        type: 'status_change',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async assignTechnician(
    requestId: string,
    technicianId: string,
    manager: User
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return store.assignTechnician(requestId, technicianId, manager);
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
        .single();

      if (fetchErr || !req) return { success: false, error: 'Request not found' };

      const { error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'assigned',
          assigned_technician_id: techProfile.id,
          assigned_technician_name: techProfile.fullName,
          assigned_technician_phone: techProfile.phone,
          assigned_at: new Date().toISOString(),
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

      // Audit Log
      await client.from('service_request_logs').insert({
        request_id: requestId,
        from_status: req.status,
        to_status: 'assigned',
        changed_by_user_id: manager.id,
        changed_by_name: manager.fullName,
        changed_by_role: 'manager',
        note: `Assigned to technician ${techProfile.fullName} (${techProfile.phone}).`,
      });

      // Notify technician
      await client.from('notifications').insert({
        recipient_user_id: techProfile.id,
        title: `New Job Assigned: ${req.ticket_number}`,
        message: `You have been assigned to ${req.category} ticket "${req.title}". Please accept or decline.`,
        request_id: requestId,
        type: 'assignment',
      });

      return { success: true };
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

      // Immediately auto-assign any pending requests now that this technician is available
      setTimeout(() => {
        SupabaseService.autoAssignPendingRequests().catch(console.error);
      }, 500);

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

      const { error: updateErr } = await client
        .from('service_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) return { success: false, error: updateErr.message };

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

      // If technician became available, trigger auto-assignment on pending requests
      if (status === 'available') {
        setTimeout(() => {
          SupabaseService.autoAssignPendingRequests().catch(console.error);
        }, 500);
      }
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

      if (error || !data) return [];

      const activeTechIds =
        !techUserErr && techUsers && techUsers.length > 0
          ? new Set(
              techUsers
                .filter((t: any) => !t.full_name?.startsWith('[Removed]'))
                .map((t: any) => t.id)
            )
          : null;

      // Return profiles matching active technicians (without destructively deleting rows during fetch)
      return data
        .filter((d: any) => (activeTechIds ? activeTechIds.has(d.id) : true))
        .map((d: any) => ({
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
        }));
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

      if (error || !data) return null;
      return {
        id: data.id,
        userId: data.id,
        specialty: data.specialty,
        additionalSkills: data.additional_skills || [],
        status: data.status,
        rating: data.rating ? Number(data.rating) : 5.0,
        completedJobsCount: data.completed_jobs_count ? Number(data.completed_jobs_count) : 0,
        experienceYears: data.experience_years ? Number(data.experience_years) : undefined,
        licenseNumber: data.license_number || undefined,
        hourlyRate: data.hourly_rate ? Number(data.hourly_rate) : 2000,
      };
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
   * - Refreshes notifications and triggers auto-assignment if tech becomes available.
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

        // Trigger automatic assignment evaluation for any pending requests
        setTimeout(() => {
          SupabaseService.autoAssignPendingRequests().catch(console.error);
        }, 500);
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

          // Evaluate auto-dispatch so other qualified technicians receive the jobs
          setTimeout(() => {
            SupabaseService.autoAssignPendingRequests().catch(console.error);
          }, 600);
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
   * - Re-triggers auto-assignment for unassigned jobs
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

      // 5. If any active jobs were returned to dispatch pool, evaluate auto-dispatch
      if (unassignedCount > 0) {
        setTimeout(() => {
          SupabaseService.autoAssignPendingRequests().catch(console.error);
        }, 600);
      }

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
