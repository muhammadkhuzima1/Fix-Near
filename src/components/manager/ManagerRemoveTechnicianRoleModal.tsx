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
        `${technician.fullName} updated to Customer role.`,
        'success'
      );

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not update role.');
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
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-auto animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <UserMinus className="w-4 h-4" />
            </div>
            <h2
              id="remove-tech-role-title"
              className="text-base font-bold text-slate-900"
            >
              Change to Customer Role
            </h2>
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
        <div className="p-4 sm:p-5 space-y-3">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                {technician.fullName}
              </div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {technician.email}
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
              Technician → Customer
            </span>
          </div>

          {activeJobs.length > 0 ? (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900">
              <strong>{activeJobs.length} active job(s)</strong> will be unassigned and returned to the queue.
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Remove Technician access for this account? Completed job history ({completedJobs.length}) will be kept.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmRemoveRole}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>Confirm</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
