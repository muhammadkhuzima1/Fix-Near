export type UserRole = 'customer' | 'technician' | 'manager';

export type ServiceStatus =
  | 'pending'
  | 'approved'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'emergency';

export type ServiceCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'appliance'
  | 'carpentry'
  | 'general';

export interface ServiceAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  contactPhone?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string;
  createdAt: string;
  password?: string;
}

export interface TechnicianProfile {
  id: string; // matches User.id
  userId: string;
  specialty: string;
  additionalSkills: string[];
  status: 'available' | 'on_job' | 'off_duty';
  rating: number;
  completedJobsCount: number;
  experienceYears?: number;
  licenseNumber?: string;
  hourlyRate?: number;
}

export interface PartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ServiceRating {
  score: number; // 1 to 5
  comment?: string;
  createdAt: string;
}

export interface ServiceRequest {
  id: string;
  ticketNumber: string; // e.g., FXN-2026-0001
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  title: string;
  category: ServiceCategory;
  description: string;
  priority: PriorityLevel;
  status: ServiceStatus;
  serviceAddress: ServiceAddress;
  preferredDate: string;
  preferredTimeSlot: string;
  attachments?: string[]; // base64 or photo URLs
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  assignedTechnicianPhone?: string;
  assignedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  rejectionReason?: string;
  workNotes?: string;
  partsUsed?: PartItem[];
  laborHours?: number;
  resolutionSummary?: string;
  rating?: ServiceRating;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestLog {
  id: string;
  requestId: string;
  fromStatus: ServiceStatus;
  toStatus: ServiceStatus;
  changedByUserId: string;
  changedByName: string;
  changedByRole: UserRole;
  note: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  requestId?: string;
  isRead: boolean;
  createdAt: string;
  type: 'status_change' | 'assignment' | 'alert' | 'system';
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export interface AIProblemAnalysis {
  category: ServiceCategory;
  requiredSkill: string;
  priority: PriorityLevel;
  title: string;
  technicianSummary: string;
  reasoning: string;
  confidenceScore?: number;
  source?: string;
}

export interface AIManagerInsights {
  generatedAt: string;
  summary: string;
  demandAnalysis: {
    topCategory: string;
    categoryBreakdown: { category: string; count: number; percentage: number }[];
    demandTrend: string;
  };
  workloadAnalysis: {
    totalTechnicians: number;
    availableCount: number;
    busyCount: number;
    utilizationRate: number;
    overloadedTechnicians: string[];
    capacityStatus: 'optimal' | 'moderate' | 'critical';
  };
  pendingQueueAnalysis: {
    pendingCount: number;
    criticalPendingCount: number;
    bottleneckSpecialty: string;
    autoDispatchFeasible: boolean;
  };
  recommendations: {
    type: 'staffing' | 'dispatch' | 'operations' | 'quality';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export interface AutoDispatchResult {
  assigned: boolean;
  requestId: string;
  ticketNumber: string;
  technicianId?: string;
  technicianName?: string;
  technicianPhone?: string;
  matchedCategory: ServiceCategory;
  matchedSkill: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  reason: string;
  error?: string;
  request?: ServiceRequest;
}

export interface AIDispatchCandidate {
  technician: User;
  profile: TechnicianProfile;
  matchScore: number;
  matchReason: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  scheduleAdjusted: boolean;
  activeWorkload: number;
}


