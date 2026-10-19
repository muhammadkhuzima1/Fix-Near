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
} from '../types';

const STORAGE_KEYS = {
  USERS: 'fixnear_users',
  TECH_PROFILES: 'fixnear_technician_profiles',
  REQUESTS: 'fixnear_service_requests',
  LOGS: 'fixnear_service_request_logs',
  NOTIFICATIONS: 'fixnear_notifications',
  CURRENT_USER_ID: 'fixnear_current_user_id',
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
    const profiles = this.getTechnicianProfiles();
    const index = profiles.findIndex((p) => p.userId === userId);
    if (index !== -1) {
      profiles[index].status = status;
      this.save(STORAGE_KEYS.TECH_PROFILES, profiles);
    }
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

    // Check for matching available technician (AI Auto-Dispatch)
    const techProfiles = this.getTechnicianProfiles();
    const technicians = this.getUsers().filter((u) => u.role === 'technician');
    const availableProfiles = techProfiles.filter((p) => p.status === 'available');

    let bestTech: User | null = null;
    let bestProfile: TechnicianProfile | null = null;
    let bestScore = -999;

    for (const prof of availableProfiles) {
      const tech = technicians.find((t) => t.id === prof.id || t.id === prof.userId);
      if (!tech) continue;

      const activeJobs = requests.filter(
        (r) => r.assignedTechnicianId === tech.id && ['assigned', 'accepted', 'in_progress'].includes(r.status)
      ).length;
      if (activeJobs >= 3) continue;

      let score = 0;
      const spec = (prof.specialty || '').toLowerCase();
      const cat = params.category.toLowerCase();

      if (spec === cat) score += 100;
      else if (spec.includes(cat) || cat.includes(spec)) score += 80;
      else if ((prof.additionalSkills || []).some((s) => s.toLowerCase().includes(cat))) score += 50;
      else if (spec === 'general') score += 20;

      if (score === 0) continue;

      score += (prof.rating || 5) * 4;
      score -= activeJobs * 25;

      if (score > bestScore) {
        bestScore = score;
        bestTech = tech;
        bestProfile = prof;
      }
    }

    if (bestTech && bestProfile) {
      newRequest.status = 'assigned';
      newRequest.assignedTechnicianId = bestTech.id;
      newRequest.assignedTechnicianName = bestTech.fullName;
      newRequest.assignedTechnicianPhone = bestTech.phone;
      newRequest.assignedAt = new Date().toISOString();
    }

    requests.unshift(newRequest);
    this.save(STORAGE_KEYS.REQUESTS, requests);

    // Audit Log
    if (bestTech && bestProfile) {
      this.addLog({
        requestId: newRequest.id,
        fromStatus: 'pending',
        toStatus: 'assigned',
        changedByUserId: bestTech.id,
        changedByName: 'AI Auto-Dispatch Engine',
        changedByRole: 'manager',
        note: `AI Auto-Dispatch: Automatically matched and assigned to technician ${bestTech.fullName} (${bestProfile.specialty}) based on matching skills and availability.`,
      });

      this.addNotification({
        recipientUserId: bestTech.id,
        title: `New Job Auto-Dispatched: ${newRequest.ticketNumber}`,
        message: `AI dispatched ${newRequest.category} ticket "${newRequest.title}" to you based on your skills.`,
        requestId: newRequest.id,
        type: 'assignment',
      });
    } else {
      this.addLog({
        requestId: newRequest.id,
        fromStatus: 'pending',
        toStatus: 'pending',
        changedByUserId: params.customerId,
        changedByName: newRequest.customerName,
        changedByRole: 'customer',
        note: 'AI Dispatch Queue: No matching technician currently available. Placed in Pending queue for auto-assignment when a technician becomes available.',
      });
    }

    return newRequest;
  }

  public autoAssignPendingRequests(): { assigned: boolean; ticketNumber: string; techName?: string }[] {
    const requests = this.getRequests();
    const pending = requests.filter((r) => r.status === 'pending');
    if (!pending.length) return [];

    const techProfiles = this.getTechnicianProfiles();
    const technicians = this.getUsers().filter((u) => u.role === 'technician');
    const availableProfiles = techProfiles.filter((p) => p.status === 'available');
    const results: { assigned: boolean; ticketNumber: string; techName?: string }[] = [];

    for (const req of pending) {
      let bestTech: User | null = null;
      let bestProf: TechnicianProfile | null = null;
      let bestScore = -999;

      for (const prof of availableProfiles) {
        const tech = technicians.find((t) => t.id === prof.id || t.id === prof.userId);
        if (!tech) continue;

        const activeJobs = requests.filter(
          (r) => r.assignedTechnicianId === tech.id && ['assigned', 'accepted', 'in_progress'].includes(r.status)
        ).length;
        if (activeJobs >= 3) continue;

        let score = 0;
        const spec = (prof.specialty || '').toLowerCase();
        const cat = req.category.toLowerCase();

        if (spec === cat) score += 100;
        else if (spec.includes(cat) || cat.includes(spec)) score += 80;
        else if ((prof.additionalSkills || []).some((s) => s.toLowerCase().includes(cat))) score += 50;
        else if (spec === 'general') score += 20;

        if (score === 0) continue;

        score += (prof.rating || 5) * 4;
        score -= activeJobs * 25;

        if (score > bestScore) {
          bestScore = score;
          bestTech = tech;
          bestProf = prof;
        }
      }

      if (bestTech && bestProf) {
        req.status = 'assigned';
        req.assignedTechnicianId = bestTech.id;
        req.assignedTechnicianName = bestTech.fullName;
        req.assignedTechnicianPhone = bestTech.phone;
        req.assignedAt = new Date().toISOString();
        req.updatedAt = new Date().toISOString();

        this.addLog({
          requestId: req.id,
          fromStatus: 'pending',
          toStatus: 'assigned',
          changedByUserId: bestTech.id,
          changedByName: 'AI Auto-Dispatch Engine',
          changedByRole: 'manager',
          note: `AI Auto-Dispatch: Automatically assigned pending ticket to ${bestTech.fullName} (${bestProf.specialty}) as technician became available.`,
        });

        this.addNotification({
          recipientUserId: bestTech.id,
          title: `New Job Auto-Dispatched: ${req.ticketNumber}`,
          message: `Pending ${req.category} ticket auto-assigned to you: "${req.title}".`,
          requestId: req.id,
          type: 'assignment',
        });

        this.addNotification({
          recipientUserId: req.customerId,
          title: `Technician Dispatched: ${req.ticketNumber}`,
          message: `A technician has become available! ${bestTech.fullName} has been auto-assigned to your request.`,
          requestId: req.id,
          type: 'status_change',
        });

        results.push({ assigned: true, ticketNumber: req.ticketNumber, techName: bestTech.fullName });
      }
    }

    if (results.length > 0) {
      this.save(STORAGE_KEYS.REQUESTS, requests);
    }

    return results;
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
  public approveServiceRequest(requestId: string, manager: User): { success: boolean; error?: string } {
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
      message: `Your service request has been approved and is being assigned to a qualified technician.`,
      requestId: req.id,
      type: 'status_change',
    });

    return { success: true };
  }

  /**
   * Approved → Assigned
   * Done by Manager (or reassigning)
   */
  public assignTechnician(
    requestId: string,
    technicianId: string,
    manager: User
  ): { success: boolean; error?: string } {
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
      return { success: false, error: `Request must be in Approved or Assigned status (currently ${req.status}).` };
    }

    const prevStatus = req.status;
    req.status = 'assigned';
    req.assignedTechnicianId = techUser.id;
    req.assignedTechnicianName = techUser.fullName;
    req.assignedTechnicianPhone = techUser.phone;
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
      note: `Assigned to technician ${techUser.fullName} (${techUser.phone}).`,
    });

    // Notify Technician
    this.addNotification({
      recipientUserId: techUser.id,
      title: `New Job Assigned: ${req.ticketNumber}`,
      message: `You have been assigned to ${req.category} ticket "${req.title}" scheduled for ${req.preferredDate}. Please review and accept.`,
      requestId: req.id,
      type: 'assignment',
    });

    // Notify Customer
    this.addNotification({
      recipientUserId: req.customerId,
      title: `Technician Assigned: ${req.ticketNumber}`,
      message: `${techUser.fullName} has been assigned to your service request.`,
      requestId: req.id,
      type: 'status_change',
    });

    return { success: true };
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
