import {
  User,
  UserRole,
  TechnicianProfile,
  ServiceRequest,
  ServiceRequestLog,
  NotificationItem,
  ServiceStatus,
  PriorityLevel,
  ServiceCategory,
  ServiceAddress,
  PartItem,
  ServiceRating,
  RescheduleProposal,
  PaymentRecord,
  PaymentMethod,
} from '../types';
import {
  DEFAULT_CATEGORY_RATES,
  WORKING_TIME_SLOTS,
  WORKING_HOURS_START,
  WORKING_HOURS_END,
  mapSpecialtyToCategory,
} from '../utils/currency';

const STORAGE_KEYS = {
  USERS: 'fixnear_users',
  TECH_PROFILES: 'fixnear_technician_profiles',
  REQUESTS: 'fixnear_service_requests',
  LOGS: 'fixnear_service_request_logs',
  NOTIFICATIONS: 'fixnear_notifications',
  CURRENT_USER_ID: 'fixnear_current_user_id',
  SERVICE_RATES: 'fixnear_service_category_rates',
};

class FixNearStore {
  private listeners: Set<() => void> = new Set();
  private memoryStorage: Map<string, string> = new Map();

  private getStorageItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        return this.memoryStorage.get(key) || null;
      }
    }
    return this.memoryStorage.get(key) || null;
  }

  private setStorageItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch {
        this.memoryStorage.set(key, value);
      }
    } else {
      this.memoryStorage.set(key, value);
    }
  }

  private removeStorageItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        this.memoryStorage.delete(key);
      }
    } else {
      this.memoryStorage.delete(key);
    }
  }

  private load<T>(key: string, defaultValue: T): T {
    try {
      const data = this.getStorageItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data);
    } catch (e) {
      console.error(`Error loading key ${key} from storage:`, e);
      return defaultValue;
    }
  }

  private save<T>(key: string, value: T): void {
    try {
      this.setStorageItem(key, JSON.stringify(value));
      this.notify();
    } catch (e) {
      console.error(`Error saving key ${key} to storage:`, e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
  }

  // ==========================================
  // USERS & AUTH MANAGEMENT
  // ==========================================

  public getUsers(): User[] {
    return this.load<User[]>(STORAGE_KEYS.USERS, []);
  }

  public getUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.getUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  public getCurrentUserId(): string | null {
    return this.getStorageItem(STORAGE_KEYS.CURRENT_USER_ID);
  }

  public setCurrentUserId(id: string | null): void {
    if (id) {
      this.setStorageItem(STORAGE_KEYS.CURRENT_USER_ID, id);
    } else {
      this.removeStorageItem(STORAGE_KEYS.CURRENT_USER_ID);
    }
    this.notify();
  }

  public getCurrentUser(): User | null {
    const id = this.getCurrentUserId();
    if (!id) return null;
    return this.getUserById(id) || null;
  }

  /**
   * CUSTOMER REGISTRATION ONLY
   * Strict enforcement: role is hardcoded to 'customer'.
   * Never defaults or allows any other role.
   */
  public registerCustomer(params: {
    email: string;
    fullName: string;
    phone: string;
    password?: string;
  }): { success: boolean; user?: User; error?: string } {
    const existing = this.getUserByEmail(params.email);
    if (existing) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const newUser: User = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      role: 'customer', // STRICT: ONLY customer
      password: params.password || 'password123',
      createdAt: new Date().toISOString(),
    };

    const users = this.getUsers();
    users.push(newUser);
    this.save(STORAGE_KEYS.USERS, users);

    // Create system notification
    this.addNotification({
      recipientUserId: newUser.id,
      title: 'Welcome to FixNear',
      message: `Your customer account (${newUser.fullName}) is ready. You can now submit service requests anytime.`,
      type: 'system',
    });

    return { success: true, user: newUser };
  }

  /**
   * TECHNICIAN REGISTRATION BY MANAGER ONLY
   * CRITICAL REQUIREMENT:
   * Creating a Technician must create ONLY a Technician with role = 'technician'.
   * It must NEVER create a Customer.
   */
  public createTechnicianByManager(params: {
    email: string;
    fullName: string;
    phone: string;
    password?: string;
    specialty: string;
    additionalSkills?: string[];
    experienceYears?: number;
    licenseNumber?: string;
    hourlyRate?: number;
  }): { success: boolean; user?: User; error?: string } {
    const existing = this.getUserByEmail(params.email);
    if (existing) {
      return { success: false, error: 'A user account with this email already exists.' };
    }

    // STRICT: Explicitly typed and checked
    const strictRole: UserRole = 'technician';

    const newTechUser: User = {
      id: 'tech_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      role: strictRole, // CRITICAL: NEVER CUSTOMER
      password: params.password || 'tech1234',
      createdAt: new Date().toISOString(),
    };

    const users = this.getUsers();
    users.push(newTechUser);
    this.save(STORAGE_KEYS.USERS, users);

    // Save technician-specific profile
    const techProfiles = this.getTechnicianProfiles();
    const newProfile: TechnicianProfile = {
      id: newTechUser.id,
      userId: newTechUser.id,
      specialty: params.specialty,
      additionalSkills: params.additionalSkills || [],
      status: 'available',
      rating: 5.0,
      completedJobsCount: 0,
      experienceYears: params.experienceYears,
      licenseNumber: params.licenseNumber,
      hourlyRate: params.hourlyRate || 2000,
    };
    techProfiles.push(newProfile);
    this.save(STORAGE_KEYS.TECH_PROFILES, techProfiles);

    this.addNotification({
      recipientUserId: newTechUser.id,
      title: 'Technician Account Provisioned',
      message: `Welcome ${newTechUser.fullName}. You have been authorized by management as a Service Technician.`,
      type: 'system',
    });

    return { success: true, user: newTechUser };
  }

  /**
   * PROVISION INITIAL MANAGER
   * Strict role = 'manager'
   */
  public provisionInitialManager(params: {
    email: string;
    fullName: string;
    phone: string;
    password?: string;
  }): { success: boolean; user?: User; error?: string } {
    const existing = this.getUserByEmail(params.email);
    if (existing) {
      if (existing.role === 'manager') {
        return { success: true, user: existing };
      }
      return { success: false, error: 'An account with this email already exists with a different role.' };
    }

    const newManager: User = {
      id: 'mgr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      role: 'manager', // STRICT: ONLY manager
      password: params.password || 'admin123',
      createdAt: new Date().toISOString(),
    };

    const users = this.getUsers();
    users.push(newManager);
    this.save(STORAGE_KEYS.USERS, users);

    return { success: true, user: newManager };
  }

  /**
   * UPDATE USER ROLE
   * Manager updates a user's role between 'customer', 'technician', 'manager'.
   */
  public updateUserRole(
    userId: string,
    newRole: UserRole
  ): { success: boolean; user?: User; error?: string } {
    if (!['customer', 'technician', 'manager'].includes(newRole)) {
      return { success: false, error: 'Invalid role specified. Must be customer, technician, or manager.' };
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'User not found in store.' };
    }

    users[index].role = newRole;
    this.save(STORAGE_KEYS.USERS, users);

    // If role changed to technician, ensure a technician profile exists
    if (newRole === 'technician') {
      const techProfiles = this.load<TechnicianProfile[]>(STORAGE_KEYS.TECH_PROFILES, []);
      const existing = techProfiles.find((p) => p.userId === userId || p.id === userId);
      if (!existing) {
        techProfiles.push({
          id: userId,
          userId: userId,
          specialty: 'General Field Tech',
          additionalSkills: ['maintenance', 'inspection', 'troubleshooting'],
          status: 'available',
          rating: 5.0,
          completedJobsCount: 0,
          experienceYears: 1,
          hourlyRate: 2000,
        });
        this.save(STORAGE_KEYS.TECH_PROFILES, techProfiles);
      }
    } else {
      // If role changed away from technician, remove their technician profile
      const techProfiles = this.load<TechnicianProfile[]>(STORAGE_KEYS.TECH_PROFILES, []);
      const filtered = techProfiles.filter((p) => p.id !== userId && p.userId !== userId);
      this.save(STORAGE_KEYS.TECH_PROFILES, filtered);

      // Safely unassign active jobs ('assigned', 'accepted', 'in_progress')
      const requests = this.getRequests();
      let requestsModified = false;
      requests.forEach((r) => {
        if (
          r.assignedTechnicianId === userId &&
          ['assigned', 'accepted', 'in_progress'].includes(r.status)
        ) {
          r.assignedTechnicianId = undefined;
          r.assignedTechnicianName = undefined;
          r.assignedTechnicianPhone = undefined;
          r.status = 'approved';
          requestsModified = true;

          // Add audit log for safe unassignment
          this.addLog({
            requestId: r.id,
            fromStatus: r.status,
            toStatus: 'approved',
            changedByUserId: 'manager',
            changedByName: 'Operations Manager',
            changedByRole: 'manager',
            note: 'Technician role removed. Work order returned to dispatch pool for re-assignment.',
          });
        }
      });
      if (requestsModified) {
        this.save(STORAGE_KEYS.REQUESTS, requests);
      }
    }

    this.addNotification({
      recipientUserId: userId,
      title: 'Role Updated',
      message: `Your account role has been updated to ${newRole.toUpperCase()} by Operations Management.`,
      type: 'system',
    });

    return { success: true, user: users[index] };
  }

  public getTechnicianProfiles(): TechnicianProfile[] {
    const raw = this.load<TechnicianProfile[]>(STORAGE_KEYS.TECH_PROFILES, []);
    // Strict guard: only return profiles for users whose current role in store is technician
    const activeTechIds = new Set(
      this.getUsers()
        .filter((u) => u.role === 'technician' && !u.fullName?.startsWith('[Removed]'))
        .map((u) => u.id)
    );
    return raw.filter((p) => activeTechIds.has(p.id) || activeTechIds.has(p.userId));
  }

  public getTechnicianProfile(userId: string): TechnicianProfile | undefined {
    return this.getTechnicianProfiles().find((p) => p.userId === userId);
  }

  public updateTechnicianStatus(userId: string, status: 'available' | 'on_job' | 'off_duty'): void {
    const profiles = this.load<TechnicianProfile[]>(STORAGE_KEYS.TECH_PROFILES, []);
    const index = profiles.findIndex((p) => p.userId === userId || p.id === userId);
    if (index !== -1) {
      profiles[index].status = status;
      this.save(STORAGE_KEYS.TECH_PROFILES, profiles);
    }
  }

  /**
   * MANAGER FEE MANAGEMENT: Update individual technician hourly rate & specialty
   */
  public updateTechnicianFee(
    technicianId: string,
    hourlyRate: number,
    specialty?: string,
    requestingUser?: User | null
  ): { success: boolean; profile?: TechnicianProfile; error?: string } {
    if (requestingUser && requestingUser.role !== 'manager') {
      return {
        success: false,
        error: 'Unauthorized: Only Operations Managers can edit technician fees.',
      };
    }

    const numericRate = Number(hourlyRate);
    if (!Number.isFinite(numericRate) || numericRate < 100 || numericRate > 500000) {
      return {
        success: false,
        error: 'Please enter a valid hourly rate between PKR 100 and PKR 500,000.',
      };
    }

    const profiles = this.load<TechnicianProfile[]>(STORAGE_KEYS.TECH_PROFILES, []);
    const index = profiles.findIndex((p) => p.id === technicianId || p.userId === technicianId);

    let updatedProfile: TechnicianProfile;
    if (index !== -1) {
      profiles[index].hourlyRate = Math.round(numericRate);
      if (specialty && specialty.trim()) {
        profiles[index].specialty = specialty.trim();
      }
      updatedProfile = profiles[index];
    } else {
      updatedProfile = {
        id: technicianId,
        userId: technicianId,
        specialty: specialty?.trim() || 'General Field Tech',
        additionalSkills: ['inspection', 'troubleshooting'],
        status: 'available',
        rating: 5.0,
        completedJobsCount: 0,
        experienceYears: 2,
        hourlyRate: Math.round(numericRate),
      };
      profiles.push(updatedProfile);
    }

    this.save(STORAGE_KEYS.TECH_PROFILES, profiles);

    // Also sync the matching service category rate if applicable
    const cat = mapSpecialtyToCategory(updatedProfile.specialty);
    const currentRates = this.getServiceCategoryRates();
    currentRates[cat] = Math.round(numericRate);
    this.save(STORAGE_KEYS.SERVICE_RATES, currentRates);

    return { success: true, profile: updatedProfile };
  }

  /**
   * MANAGER FEE MANAGEMENT: Get & update standard service category hourly prices
   */
  public getServiceCategoryRates(): Record<ServiceCategory, number> {
    const saved = this.load<Partial<Record<ServiceCategory, number>>>(STORAGE_KEYS.SERVICE_RATES, {});
    const profiles = this.getTechnicianProfiles();
    const derived: Partial<Record<ServiceCategory, number>> = {};

    for (const prof of profiles) {
      if (prof.hourlyRate && prof.hourlyRate > 0) {
        const cat = mapSpecialtyToCategory(prof.specialty);
        if (!derived[cat]) {
          derived[cat] = prof.hourlyRate;
        }
      }
    }

    return {
      plumbing: Number(saved.plumbing || derived.plumbing || DEFAULT_CATEGORY_RATES.plumbing),
      electrical: Number(saved.electrical || derived.electrical || DEFAULT_CATEGORY_RATES.electrical),
      hvac: Number(saved.hvac || derived.hvac || DEFAULT_CATEGORY_RATES.hvac),
      appliance: Number(saved.appliance || derived.appliance || DEFAULT_CATEGORY_RATES.appliance),
      carpentry: Number(saved.carpentry || derived.carpentry || DEFAULT_CATEGORY_RATES.carpentry),
      general: Number(saved.general || derived.general || DEFAULT_CATEGORY_RATES.general),
    };
  }

  public updateServiceCategoryRates(
    rates: Partial<Record<ServiceCategory, number>>,
    syncTechnicianProfiles = true,
    requestingUser?: User | null
  ): { success: boolean; rates?: Record<ServiceCategory, number>; error?: string } {
    if (requestingUser && requestingUser.role !== 'manager') {
      return {
        success: false,
        error: 'Unauthorized: Only Operations Managers can edit service prices.',
      };
    }

    const current = this.getServiceCategoryRates();
    const updated: Record<ServiceCategory, number> = { ...current };

    for (const [key, val] of Object.entries(rates)) {
      const cat = key as ServiceCategory;
      const num = Number(val);
      if (!Number.isFinite(num) || num < 100 || num > 500000) {
        return {
          success: false,
          error: `Invalid price for ${cat}: Rate must be between PKR 100 and PKR 500,000/hour.`,
        };
      }
      updated[cat] = Math.round(num);
    }

    this.save(STORAGE_KEYS.SERVICE_RATES, updated);

    if (syncTechnicianProfiles) {
      const profiles = this.load<TechnicianProfile[]>(STORAGE_KEYS.TECH_PROFILES, []);
      let changed = false;
      for (const prof of profiles) {
        const cat = mapSpecialtyToCategory(prof.specialty);
        if (updated[cat] && prof.hourlyRate !== updated[cat]) {
          prof.hourlyRate = updated[cat];
          changed = true;
        }
      }
      if (changed) {
        this.save(STORAGE_KEYS.TECH_PROFILES, profiles);
      }
    }

    return { success: true, rates: updated };
  }

  /**
   * Validates that an appointment slot is strictly within working hours (9:00 AM – 6:00 PM)
   * and finishes on or before 6:00 PM.
   */
  public parseAndValidateSlot(
    slot?: string,
    durationHours = 1
  ): {
    valid: boolean;
    startHour: number;
    endHour: number;
    canonical: string;
    error?: string;
  } {
    const raw = (slot || '').trim();
    const lower = raw.toLowerCase();

    if (lower.includes('evening') || lower.includes('night') || lower.includes('08:00 pm') || lower.includes('8:00 pm')) {
      return {
        valid: false,
        startHour: 18,
        endHour: 20,
        canonical: WORKING_TIME_SLOTS[0],
        error:
          'Technicians can only be scheduled during working hours (9:00 AM – 6:00 PM). Jobs cannot start at or after 6:00 PM or extend past 6:00 PM.',
      };
    }

    const matches = Array.from(lower.matchAll(/(\d{1,2}):(\d{2})\s*(am|pm)?/gi));
    const to24Hr = (hrStr: string, minStr: string, mer?: string): number => {
      let h = parseInt(hrStr, 10);
      const m = parseInt(minStr, 10) / 60;
      const meridiem = (mer || '').toLowerCase();
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      return h + m;
    };

    let startHour = 9;
    let endHour = 11;

    if (matches.length >= 2) {
      startHour = to24Hr(matches[0][1], matches[0][2], matches[0][3]);
      endHour = to24Hr(matches[1][1], matches[1][2], matches[1][3]);
    } else if (matches.length === 1) {
      startHour = to24Hr(matches[0][1], matches[0][2], matches[0][3]);
      endHour = startHour + Math.max(1, durationHours);
    } else if (lower.includes('afternoon')) {
      startHour = 13;
      endHour = 17;
    } else if (lower.includes('morning')) {
      startHour = 9;
      endHour = 12;
    }

    const reqDuration = Math.max(1, durationHours);
    if (startHour < WORKING_HOURS_START) {
      return {
        valid: false,
        startHour,
        endHour,
        canonical: WORKING_TIME_SLOTS[0],
        error: 'Appointments cannot start before 9:00 AM (Working Hours: 9:00 AM – 6:00 PM).',
      };
    }
    if (startHour >= WORKING_HOURS_END) {
      return {
        valid: false,
        startHour,
        endHour,
        canonical: WORKING_TIME_SLOTS[0],
        error: 'Appointments cannot start at or after 6:00 PM (Working Hours: 9:00 AM – 6:00 PM).',
      };
    }
    if (endHour > WORKING_HOURS_END || startHour + reqDuration > WORKING_HOURS_END || endHour <= startHour) {
      return {
        valid: false,
        startHour,
        endHour,
        canonical: WORKING_TIME_SLOTS[0],
        error:
          'The entire appointment must finish by 6:00 PM (Working Hours: 9:00 AM – 6:00 PM). For example, a 1-hour job must start no later than 5:00 PM.',
      };
    }

    let canonical: string = WORKING_TIME_SLOTS[0];
    if (startHour >= 17) canonical = WORKING_TIME_SLOTS[4];
    else if (startHour >= 15) canonical = WORKING_TIME_SLOTS[3];
    else if (startHour >= 13) canonical = WORKING_TIME_SLOTS[2];
    else if (startHour >= 11) canonical = WORKING_TIME_SLOTS[1];

    return { valid: true, startHour, endHour, canonical };
  }

  /**
   * REMOVE / FIRE TECHNICIAN
   * Operations Manager removes a technician from the platform:
   * - Unassigns active jobs ('assigned', 'accepted', 'in_progress') and resets to 'approved'
   * - Adds audit log and updates request notes
   * - Deletes technician profile
   * - Removes technician from users
   * - Historical completed jobs and audit logs remain intact
   */
  public removeTechnician(
    technicianId: string,
    requestingUser?: User | null
  ): { success: boolean; unassignedCount?: number; error?: string } {
    if (requestingUser && requestingUser.role !== 'manager') {
      return {
        success: false,
        error: 'Unauthorized: Only Operations Managers are authorized to remove technicians.',
      };
    }

    // 1. Unassign active jobs and return to dispatch pool
    const requests = this.getRequests();
    let unassignedCount = 0;
    const updatedRequests = requests.map((req) => {
      if (
        req.assignedTechnicianId === technicianId &&
        ['assigned', 'accepted', 'in_progress'].includes(req.status)
      ) {
        unassignedCount++;
        const prevStatus = req.status;
        const appendNote = (req.workNotes ? req.workNotes + '\n\n' : '') +
          `[Operations Action] Technician was removed from platform on ${new Date().toLocaleString()}. Work order returned to dispatch pool.`;

        this.addLog({
          requestId: req.id,
          fromStatus: prevStatus,
          toStatus: 'approved',
          changedByUserId: requestingUser?.id || 'system',
          changedByName: requestingUser?.fullName || 'Operations Manager',
          changedByRole: 'manager',
          note: 'Technician removed from platform by Operations Manager. Job returned to dispatch pool.',
        });

        return {
          ...req,
          status: 'approved' as const,
          assignedTechnicianId: undefined,
          assignedTechnicianName: undefined,
          assignedTechnicianPhone: undefined,
          workNotes: appendNote,
          updatedAt: new Date().toISOString(),
        };
      }
      return req;
    });

    this.save(STORAGE_KEYS.REQUESTS, updatedRequests);

    // 2. Remove technician profile
    const techProfiles = this.getTechnicianProfiles().filter(
      (p) => p.id !== technicianId && p.userId !== technicianId
    );
    this.save(STORAGE_KEYS.TECH_PROFILES, techProfiles);

    // 3. Remove user from users list
    const users = this.getUsers().filter((u) => u.id !== technicianId);
    this.save(STORAGE_KEYS.USERS, users);

    return { success: true, unassignedCount };
  }

  // ==========================================
  // SERVICE REQUESTS LIFECYCLE (PRD WORKFLOW)
  // Pending → Approved → Assigned → Accepted → In Progress → Completed
  // Pending → Cancelled
  // ==========================================

  public getRequests(): ServiceRequest[] {
    return this.load<ServiceRequest[]>(STORAGE_KEYS.REQUESTS, []);
  }

  public getRequestById(id: string): ServiceRequest | undefined {
    return this.getRequests().find((r) => r.id === id);
  }

  public createServiceRequest(params: {
    customerId: string;
    title: string;
    category: ServiceCategory;
    description: string;
    priority: PriorityLevel;
    serviceAddress: ServiceAddress;
    preferredDate: string;
    preferredTimeSlot: string;
    attachments?: string[];
  }): ServiceRequest {
    const customer = this.getUserById(params.customerId);
    const existingCount = this.getRequests().length;
    const year = new Date().getFullYear();
    const ticketNumber = `FXN-${year}-${String(existingCount + 1).padStart(4, '0')}`;

    const newRequest: ServiceRequest = {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      ticketNumber,
      customerId: params.customerId,
      customerName: customer ? customer.fullName : 'Customer',
      customerPhone: customer ? customer.phone : params.serviceAddress.contactPhone || '',
      customerEmail: customer ? customer.email : '',
      title: params.title.trim(),
      category: params.category,
      description: params.description.trim(),
      priority: params.priority,
      status: 'pending', // Starts at Pending
      serviceAddress: params.serviceAddress,
      preferredDate: params.preferredDate,
      preferredTimeSlot: params.preferredTimeSlot,
      attachments: params.attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const requests = this.getRequests();
    requests.unshift(newRequest);
    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: newRequest.id,
      fromStatus: 'pending',
      toStatus: 'pending',
      changedByUserId: params.customerId,
      changedByName: newRequest.customerName,
      changedByRole: 'customer',
      note: 'Service request submitted by customer. Awaiting Operations Manager approval before AI Dispatch.',
    });

    return newRequest;
  }

  public autoAssignPendingRequests(): {
    assigned: boolean;
    requestId: string;
    ticketNumber: string;
    techName?: string;
    scheduledDate?: string;
    scheduledTimeSlot?: string;
  }[] {
    const requests = this.getRequests();
    // Strictly dispatch ONLY manager-approved unassigned requests
    const approvedQueue = requests.filter(
      (r) => r.status === 'approved' && !r.assignedTechnicianId
    );
    if (!approvedQueue.length) return [];

    // Prioritize Urgent (emergency, high) ahead of Normal (medium, low)
    const priorityRank: Record<PriorityLevel, number> = {
      emergency: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    approvedQueue.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);

    const techProfiles = this.getTechnicianProfiles();
    const technicians = this.getUsers().filter((u) => u.role === 'technician');
    const availableProfiles = techProfiles.filter((p) => p.status === 'available');
    const results: {
      assigned: boolean;
      requestId: string;
      ticketNumber: string;
      techName?: string;
      scheduledDate?: string;
      scheduledTimeSlot?: string;
    }[] = [];

    const workingSlots = [...WORKING_TIME_SLOTS];

    const slotsOverlap = (slotA?: string, slotB?: string): boolean => {
      const a = this.parseAndValidateSlot(slotA);
      const b = this.parseAndValidateSlot(slotB);
      return a.startHour < b.endHour && b.startHour < a.endHour;
    };

    for (const req of approvedQueue) {
      let bestTech: User | null = null;
      let bestProf: TechnicianProfile | null = null;
      let bestScore = -999;
      let bestDate = req.preferredDate;
      let bestSlot: string = workingSlots[0];

      for (const prof of availableProfiles) {
        const tech = technicians.find((t) => t.id === prof.id || t.id === prof.userId);
        if (!tech) continue;

        const techActiveJobs = requests.filter(
          (r) =>
            r.id !== req.id &&
            r.assignedTechnicianId === tech.id &&
            ['assigned', 'accepted', 'in_progress'].includes(r.status)
        );
        if (techActiveJobs.length >= 3) continue;

        let skillScore = 0;
        const spec = (prof.specialty || '').toLowerCase();
        const cat = req.category.toLowerCase();

        if (spec === cat || spec.includes(cat) || cat.includes(spec)) skillScore += 100;
        else if ((prof.additionalSkills || []).some((s) => s.toLowerCase().includes(cat))) skillScore += 65;
        else if (spec.includes('general') || spec.includes('maintenance') || cat === 'general') skillScore += 35;

        // Strictly require matching skill/qualification — never assign an unsuitable technician
        if (skillScore <= 0) continue;

        let score = skillScore;

        // Find conflict-free date and working-hours slot (9:00 AM – 6:00 PM)
        const now = new Date();
        const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];
        const tomorrowStr = new Date(now.getTime() + 86400000 - now.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];
        const defaultDate = now.getHours() >= WORKING_HOURS_END - 1 ? tomorrowStr : todayStr;
        const baseDate = req.preferredDate && req.preferredDate >= todayStr ? req.preferredDate : defaultDate;

        const parsedReqSlot = this.parseAndValidateSlot(req.preferredTimeSlot);

        const isSlotInPast = (d: string, sl: string) => {
          if (d > todayStr) return false;
          if (d < todayStr) return true;
          const win = this.parseAndValidateSlot(sl);
          return now.getHours() >= win.endHour - 1;
        };

        const hasConflict = (d: string, sl: string) =>
          techActiveJobs.some(
            (job) =>
              job.preferredDate === d &&
              slotsOverlap(job.preferredTimeSlot, sl)
          );

        let chosenDate = '';
        let chosenSlot = '';

        if (
          parsedReqSlot.valid &&
          !isSlotInPast(baseDate, parsedReqSlot.canonical) &&
          !hasConflict(baseDate, parsedReqSlot.canonical)
        ) {
          chosenDate = baseDate;
          chosenSlot = parsedReqSlot.canonical;
          score += 25;
        } else {
          for (let offset = 0; offset < 14 && !chosenDate; offset++) {
            const dObj = new Date(baseDate + 'T00:00:00');
            dObj.setDate(dObj.getDate() + offset);
            const candidateDate = dObj.toISOString().split('T')[0];
            for (const slotOption of workingSlots) {
              if (!isSlotInPast(candidateDate, slotOption) && !hasConflict(candidateDate, slotOption)) {
                chosenDate = candidateDate;
                chosenSlot = slotOption;
                break;
              }
            }
          }
        }

        if (!chosenDate || !chosenSlot) continue;

        score += (prof.rating || 5) * 4;
        score -= techActiveJobs.length * 25;

        if (score > bestScore) {
          bestScore = score;
          bestTech = tech;
          bestProf = prof;
          bestDate = chosenDate;
          bestSlot = chosenSlot;
        }
      }

      if (bestTech && bestProf) {
        req.status = 'assigned';
        req.assignedTechnicianId = bestTech.id;
        req.assignedTechnicianName = bestTech.fullName;
        req.assignedTechnicianPhone = bestTech.phone;
        req.preferredDate = bestDate;
        req.preferredTimeSlot = bestSlot;
        req.assignedAt = new Date().toISOString();
        req.updatedAt = new Date().toISOString();

        this.addLog({
          requestId: req.id,
          fromStatus: 'approved',
          toStatus: 'assigned',
          changedByUserId: bestTech.id,
          changedByName: 'AI Auto-Dispatch Engine',
          changedByRole: 'manager',
          note: `AI Dispatch: Assigned approved ticket to ${bestTech.fullName} (${bestProf.specialty}) scheduled for ${bestDate} (${bestSlot}).`,
        });

        this.addNotification({
          recipientUserId: bestTech.id,
          title: `New Job Dispatched: ${req.ticketNumber}`,
          message: `Approved ${req.category} ticket "${req.title}" assigned to you for ${bestDate} (${bestSlot}).`,
          requestId: req.id,
          type: 'assignment',
        });

        this.addNotification({
          recipientUserId: req.customerId,
          title: `Technician Dispatched: ${req.ticketNumber}`,
          message: `${bestTech.fullName} has been assigned to your request for ${bestDate} (${bestSlot}).`,
          requestId: req.id,
          type: 'status_change',
        });

        results.push({
          assigned: true,
          requestId: req.id,
          ticketNumber: req.ticketNumber,
          techName: bestTech.fullName,
          scheduledDate: bestDate,
          scheduledTimeSlot: bestSlot,
        });
      }
    }

    if (results.length > 0) {
      this.save(STORAGE_KEYS.REQUESTS, requests);
    }

    return results;
  }

  /**
   * RESCHEDULE WORKFLOW (Technician & Customer)
   */
  public requestReschedule(
    requestId: string,
    params: { proposedDate: string; proposedTimeSlot: string; reason: string },
    actor: User
  ): { success: boolean; request?: ServiceRequest; error?: string } {
    if (!params.reason || !params.reason.trim()) {
      return { success: false, error: 'Please provide a reason for rescheduling.' };
    }
    if (!params.proposedDate) {
      return { success: false, error: 'Please select a proposed date.' };
    }

    const slotCheck = this.parseAndValidateSlot(params.proposedTimeSlot);
    if (!slotCheck.valid) {
      return {
        success: false,
        error:
          slotCheck.error ||
          'Proposed time must be within working hours (9:00 AM – 6:00 PM).',
      };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Service request not found.' };

    const req = requests[index];
    if (req.status === 'completed' || req.status === 'cancelled') {
      return {
        success: false,
        error: `Cannot reschedule a ${req.status} request.`,
      };
    }

    if (actor.role === 'customer' && req.customerId !== actor.id) {
      return { success: false, error: 'You can only reschedule your own service requests.' };
    }
    if (actor.role === 'technician' && req.assignedTechnicianId !== actor.id) {
      return { success: false, error: 'You can only reschedule jobs assigned to you.' };
    }

    // Check technician conflict if a technician is assigned
    if (req.assignedTechnicianId) {
      const conflictJob = requests.find((r) => {
        if (r.id === req.id) return false;
        if (r.assignedTechnicianId !== req.assignedTechnicianId) return false;
        if (!['assigned', 'accepted', 'in_progress'].includes(r.status)) return false;
        if (r.preferredDate !== params.proposedDate) return false;
        const win = this.parseAndValidateSlot(r.preferredTimeSlot);
        return win.startHour < slotCheck.endHour && slotCheck.startHour < win.endHour;
      });
      if (conflictJob) {
        return {
          success: false,
          error: `Schedule conflict: Assigned technician already has ticket ${conflictJob.ticketNumber} on ${params.proposedDate} (${conflictJob.preferredTimeSlot}).`,
        };
      }
    }

    const history = Array.isArray(req.rescheduleHistory) ? [...req.rescheduleHistory] : [];
    if (req.rescheduleRequest && req.rescheduleRequest.status === 'pending') {
      history.push({
        ...req.rescheduleRequest,
        status: 'declined',
        respondedAt: new Date().toISOString(),
        respondedById: actor.id,
        respondedByName: actor.fullName,
        respondedByRole: actor.role,
        responseNote: 'Superseded by counter-proposal',
      });
    }

    const proposal: RescheduleProposal = {
      id: 'rsch_' + Date.now(),
      requestedByRole: actor.role === 'technician' ? 'technician' : 'customer',
      requestedById: actor.id,
      requestedByName: actor.fullName,
      originalDate: req.preferredDate,
      originalTimeSlot: req.preferredTimeSlot,
      proposedDate: params.proposedDate,
      proposedTimeSlot: slotCheck.canonical,
      reason: params.reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    req.rescheduleRequest = proposal;
    req.rescheduleHistory = history;
    req.updatedAt = new Date().toISOString();
    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: req.status,
      toStatus: req.status,
      changedByUserId: actor.id,
      changedByName: actor.fullName,
      changedByRole: actor.role,
      note: `Reschedule requested by ${actor.fullName} (${actor.role}): Proposed ${params.proposedDate} (${slotCheck.canonical}). Reason: ${params.reason.trim()}`,
    });

    // Notify appropriate parties
    if (actor.role === 'technician') {
      this.addNotification({
        recipientUserId: req.customerId,
        title: `Reschedule Requested: ${req.ticketNumber}`,
        message: `Technician ${actor.fullName} proposed a new appointment time: ${params.proposedDate} (${slotCheck.canonical}). Reason: ${params.reason.trim()}`,
        requestId: req.id,
        type: 'alert',
      });
    } else if (req.assignedTechnicianId) {
      this.addNotification({
        recipientUserId: req.assignedTechnicianId,
        title: `Customer Reschedule Request: ${req.ticketNumber}`,
        message: `${actor.fullName} requested to reschedule ${req.ticketNumber} to ${params.proposedDate} (${slotCheck.canonical}). Reason: ${params.reason.trim()}`,
        requestId: req.id,
        type: 'alert',
      });
    }

    const managers = this.getUsers().filter((u) => u.role === 'manager');
    managers.forEach((m) => {
      this.addNotification({
        recipientUserId: m.id,
        title: `Reschedule Pending: ${req.ticketNumber}`,
        message: `${actor.fullName} (${actor.role}) requested to reschedule ${req.ticketNumber} to ${params.proposedDate} (${slotCheck.canonical}).`,
        requestId: req.id,
        type: 'alert',
      });
    });

    return { success: true, request: req };
  }

  public respondToReschedule(
    requestId: string,
    decision: {
      action: 'accept' | 'decline';
      responseNote?: string;
    },
    actor: User
  ): { success: boolean; request?: ServiceRequest; error?: string } {
    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Service request not found.' };

    const req = requests[index];
    const proposal = req.rescheduleRequest;
    if (!proposal || proposal.status !== 'pending') {
      return { success: false, error: 'No pending reschedule request found.' };
    }

    const nowIso = new Date().toISOString();
    const history = Array.isArray(req.rescheduleHistory) ? [...req.rescheduleHistory] : [];

    if (decision.action === 'accept') {
      const slotCheck = this.parseAndValidateSlot(proposal.proposedTimeSlot);
      if (!slotCheck.valid) {
        return {
          success: false,
          error: slotCheck.error || 'Proposed slot is outside working hours (9:00 AM – 6:00 PM).',
        };
      }

      if (req.assignedTechnicianId) {
        const conflictJob = requests.find((r) => {
          if (r.id === req.id) return false;
          if (r.assignedTechnicianId !== req.assignedTechnicianId) return false;
          if (!['assigned', 'accepted', 'in_progress'].includes(r.status)) return false;
          if (r.preferredDate !== proposal.proposedDate) return false;
          const win = this.parseAndValidateSlot(r.preferredTimeSlot);
          return win.startHour < slotCheck.endHour && slotCheck.startHour < win.endHour;
        });
        if (conflictJob) {
          return {
            success: false,
            error: `Schedule conflict: Technician is already booked for ${conflictJob.ticketNumber} on ${proposal.proposedDate} (${conflictJob.preferredTimeSlot}).`,
          };
        }
      }

      const resolvedProposal: RescheduleProposal = {
        ...proposal,
        status: 'accepted',
        respondedAt: nowIso,
        respondedById: actor.id,
        respondedByName: actor.fullName,
        respondedByRole: actor.role,
        responseNote: decision.responseNote?.trim() || undefined,
      };

      req.preferredDate = proposal.proposedDate;
      req.preferredTimeSlot = slotCheck.canonical;
      req.rescheduleRequest = resolvedProposal;
      history.push(resolvedProposal);
      req.rescheduleHistory = history;
      req.updatedAt = nowIso;
      this.save(STORAGE_KEYS.REQUESTS, requests);

      this.addLog({
        requestId: req.id,
        fromStatus: req.status,
        toStatus: req.status,
        changedByUserId: actor.id,
        changedByName: actor.fullName,
        changedByRole: actor.role,
        note: `Reschedule accepted by ${actor.fullName} (${actor.role}). Appointment updated from ${proposal.originalDate} (${proposal.originalTimeSlot}) to ${proposal.proposedDate} (${slotCheck.canonical}).`,
      });

      this.addNotification({
        recipientUserId: proposal.requestedById,
        title: `Reschedule Accepted: ${req.ticketNumber}`,
        message: `${actor.fullName} accepted the new appointment time: ${proposal.proposedDate} (${slotCheck.canonical}).`,
        requestId: req.id,
        type: 'status_change',
      });

      return { success: true, request: req };
    } else {
      const resolvedProposal: RescheduleProposal = {
        ...proposal,
        status: 'declined',
        respondedAt: nowIso,
        respondedById: actor.id,
        respondedByName: actor.fullName,
        respondedByRole: actor.role,
        responseNote: decision.responseNote?.trim() || undefined,
      };

      req.rescheduleRequest = resolvedProposal;
      history.push(resolvedProposal);
      req.rescheduleHistory = history;
      req.updatedAt = nowIso;
      this.save(STORAGE_KEYS.REQUESTS, requests);

      this.addLog({
        requestId: req.id,
        fromStatus: req.status,
        toStatus: req.status,
        changedByUserId: actor.id,
        changedByName: actor.fullName,
        changedByRole: actor.role,
        note: `Reschedule declined by ${actor.fullName} (${actor.role}). Original appointment (${req.preferredDate} · ${req.preferredTimeSlot}) remains unchanged.`,
      });

      this.addNotification({
        recipientUserId: proposal.requestedById,
        title: `Reschedule Declined: ${req.ticketNumber}`,
        message: `${actor.fullName} declined the proposed time (${proposal.proposedDate} · ${proposal.proposedTimeSlot}). Original schedule remains in effect.`,
        requestId: req.id,
        type: 'alert',
      });

      return { success: true, request: req };
    }
  }

  /**
   * PAYMENT SUMMARY & RECORDING
   */
  public computePaymentSummary(req: ServiceRequest, hourlyRateOverride?: number): PaymentRecord {
    const categoryRates = this.getServiceCategoryRates();
    const techProf = req.assignedTechnicianId
      ? this.getTechnicianProfile(req.assignedTechnicianId)
      : undefined;
    const hourlyRate =
      hourlyRateOverride ||
      techProf?.hourlyRate ||
      categoryRates[req.category] ||
      DEFAULT_CATEGORY_RATES[req.category] ||
      2000;

    const laborHours = req.laborHours && req.laborHours > 0 ? req.laborHours : 1;
    const partsTotal = (req.partsUsed || []).reduce(
      (sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.unitPrice) || 0),
      0
    );
    const calculatedTotal = Math.round(laborHours * hourlyRate + partsTotal);

    const existing = req.payment;
    const totalAmount =
      existing && existing.totalAmount > 0 && req.status !== 'completed'
        ? existing.totalAmount
        : calculatedTotal;
    const amountPaid = existing ? Math.max(0, Math.round(Number(existing.amountPaid) || 0)) : 0;
    const remainingBalance = Math.max(0, totalAmount - amountPaid);

    let status: 'unpaid' | 'partially_paid' | 'paid' = 'unpaid';
    if (amountPaid > 0 && remainingBalance === 0 && totalAmount > 0) {
      status = 'paid';
    } else if (amountPaid > 0 && remainingBalance > 0) {
      status = 'partially_paid';
    }

    return {
      totalAmount,
      amountPaid,
      remainingBalance,
      status,
      method: existing?.method,
      transactionReference: existing?.transactionReference,
      verifiedOnline: existing?.verifiedOnline,
      updatedAt: existing?.updatedAt,
      updatedById: existing?.updatedById,
      updatedByName: existing?.updatedByName,
      updatedByRole: existing?.updatedByRole,
    };
  }

  public updatePaymentRecord(
    requestId: string,
    params: {
      totalAmount?: number;
      amountPaid: number;
      method: PaymentMethod;
      transactionReference?: string;
      verifiedOnline?: boolean;
    },
    actor: User
  ): { success: boolean; request?: ServiceRequest; error?: string } {
    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Service request not found.' };

    const req = requests[index];
    if (actor.role === 'customer') {
      return {
        success: false,
        error: 'Payments must be verified and recorded by the assigned technician or operations manager.',
      };
    }
    if (actor.role === 'technician' && req.assignedTechnicianId !== actor.id) {
      return {
        success: false,
        error: 'Technicians can only record payment details for their own assigned jobs.',
      };
    }

    const baseSummary = this.computePaymentSummary(req);
    const totalAmount =
      params.totalAmount !== undefined && Number(params.totalAmount) > 0
        ? Math.round(Number(params.totalAmount))
        : baseSummary.totalAmount;
    const amountPaid = Math.round(Number(params.amountPaid) || 0);

    if (amountPaid < 0 || amountPaid > totalAmount) {
      return {
        success: false,
        error: `Amount paid must be between PKR 0 and PKR ${totalAmount.toLocaleString()}.`,
      };
    }

    if (params.method === 'online' && amountPaid > 0) {
      if (!params.verifiedOnline || !params.transactionReference?.trim()) {
        return {
          success: false,
          error:
            'Online payments cannot be marked as paid without a verified transaction reference and confirmation.',
        };
      }
    }

    const remainingBalance = Math.max(0, totalAmount - amountPaid);
    let status: 'unpaid' | 'partially_paid' | 'paid' = 'unpaid';
    if (amountPaid > 0 && remainingBalance === 0 && totalAmount > 0) {
      status = 'paid';
    } else if (amountPaid > 0 && remainingBalance > 0) {
      status = 'partially_paid';
    }

    const nowIso = new Date().toISOString();
    const paymentRecord: PaymentRecord = {
      totalAmount,
      amountPaid,
      remainingBalance,
      status,
      method: amountPaid > 0 ? params.method : undefined,
      transactionReference: params.transactionReference?.trim() || undefined,
      verifiedOnline: params.method === 'online' ? Boolean(params.verifiedOnline) : undefined,
      updatedAt: nowIso,
      updatedById: actor.id,
      updatedByName: actor.fullName,
      updatedByRole: actor.role,
    };

    req.payment = paymentRecord;
    req.updatedAt = nowIso;
    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: req.status,
      toStatus: req.status,
      changedByUserId: actor.id,
      changedByName: actor.fullName,
      changedByRole: actor.role,
      note: `Payment updated: Paid PKR ${amountPaid.toLocaleString()} of PKR ${totalAmount.toLocaleString()} (${status.replace('_', ' ').toUpperCase()}) via ${params.method.toUpperCase()}${params.transactionReference ? ` [Ref: ${params.transactionReference.trim()}]` : ''}.`,
    });

    this.addNotification({
      recipientUserId: req.customerId,
      title: `Payment Recorded: ${req.ticketNumber}`,
      message: `Payment status updated to ${status.replace('_', ' ').toUpperCase()} (Paid: PKR ${amountPaid.toLocaleString()}, Balance: PKR ${remainingBalance.toLocaleString()}).`,
      requestId: req.id,
      type: 'status_change',
    });

    return { success: true, request: req };
  }

  /**
   * Pending → Cancelled
   * Customer can cancel their request while Pending. Manager can also cancel.
   */
  public cancelServiceRequest(
    requestId: string,
    reason: string,
    cancelledBy: User
  ): { success: boolean; error?: string } {
    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    const prevStatus = req.status;

    // Customers can only cancel if status is pending
    if (cancelledBy.role === 'customer' && req.status !== 'pending') {
      return { success: false, error: 'You can only cancel requests that are currently in Pending status.' };
    }

    if (req.status === 'completed' || req.status === 'cancelled') {
      return { success: false, error: `Request cannot be cancelled from ${req.status} status.` };
    }

    req.status = 'cancelled';
    req.cancelledAt = new Date().toISOString();
    req.cancellationReason = reason.trim();
    req.updatedAt = new Date().toISOString();

    // If technician was assigned, update their status back to available
    if (req.assignedTechnicianId) {
      this.updateTechnicianStatus(req.assignedTechnicianId, 'available');
      this.addNotification({
        recipientUserId: req.assignedTechnicianId,
        title: `Job Cancelled: ${req.ticketNumber}`,
        message: `Dispatch ${req.ticketNumber} was cancelled. Reason: ${reason}`,
        requestId: req.id,
        type: 'status_change',
      });
    }

    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: prevStatus,
      toStatus: 'cancelled',
      changedByUserId: cancelledBy.id,
      changedByName: cancelledBy.fullName,
      changedByRole: cancelledBy.role,
      note: `Service request cancelled. Reason: ${reason}`,
    });

    // Notify Customer if cancelled by Manager
    if (cancelledBy.role === 'manager') {
      this.addNotification({
        recipientUserId: req.customerId,
        title: `Request Cancelled: ${req.ticketNumber}`,
        message: `Your request was cancelled by dispatch management. Reason: ${reason}`,
        requestId: req.id,
        type: 'status_change',
      });
    }

    return { success: true };
  }

  /**
   * Pending → Approved
   * Done by Manager
   */
  public approveServiceRequest(
    requestId: string,
    manager: User
  ): { success: boolean; error?: string; request?: ServiceRequest } {
    if (manager.role !== 'manager') {
      return { success: false, error: 'Only Managers can approve service requests.' };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'pending') {
      return { success: false, error: `Request must be in Pending status to approve (currently ${req.status}).` };
    }

    req.status = 'approved';
    req.updatedAt = new Date().toISOString();
    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: 'pending',
      toStatus: 'approved',
      changedByUserId: manager.id,
      changedByName: manager.fullName,
      changedByRole: 'manager',
      note: 'Service request reviewed and approved for technician assignment.',
    });

    // Notify Customer
    this.addNotification({
      recipientUserId: req.customerId,
      title: `Request Approved: ${req.ticketNumber}`,
      message: `Your service request has been approved and is ready for technician dispatch.`,
      requestId: req.id,
      type: 'status_change',
    });

    return { success: true, request: req };
  }

  /**
   * Approved → Assigned
   * Done by Manager (or reassigning)
   */
  public assignTechnician(
    requestId: string,
    technicianId: string,
    manager: User,
    schedule?: { preferredDate?: string; preferredTimeSlot?: string }
  ): { success: boolean; error?: string; request?: ServiceRequest } {
    if (manager.role !== 'manager') {
      return { success: false, error: 'Only Managers can assign technicians.' };
    }

    const techUser = this.getUserById(technicianId);
    if (!techUser || techUser.role !== 'technician') {
      return { success: false, error: 'Invalid technician selected. Selected user is not a technician.' };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'approved' && req.status !== 'assigned') {
      return { success: false, error: `Request must be Approved before assigning a technician (currently ${req.status}).` };
    }

    const targetDate = schedule?.preferredDate || req.preferredDate;
    const rawSlot = schedule?.preferredTimeSlot || req.preferredTimeSlot;

    // Validate working hours (9:00 AM – 6:00 PM)
    const slotCheck = this.parseAndValidateSlot(rawSlot);
    if (!slotCheck.valid) {
      return {
        success: false,
        error: slotCheck.error || 'Technicians can only be scheduled during working hours (9:00 AM – 6:00 PM).',
      };
    }
    const targetSlot = slotCheck.canonical;

    // Check for overlapping jobs for the same technician
    const conflictingJob = requests.find((r) => {
      if (r.id === req.id) return false;
      if (r.assignedTechnicianId !== techUser.id) return false;
      if (!['assigned', 'accepted', 'in_progress'].includes(r.status)) return false;
      if (r.preferredDate !== targetDate) return false;
      const existingWin = this.parseAndValidateSlot(r.preferredTimeSlot);
      return existingWin.startHour < slotCheck.endHour && slotCheck.startHour < existingWin.endHour;
    });

    if (conflictingJob) {
      return {
        success: false,
        error: `Schedule conflict: ${techUser.fullName} is already scheduled for ${conflictingJob.ticketNumber} on ${targetDate} during ${conflictingJob.preferredTimeSlot}.`,
      };
    }

    const prevStatus = req.status;
    req.status = 'assigned';
    req.assignedTechnicianId = techUser.id;
    req.assignedTechnicianName = techUser.fullName;
    req.assignedTechnicianPhone = techUser.phone;
    req.preferredDate = targetDate;
    req.preferredTimeSlot = targetSlot;
    req.assignedAt = new Date().toISOString();
    req.rejectionReason = undefined; // clear any previous decline
    req.updatedAt = new Date().toISOString();

    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: prevStatus,
      toStatus: 'assigned',
      changedByUserId: manager.id,
      changedByName: manager.fullName,
      changedByRole: 'manager',
      note: `Assigned to technician ${techUser.fullName} (${techUser.phone}) scheduled for ${targetDate} (${targetSlot}).`,
    });

    // Notify Technician
    this.addNotification({
      recipientUserId: techUser.id,
      title: `New Job Assigned: ${req.ticketNumber}`,
      message: `You have been assigned to ${req.category} ticket "${req.title}" scheduled for ${targetDate} (${targetSlot}). Please review and accept.`,
      requestId: req.id,
      type: 'assignment',
    });

    // Notify Customer
    this.addNotification({
      recipientUserId: req.customerId,
      title: `Technician Assigned: ${req.ticketNumber}`,
      message: `${techUser.fullName} has been assigned to your service request scheduled for ${targetDate} (${targetSlot}).`,
      requestId: req.id,
      type: 'status_change',
    });

    return { success: true, request: req };
  }

  /**
   * Assigned → Accepted
   * Done by Assigned Technician
   */
  public acceptServiceRequest(requestId: string, technician: User): { success: boolean; error?: string } {
    if (technician.role !== 'technician') {
      return { success: false, error: 'Only Technicians can accept jobs.' };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'assigned') {
      return { success: false, error: `Request must be in Assigned status to accept (currently ${req.status}).` };
    }
    if (req.assignedTechnicianId !== technician.id) {
      return { success: false, error: 'This request was not assigned to you.' };
    }

    req.status = 'accepted';
    req.acceptedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: 'assigned',
      toStatus: 'accepted',
      changedByUserId: technician.id,
      changedByName: technician.fullName,
      changedByRole: 'technician',
      note: `Job accepted by technician ${technician.fullName}.`,
    });

    // Notify Customer
    this.addNotification({
      recipientUserId: req.customerId,
      title: `Technician Accepted: ${req.ticketNumber}`,
      message: `${technician.fullName} has confirmed your appointment for ${req.preferredDate} (${req.preferredTimeSlot}).`,
      requestId: req.id,
      type: 'status_change',
    });

    // Notify Manager
    const managers = this.getUsers().filter((u) => u.role === 'manager');
    managers.forEach((m) => {
      this.addNotification({
        recipientUserId: m.id,
        title: `Job Accepted: ${req.ticketNumber}`,
        message: `${technician.fullName} accepted ticket ${req.ticketNumber}.`,
        requestId: req.id,
        type: 'status_change',
      });
    });

    return { success: true };
  }

  /**
   * Assigned → Approved (Rejection by Technician)
   * If a technician cannot accept, it reverts to Approved so Manager can reassign.
   */
  public declineServiceRequest(
    requestId: string,
    reason: string,
    technician: User
  ): { success: boolean; error?: string } {
    if (technician.role !== 'technician') {
      return { success: false, error: 'Only Technicians can decline jobs.' };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'assigned') {
      return { success: false, error: 'Only assigned requests can be declined.' };
    }

    req.status = 'approved';
    req.assignedTechnicianId = undefined;
    req.assignedTechnicianName = undefined;
    req.assignedTechnicianPhone = undefined;
    req.assignedAt = undefined;
    req.rejectionReason = reason;
    req.updatedAt = new Date().toISOString();

    this.save(STORAGE_KEYS.REQUESTS, requests);

    this.addLog({
      requestId: req.id,
      fromStatus: 'assigned',
      toStatus: 'approved',
      changedByUserId: technician.id,
      changedByName: technician.fullName,
      changedByRole: 'technician',
      note: `Technician declined assignment. Reason: ${reason}. Returned to Approved queue.`,
    });

    // Notify Manager
    const managers = this.getUsers().filter((u) => u.role === 'manager');
    managers.forEach((m) => {
      this.addNotification({
        recipientUserId: m.id,
        title: `Assignment Declined: ${req.ticketNumber}`,
        message: `${technician.fullName} declined ticket ${req.ticketNumber}. Reason: ${reason}. Please reassign.`,
        requestId: req.id,
        type: 'alert',
      });
    });

    return { success: true };
  }

  /**
   * Accepted → In Progress
   * Done by Assigned Technician upon arrival / commencing work.
   */
  public startWork(requestId: string, technician: User): { success: boolean; error?: string } {
    if (technician.role !== 'technician') {
      return { success: false, error: 'Only Technicians can start jobs.' };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'accepted') {
      return { success: false, error: `Request must be in Accepted status to start work (currently ${req.status}).` };
    }
    if (req.assignedTechnicianId !== technician.id) {
      return { success: false, error: 'This request was not assigned to you.' };
    }

    req.status = 'in_progress';
    req.startedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    this.save(STORAGE_KEYS.REQUESTS, requests);
    this.updateTechnicianStatus(technician.id, 'on_job');

    this.addLog({
      requestId: req.id,
      fromStatus: 'accepted',
      toStatus: 'in_progress',
      changedByUserId: technician.id,
      changedByName: technician.fullName,
      changedByRole: 'technician',
      note: 'Technician arrived on-site and commenced service diagnostics/work.',
    });

    // Notify Customer
    this.addNotification({
      recipientUserId: req.customerId,
      title: `Work Started: ${req.ticketNumber}`,
      message: `${technician.fullName} has arrived and is currently working on your issue.`,
      requestId: req.id,
      type: 'status_change',
    });

    return { success: true };
  }

  /**
   * In Progress → Completed
   * Done by Assigned Technician with resolution summary, parts used, and labor hours.
   */
  public completeWork(
    requestId: string,
    params: {
      resolutionSummary: string;
      workNotes?: string;
      laborHours: number;
      partsUsed?: PartItem[];
    },
    technician: User
  ): { success: boolean; error?: string } {
    if (technician.role !== 'technician') {
      return { success: false, error: 'Only Technicians can complete jobs.' };
    }

    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'in_progress') {
      return { success: false, error: `Request must be In Progress to complete (currently ${req.status}).` };
    }
    if (req.assignedTechnicianId !== technician.id) {
      return { success: false, error: 'This request was not assigned to you.' };
    }

    req.status = 'completed';
    req.completedAt = new Date().toISOString();
    req.resolutionSummary = params.resolutionSummary.trim();
    req.workNotes = params.workNotes ? params.workNotes.trim() : undefined;
    req.laborHours = params.laborHours;
    req.partsUsed = params.partsUsed || [];
    req.updatedAt = new Date().toISOString();

    this.save(STORAGE_KEYS.REQUESTS, requests);

    // Update technician metrics & status
    const techProfiles = this.getTechnicianProfiles();
    const techProfileIndex = techProfiles.findIndex((p) => p.userId === technician.id);
    if (techProfileIndex !== -1) {
      techProfiles[techProfileIndex].status = 'available';
      techProfiles[techProfileIndex].completedJobsCount += 1;
      this.save(STORAGE_KEYS.TECH_PROFILES, techProfiles);
    }

    this.addLog({
      requestId: req.id,
      fromStatus: 'in_progress',
      toStatus: 'completed',
      changedByUserId: technician.id,
      changedByName: technician.fullName,
      changedByRole: 'technician',
      note: `Job completed. Resolution: ${params.resolutionSummary}. Labor: ${params.laborHours}h.`,
    });

    // Notify Customer
    this.addNotification({
      recipientUserId: req.customerId,
      title: `Service Completed: ${req.ticketNumber}`,
      message: `Your service request has been marked as Completed by ${technician.fullName}. Please leave your review and rating!`,
      requestId: req.id,
      type: 'status_change',
    });

    // Notify Manager
    const managers = this.getUsers().filter((u) => u.role === 'manager');
    managers.forEach((m) => {
      this.addNotification({
        recipientUserId: m.id,
        title: `Job Completed: ${req.ticketNumber}`,
        message: `${technician.fullName} completed ticket ${req.ticketNumber} (${params.laborHours} hrs).`,
        requestId: req.id,
        type: 'status_change',
      });
    });

    return { success: true };
  }

  /**
   * Customer rates & reviews a completed job
   */
  public rateServiceRequest(
    requestId: string,
    rating: { score: number; comment?: string },
    customer: User
  ): { success: boolean; error?: string } {
    const requests = this.getRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return { success: false, error: 'Request not found.' };

    const req = requests[index];
    if (req.status !== 'completed') {
      return { success: false, error: 'Only completed requests can be reviewed.' };
    }
    if (req.customerId !== customer.id) {
      return { success: false, error: 'You can only review your own service requests.' };
    }

    const newRating: ServiceRating = {
      score: rating.score,
      comment: rating.comment ? rating.comment.trim() : undefined,
      createdAt: new Date().toISOString(),
    };
    req.rating = newRating;
    req.updatedAt = new Date().toISOString();
    this.save(STORAGE_KEYS.REQUESTS, requests);

    // Update technician rating average if technician assigned
    if (req.assignedTechnicianId) {
      const techProfiles = this.getTechnicianProfiles();
      const techProfileIndex = techProfiles.findIndex((p) => p.userId === req.assignedTechnicianId);
      if (techProfileIndex !== -1) {
        // compute new rolling average
        const currentRating = techProfiles[techProfileIndex].rating;
        const count = techProfiles[techProfileIndex].completedJobsCount;
        const updatedRating = count > 1 ? (currentRating * (count - 1) + rating.score) / count : rating.score;
        techProfiles[techProfileIndex].rating = Number(updatedRating.toFixed(2));
        this.save(STORAGE_KEYS.TECH_PROFILES, techProfiles);

        this.addNotification({
          recipientUserId: req.assignedTechnicianId,
          title: `New Rating Received: ${rating.score} ★`,
          message: `${customer.fullName} gave you a ${rating.score}-star rating for ticket ${req.ticketNumber}.`,
          requestId: req.id,
          type: 'status_change',
        });
      }
    }

    return { success: true };
  }

  // ==========================================
  // AUDIT LOGS & NOTIFICATIONS
  // ==========================================

  public getLogs(requestId?: string): ServiceRequestLog[] {
    const all = this.load<ServiceRequestLog[]>(STORAGE_KEYS.LOGS, []);
    if (!requestId) return all;
    return all.filter((l) => l.requestId === requestId);
  }

  private addLog(log: Omit<ServiceRequestLog, 'id' | 'timestamp'>): void {
    const logs = this.load<ServiceRequestLog[]>(STORAGE_KEYS.LOGS, []);
    const newLog: ServiceRequestLog = {
      ...log,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    this.save(STORAGE_KEYS.LOGS, logs);
  }

  public getNotifications(userId?: string): NotificationItem[] {
    const all = this.load<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    if (!userId) return all;
    return all.filter((n) => n.recipientUserId === userId);
  }

  public markNotificationAsRead(id: string): void {
    const notes = this.load<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const index = notes.findIndex((n) => n.id === id);
    if (index !== -1) {
      notes[index].isRead = true;
      this.save(STORAGE_KEYS.NOTIFICATIONS, notes);
    }
  }

  public markAllNotificationsAsRead(userId: string): void {
    const notes = this.load<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    notes.forEach((n) => {
      if (n.recipientUserId === userId) n.isRead = true;
    });
    this.save(STORAGE_KEYS.NOTIFICATIONS, notes);
  }

  private addNotification(params: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>): void {
    const notes = this.load<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const newNote: NotificationItem = {
      ...params,
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    notes.unshift(newNote);
    this.save(STORAGE_KEYS.NOTIFICATIONS, notes);
  }

  /**
   * Reset data if needed (for fresh testing)
   */
  public resetAllData(): void {
    Object.values(STORAGE_KEYS).forEach((k) => this.removeStorageItem(k));
    this.notify();
  }
}

export const store = new FixNearStore();
