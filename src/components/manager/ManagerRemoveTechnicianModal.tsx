import React, { useState } from 'react';
import { User, TechnicianProfile, ServiceRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import {
  X,
  AlertTriangle,
  UserX,
  Wrench,
  Mail,
  Phone,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { formatHourlyPrice } from '../../utils/currency';

interface ManagerRemoveTechnicianModalProps {
  technician: User | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  requests?: ServiceRequest[];
  technicianProfiles?: TechnicianProfile[];
}

export const ManagerRemoveTechnicianModal: React.FC<ManagerRemoveTechnicianModalProps> = ({
  technician,
  isOpen,
  onClose,
  onRefresh,
  requests = [],
  technicianProfiles = [],
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !technician) return null;

  const profile = technicianProfiles.find((p) => p.id === technician.id || p.userId === technician.id);

  // Compute active vs completed jobs
  const activeJobs = requests.filter(
    (r) =>
      r.assignedTechnicianId === technician.id &&
      ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );
  const completedJobs = requests.filter(
    (r) => r.assignedTechnicianId === technician.id && r.status === 'completed'
  );

  const handleConfirmRemove = async () => {
    if (!currentUser || currentUser.role !== 'manager') {
      setErrorMessage('Unauthorized: Only Operations Managers can remove technicians.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await SupabaseService.removeTechnician(technician.id, currentUser);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to remove technician from database.');
        setLoading(false);
        return;
      }

      const activeNotice =
        res.unassignedCount && res.unassignedCount > 0
          ? ` (${res.unassignedCount} active work order${res.unassignedCount > 1 ? 's' : ''} returned to dispatch pool)`
          : '';

      showToast(
        `Technician ${technician.fullName} removed from platform${activeNotice}.`,
        'success'
      );

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while removing technician.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Remove Technician
              </h2>
              <p className="text-xs text-rose-700 mt-0.5 font-medium">
                Confirm removal from active platform operations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Technician Profile Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {technician.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {technician.fullName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {technician.email}
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                {profile?.specialty || 'Field Tech'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-mono flex-wrap gap-2">
              <span>Status: <strong className="capitalize">{profile?.status || 'available'}</strong></span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Rate: {formatHourlyPrice(profile?.hourlyRate, 2000)}
              </span>
              <span>Lifetime completed: {completedJobs.length}</span>
            </div>
          </div>

          {/* Active Work Orders Alert */}
          {activeJobs.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {activeJobs.length} Active Work Order{activeJobs.length > 1 ? 's' : ''} Currently Assigned
                </span>
              </div>
              <p className="leading-relaxed">
                This technician currently has {activeJobs.length} open job{activeJobs.length > 1 ? 's' : ''} in assigned, accepted, or in-progress status.
                Removing them will <strong>automatically unassign these jobs and return them to the dispatch pool ('Approved')</strong> so other qualified technicians can immediately be assigned.
              </p>
              <div className="space-y-1 font-mono text-[11px] bg-white/70 p-2 rounded-lg border border-amber-200/60 max-h-24 overflow-y-auto">
                {activeJobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{j.ticketNumber}</span>
                    <span className="capitalize text-slate-500">{j.category} · {j.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No active jobs currently in-flight. Safe to remove immediately.</span>
            </div>
          )}

          {/* Safety & Permanent Protections */}
          <div className="space-y-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span>What happens upon removal:</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-slate-600 pl-1 leading-relaxed">
              <li>
                The technician will be <strong>removed from the active Technician Roster</strong> and dispatch options.
              </li>
              <li>
                Their account credentials will be <strong>revoked</strong> and barred from accessing technician portals.
              </li>
              <li>
                <strong>Historical completed records and customer data are preserved</strong> for compliance and audit trail integrity.
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmRemove}
            disabled={loading}
            className="px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Removing Technician...</span>
              </>
            ) : (
              <>
                <UserX className="w-4 h-4" />
                <span>Remove Technician</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
