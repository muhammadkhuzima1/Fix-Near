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
      description: 'Submit and track service requests.',
      icon: UserIcon,
      accentColor: 'text-sky-600',
      borderActive: 'border-sky-500 ring-1 ring-sky-500/20',
      bgActive: 'bg-sky-50/50',
    },
    {
      role: 'technician',
      title: 'Technician',
      description: 'Accept, perform, and complete assigned jobs.',
      icon: Wrench,
      accentColor: 'text-amber-600',
      borderActive: 'border-amber-500 ring-1 ring-amber-500/20',
      bgActive: 'bg-amber-50/50',
    },
    {
      role: 'manager',
      title: 'Manager',
      description: 'Manage requests, technicians, and roles.',
      icon: ShieldCheck,
      accentColor: 'text-indigo-600',
      borderActive: 'border-indigo-500 ring-1 ring-indigo-500/20',
      bgActive: 'bg-indigo-50/50',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in duration-150 my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-role-modal-title"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="min-w-0 pr-3">
            <h2
              id="edit-role-modal-title"
              className="text-base font-bold truncate"
            >
              Edit Role — {user.fullName}
            </h2>
            <p className="text-xs text-slate-300 truncate">{user.email}</p>
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="space-y-2">
            {roleOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedRole === opt.role;
              const isCurrent = user.role === opt.role;

              return (
                <div
                  key={opt.role}
                  onClick={() => !loading && setSelectedRole(opt.role)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 text-left ${
                    isSelected
                      ? `${opt.borderActive} ${opt.bgActive}`
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white shadow-xs' : 'bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${opt.accentColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {opt.title}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{opt.description}</p>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {isSelf && selectedRole !== 'manager' && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Changing your own role will remove Manager access.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            onClick={handleSaveRole}
            disabled={loading || isUnchanged}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Role</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};