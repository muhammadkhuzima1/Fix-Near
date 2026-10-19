import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import {
  X,
  ShieldCheck,
  Wrench,
  User as UserIcon,
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  Phone,
  Info,
} from 'lucide-react';

interface ManagerEditRoleModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ManagerEditRoleModal: React.FC<ManagerEditRoleModalProps> = ({
  user,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const { currentUser, isSupabaseActive } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setErrorMessage(null);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const isSelf = currentUser?.id === user.id;
  const isUnchanged = selectedRole === user.role;

  const handleSaveRole = async () => {
    if (isUnchanged) {
      onClose();
      return;
    }

    if (!currentUser || currentUser.role !== 'manager') {
      setErrorMessage(
        'Security check failed: Only an authorized Operations Manager can change user roles.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await SupabaseService.updateUserRole(
        user.id,
        selectedRole,
        currentUser
      );

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to update user role.');
        setLoading(false);
        return;
      }

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'An unexpected error occurred while updating the role.'
      );
    } finally {
      setLoading(false);
    }
  };

  const roleOptions: {
    role: UserRole;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    borderActive: string;
    bgActive: string;
  }[] = [
    {
      role: 'customer',
      title: 'Customer',
      description:
        'Standard client account. Can submit service requests, track dispatches, and review completed work.',
      icon: UserIcon,
      accentColor: 'text-sky-600',
      borderActive: 'border-sky-500 ring-2 ring-sky-500/20',
      bgActive: 'bg-sky-50/50',
    },
    {
      role: 'technician',
      title: 'Field Technician',
      description:
        'Field service specialist. Receives jobs, updates job statuses (Accept → Start → Complete), and appears in dispatch availability.',
      icon: Wrench,
      accentColor: 'text-amber-600',
      borderActive: 'border-amber-500 ring-2 ring-amber-500/20',
      bgActive: 'bg-amber-50/50',
    },
    {
      role: 'manager',
      title: 'Operations Manager',
      description:
        'Full operational authority. Can review requests, manage field technicians, view audit trail, and modify user roles.',
      icon: ShieldCheck,
      accentColor: 'text-indigo-600',
      borderActive: 'border-indigo-500 ring-2 ring-indigo-500/20',
      bgActive: 'bg-indigo-50/50',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-150 my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-role-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-900 text-white">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-mono uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Manager Role Control</span>
            </div>

            <h2
              id="edit-role-modal-title"
              className="text-base sm:text-lg font-bold truncate"
            >
              Edit User Role
            </h2>

            <p className="text-xs text-slate-300 truncate mt-0.5">
              Modify system authorization for{' '}
              <span className="text-white font-semibold">
                {user.fullName}
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Context Card */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm shrink-0 uppercase">
              {user.fullName?.charAt(0) || 'U'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 truncate">
                  {user.fullName}
                </span>

                {isSelf && (
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                    You
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap font-mono">
                <span className="flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>

                {user.phone && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{user.phone}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                Current
              </div>

              <span
                className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize mt-0.5 ${
                  user.role === 'manager'
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : user.role === 'technician'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-sky-100 text-sky-700 border border-sky-200'
                }`}
              >
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wider font-mono">
              Select New Authorization Role
            </label>

            <div className="space-y-2.5">
              {roleOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedRole === opt.role;
                const isCurrent = user.role === opt.role;

                return (
                  <div
                    key={opt.role}
                    onClick={() => !loading && setSelectedRole(opt.role)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 text-left relative ${
                      isSelected
                        ? `${opt.borderActive} ${opt.bgActive} shadow-xs`
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                    } ${
                      loading ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-white shadow-xs'
                          : 'bg-slate-100'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${opt.accentColor}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {opt.title}
                        </span>

                        {isCurrent && (
                          <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            Current Role
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Special Contextual Alerts */}
          {isSelf && selectedRole !== 'manager' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />

              <div className="leading-relaxed">
                <span className="font-semibold">Security Warning:</span>{' '}
                You are altering your own account role. If you save this
                change, you will lose Manager access upon page refresh.
              </div>
            </div>
          )}

          {selectedRole === 'technician' &&
            user.role !== 'technician' && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-2.5 text-xs text-indigo-800">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />

                <div className="leading-relaxed">
                  Assigning the{' '}
                  <span className="font-semibold">Technician</span>{' '}
                  role will automatically initialize a field technician
                  profile in Supabase and make this user eligible for
                  automatic job dispatching.
                </div>
              </div>
            )}

          {user.role === 'technician' && selectedRole === 'customer' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />

              <div className="leading-relaxed">
                <span className="font-semibold">Removing Technician Role:</span>{' '}
                This user will immediately lose access to the Field Technician
                dashboard, disappear from the technician roster and assignment
                options, and any active jobs will be returned to the dispatch queue.
                Historical completed jobs remain safely preserved.
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />

              <div className="leading-relaxed font-medium">
                {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveRole}
            disabled={loading || isUnchanged}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating Role in Supabase...</span>
              </>
            ) : isUnchanged ? (
              <span>Role Unchanged</span>
            ) : user.role === 'technician' && selectedRole === 'customer' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Confirm: Remove Technician Role</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Role Change</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};