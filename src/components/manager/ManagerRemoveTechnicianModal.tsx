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
          ? ` (${res.unassignedCount} job(s) unassigned)`
          : '';

      showToast(`Technician ${technician.fullName} removed${activeNotice}.`, 'success');

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not remove technician.');
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
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Remove Technician</h2>
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
        <div className="p-4 sm:p-5 space-y-3">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Technician Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 truncate">
                {technician.fullName}
              </div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {technician.email}
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
              {profile?.specialty || 'Technician'}
            </span>
          </div>

          {activeJobs.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              <strong>{activeJobs.length} active job(s)</strong> will be unassigned and returned to the queue.
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Remove this technician from the active roster? Completed job history will be preserved.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmRemove}
            disabled={loading}
            className="px-4 py-2 text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <span>Remove</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
