import React, { useState } from 'react';
import { User, ServiceRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import {
  X,
  UserMinus,
  AlertTriangle,
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

interface ManagerRemoveTechnicianRoleModalProps {
  technician: User | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  requests?: ServiceRequest[];
}

export const ManagerRemoveTechnicianRoleModal: React.FC<ManagerRemoveTechnicianRoleModalProps> = ({
  technician,
  isOpen,
  onClose,
  onRefresh,
  requests = [],
}) => {
  const { currentUser, isSupabaseActive } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !technician) return null;

  // Active vs completed jobs for this technician
  const activeJobs = requests.filter(
    (r) =>
      r.assignedTechnicianId === technician.id &&
      ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );
  const completedJobs = requests.filter(
    (r) => r.assignedTechnicianId === technician.id && r.status === 'completed'
  );

  const handleConfirmRemoveRole = async () => {
    if (!currentUser || currentUser.role !== 'manager') {
      setErrorMessage(
        'Unauthorized: Only an Operations Manager is authorized to change user roles.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await SupabaseService.updateUserRole(
        technician.id,
        'customer',
        currentUser
      );

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to update technician role.');
        setLoading(false);
        return;
      }

      showToast(
        `Technician role removed for ${technician.fullName}. Account updated to Customer.`,
        'success'
      );

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'An unexpected error occurred while removing the technician role.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-tech-role-title"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-auto animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-amber-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <UserMinus className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2
                id="remove-tech-role-title"
                className="text-base sm:text-lg font-bold text-slate-900 truncate"
              >
                Remove Technician Role
              </h2>
              <p className="text-xs text-amber-800 mt-0.5 font-medium truncate">
                Change role in database from Technician to Customer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Technician Profile Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {technician.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {technician.fullName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {technician.email}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <span>Current: Technician</span>
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  → New: Customer
                </div>
              </div>
            </div>

            {technician.phone && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200/70 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{technician.phone}</span>
              </div>
            )}
          </div>

          {/* Operational Impacts Breakdown */}
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-slate-800 uppercase tracking-wider font-mono text-[11px]">
              Platform Action Impact:
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2 text-amber-950">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Updates real Supabase record (<code className="font-mono bg-white/80 px-1 py-0.5 rounded border border-amber-200 text-amber-900">public.profiles.role = 'customer'</code>).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  User immediately loses access to the Technician Portal and field actions.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  User disappears from the Technician Roster, availability lists, and assignment dropdowns.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  AI Auto-Dispatch engine will no longer consider this user for job dispatches.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Preserves user account, authentication, customer login, and historical completed jobs ({completedJobs.length} completed).
                </span>
              </div>
            </div>
          </div>

          {/* Active Work Orders Notice */}
          {activeJobs.length > 0 && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{activeJobs.length} active job(s) will be safely unassigned</span>
              </div>
              <p className="text-[11px] leading-relaxed text-indigo-800">
                These active tickets will be returned to the Approved dispatch pool with audit trail entries so other active technicians can immediately accept them.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmRemoveRole}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating Role in Supabase...</span>
              </>
            ) : (
              <>
                <UserMinus className="w-4 h-4" />
                <span>Confirm: Remove Technician Role</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
