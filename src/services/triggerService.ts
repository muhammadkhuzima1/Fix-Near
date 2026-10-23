import { ServiceRequest, PartItem } from '../types';

export class TriggerService {
  public static async triggerServiceRequestCreated(
    _request: ServiceRequest,
    _customer: { id: string; fullName: string; email: string; phone: string },
    _meta?: Record<string, any>
  ): Promise<void> {
    // Notifications are persisted via Supabase notifications & service_request_logs
  }

  public static async triggerTechnicianAssigned(
    _request: ServiceRequest,
    _technician: { id: string; fullName: string; email: string; phone: string },
    _customer: { fullName: string; email: string; phone: string }
  ): Promise<void> {
    // Handled via Supabase notifications & service_request_logs
  }

  public static async triggerServiceRequestAccepted(
    _request: ServiceRequest,
    _technician: { id: string; fullName: string; email: string; phone: string }
  ): Promise<void> {
    // Handled via Supabase notifications & service_request_logs
  }

  public static async triggerServiceRequestCompleted(
    _request: ServiceRequest,
    _technician: { id: string; fullName: string; email: string; phone: string },
    _completion: {
      resolutionSummary: string;
      workNotes: string;
      partsUsed: PartItem[];
      laborHours: number;
    }
  ): Promise<void> {
    // Handled via Supabase notifications & service_request_logs
  }
}
