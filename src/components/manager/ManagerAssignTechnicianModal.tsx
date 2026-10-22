import React, { useState, useEffect } from 'react';
import { ServiceRequest, User, TechnicianProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import { store } from '../../services/store';
import {
  X,
  Wrench,
  Star,
  Check,
  AlertCircle,
  Phone,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  formatHourlyPrice,
  WORKING_TIME_SLOTS,
  WORKING_HOURS_DISPLAY,
} from '../../utils/currency';

interface ManagerAssignTechnicianModalProps {
  isOpen: boolean;
  request: ServiceRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManagerAssignTechnicianModal: React.FC<ManagerAssignTechnicianModalProps> = ({
  isOpen,
  request,
  onClose,
  onSuccess,
}) => {
  const { currentUser, isSupabaseActive } = useAuth();
  const { showToast } = useToast();

  const [selectedTechId, setSelectedTechId] = useState<string>(
    request.assignedTechnicianId || ''
  );
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return request.preferredDate && request.preferredDate >= today
      ? request.preferredDate
      : today;
  });
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<string>(() => {
    const valid = WORKING_TIME_SLOTS.includes(request.preferredTimeSlot as any);
    return valid ? request.preferredTimeSlot : WORKING_TIME_SLOTS[0];
  });
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [techProfiles, setTechProfiles] = useState<TechnicianProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadTechs = async () => {
      try {
        const [data, profiles] = await Promise.all([
          SupabaseService.fetchTechnicians(),
          SupabaseService.fetchTechnicianProfiles(),
        ]);
        if (isMounted) {
          const strictlyTechUsers = (data || []).filter(
            (u) => u.role === 'technician' && !u.fullName?.startsWith('[Removed]')
          );
          const validIds = new Set(strictlyTechUsers.map((t) => t.id));
          const strictlyTechProfiles = (profiles || []).filter(
            (p) => validIds.has(p.id) || validIds.has(p.userId)
          );
          setTechnicians(strictlyTechUsers);
          setTechProfiles(strictlyTechProfiles);
        }
      } catch (err) {
        console.error('Error loading technicians:', err);
      }
    };
    loadTechs();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isOpen) return null;

  const handleAssign = async () => {
    if (!currentUser) return;
    if (!selectedTechId) {
      setError('Please select a technician to assign.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await SupabaseService.assignTechnician(
      request.id,
      selectedTechId,
      currentUser,
      {
        preferredDate: scheduledDate,
        preferredTimeSlot: scheduledTimeSlot,
      }
    );
    if (res.success) {
      showToast(
        `Assigned technician to ticket ${request.ticketNumber} (${scheduledDate}, ${scheduledTimeSlot}).`,
        'success'
      );
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Failed to assign technician.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="min-h-screen px-2 sm:px-4 text-center flex items-center justify-center py-4">
        <div className="relative bg-white text-left rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 z-10 box-border">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-2">
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-slate-900 truncate">
                Assign Field Technician
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Ticket <span className="font-mono text-slate-800">{request.ticketNumber}</span>: {request.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 sm:mt-5 space-y-4">
            {/* Working Hours Schedule Selection */}
            <div className="p-3.5 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-[#143628] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Appointment Schedule</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#143628] bg-white px-2.5 py-0.5 rounded border border-[#D8CFBE]">
                  <Clock className="w-3 h-3" />
                  <span>{WORKING_HOURS_DISPLAY}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#143628]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Working Hours Window
                  </label>
                  <select
                    value={scheduledTimeSlot}
                    onChange={(e) => setScheduledTimeSlot(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#143628]"
                  >
                    {WORKING_TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Select Qualified Technician ({technicians.length} available)
            </div>

            {technicians.length === 0 ? (
              <div className="p-5 sm:p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-800">
                  No technicians provisioned yet
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Create technician accounts first from the Technicians tab before assigning dispatches.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                {technicians.map((tech) => {
                  const profile =
                    techProfiles.find((p) => p.id === tech.id) ||
                    store.getTechnicianProfile(tech.id);
                  const isSelected = selectedTechId === tech.id;

                  return (
                    <div
                      key={tech.id}
                      onClick={() => setSelectedTechId(tech.id)}
                      className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tech.fullName.charAt(0)}
                        </div>
                        <div className="truncate min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                            <span className="truncate">{tech.fullName}</span>
                            {profile?.status === 'available' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Available" />
                            )}
                            {profile?.status === 'on_job' && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="On Job" />
                            )}
                            {profile?.status === 'off_duty' && (
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title="Off Duty" />
                            )}
                          </div>
                          <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate font-mono">
                            <span>{profile?.specialty || 'Field Tech'}</span>
                            <span>·</span>
                            <span>{tech.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3">
                        <div className="text-xs text-right hidden min-[400px]:block">
                          <div className="font-medium text-slate-800 flex items-center gap-1 justify-end">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{profile?.rating?.toFixed(1) ?? '5.0'}</span>
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                            {formatHourlyPrice(profile?.hourlyRate, 2000)}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || technicians.length === 0}
                onClick={handleAssign}
                className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
