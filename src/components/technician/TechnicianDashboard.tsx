import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ServiceRequest, TechnicianProfile } from '../../types';
import { SupabaseService } from '../../services/supabaseService';
import { formatHourlyPrice, WORKING_HOURS_DISPLAY } from '../../utils/currency';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  Wrench,
  Clock,
  CheckCircle2,
  Calendar,
  MapPin,
  ArrowRight,
  Star,
  Play,
  Loader2,
} from 'lucide-react';

interface TechnicianDashboardProps {
  requests: ServiceRequest[];
  onSelectRequest: (request: ServiceRequest) => void;
  onNavigateTab: (tab: string) => void;
  onRefresh?: () => void;
}

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({
  requests,
  onSelectRequest,
  onNavigateTab,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [technicianProfile, setTechnicianProfile] = useState<TechnicianProfile | null>(null);

  const [localRequests, setLocalRequests] = useState<ServiceRequest[]>(requests);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    setLocalRequests(requests);
  }, [requests]);

  const currentRequests = localRequests;

  const loadProfile = async () => {
    if (currentUser) {
      try {
        const prof = await SupabaseService.getTechnicianProfile(currentUser.id);
        if (prof) setTechnicianProfile(prof);
      } catch (e) {
        console.error('Error fetching technician profile:', e);
      }
    }
  };

  useEffect(() => {
    loadProfile();
  }, [currentUser]);

  const handleStatusChange = async (status: 'available' | 'on_job' | 'off_duty') => {
    if (!currentUser) return;
    try {
      await SupabaseService.updateTechnicianStatus(currentUser.id, status);
      setTechnicianProfile((prev) => (prev ? { ...prev, status } : null));
      showToast(`Duty status updated to ${status.replace('_', ' ').toUpperCase()}`, 'info');
    } catch (e: any) {
      showToast(e.message || 'Error updating status', 'error');
    }
  };

  const assignedCount = currentRequests.filter((r) => r.status === 'assigned').length;
  const activeCount = currentRequests.filter((r) =>
    ['accepted', 'in_progress'].includes(r.status)
  ).length;
  const completedCount = currentRequests.filter((r) => r.status === 'completed').length;

  const handleAcceptJob = async (e: React.MouseEvent, req: ServiceRequest) => {
    e.stopPropagation();
    if (!currentUser || actionLoadingId) return;

    setActionError(null);
    setActionLoadingId(req.id);

    const prevRequests = [...localRequests];
    setLocalRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'accepted' } : r))
    );

    try {
      const res = await SupabaseService.acceptServiceRequest(
        req.id,
        currentUser
      );

      if (res.success) {
        showToast(`Job ${req.ticketNumber} accepted! Status updated to Accepted.`, 'success');
        if (onRefresh) onRefresh();
        loadProfile();
      } else {
        setLocalRequests(prevRequests);
        const errText = res.error || 'Failed to accept job in Supabase.';
        setActionError({ id: req.id, message: errText });
        showToast(errText, 'error');
      }
    } catch (err: any) {
      setLocalRequests(prevRequests);
      const errText = err?.message || 'Error communicating with Supabase.';
      setActionError({ id: req.id, message: errText });
      showToast(errText, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartJob = async (e: React.MouseEvent, req: ServiceRequest) => {
    e.stopPropagation();
    if (!currentUser || actionLoadingId) return;

    setActionError(null);
    setActionLoadingId(req.id);

    const prevRequests = [...localRequests];
    setLocalRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'in_progress' } : r))
    );

    try {
      const res = await SupabaseService.startWork(req.id, currentUser);

      if (res.success) {
        showToast(`Work started on ${req.ticketNumber}. Status: In Progress.`, 'success');
        if (onRefresh) onRefresh();
        loadProfile();
      } else {
        setLocalRequests(prevRequests);
        const errText = res.error || 'Failed to start job in Supabase.';
        setActionError({ id: req.id, message: errText });
        showToast(errText, 'error');
      }
    } catch (err: any) {
      setLocalRequests(prevRequests);
      const errText = err?.message || 'Error starting job in Supabase.';
      setActionError({ id: req.id, message: errText });
      showToast(errText, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const actionNeededJobs = currentRequests.filter((r) =>
    ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );

  return (
    <div className="space-y-6 w-full max-w-full font-sans">
      {/* Top Hero with Availability Toggle */}
      <div className="bg-[#143628] text-[#FDFBF7] rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm border border-[#1B4332]">
        <div className="space-y-2 max-w-xl min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[#A3C9B6] uppercase tracking-wider">
              Field Technician Console
            </span>
            {technicianProfile?.specialty && (
              <span className="text-xs text-[#C8DCD1] truncate">· {technicianProfile.specialty}</span>
            )}
            <span className="text-xs text-[#A3C9B6] font-mono font-medium truncate">
              · Rate: {formatHourlyPrice(technicianProfile?.hourlyRate, 2000)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#FAF8F5] bg-[#1B4332] px-2.5 py-0.5 rounded border border-[#2D6A4F]">
              <Clock className="w-3 h-3" />
              <span>{WORKING_HOURS_DISPLAY}</span>
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF8F5] truncate">
            {currentUser?.fullName}
          </h2>
          <p className="text-xs sm:text-sm text-[#C8DCD1] leading-relaxed">
            Manage your daily service schedule ({WORKING_HOURS_DISPLAY}), acknowledge dispatches, and record repair resolutions.
          </p>
        </div>

        {/* Availability Toggle */}
        <div className="bg-[#0E251B]/60 border border-[#1B4332] p-3 rounded-xl shrink-0 space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#A3C9B6]">
            Duty Status
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleStatusChange('available')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                technicianProfile?.status === 'available'
                  ? 'bg-[#52B788] text-[#0E251B] font-bold shadow-xs'
                  : 'text-[#C2DDD0] hover:text-white hover:bg-[#183D2D]'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => handleStatusChange('on_job')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                technicianProfile?.status === 'on_job'
                  ? 'bg-[#E7C169] text-[#0E251B] font-bold shadow-xs'
                  : 'text-[#C2DDD0] hover:text-white hover:bg-[#183D2D]'
              }`}
            >
              On Job
            </button>
            <button
              onClick={() => handleStatusChange('off_duty')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                technicianProfile?.status === 'off_duty'
                  ? 'bg-[#6C757D] text-white font-bold shadow-xs'
                  : 'text-[#C2DDD0] hover:text-white hover:bg-[#183D2D]'
              }`}
            >
              Off Duty
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
            <span className="truncate">Awaiting Accept</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {assignedCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Needs confirmation</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-[#143628] font-medium flex items-center justify-between">
            <span className="truncate">Active Dispatches</span>
            <Wrench className="w-4 h-4 text-[#1B4332] shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {activeCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Accepted or on-site</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span className="truncate">Jobs Done</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {technicianProfile?.completedJobsCount ?? completedCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Delivered resolutions</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
            <span className="truncate">Rating</span>
            <Star className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums flex items-baseline gap-1">
            <span>{Number(technicianProfile?.rating ?? 5.0).toFixed(1)}</span>
            <span className="text-xs text-[#8C9B90] font-normal">/ 5</span>
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Average customer review</div>
        </div>

        <div className="col-span-2 lg:col-span-1 p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-[#143628] font-medium flex items-center justify-between">
            <span className="truncate">Hourly Rate</span>
            <span className="text-[10px] font-bold font-mono text-[#143628] bg-[#EAE4D9] px-1.5 py-0.5 rounded border border-[#D8CFBE]">
              PKR
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-[#143628] font-mono truncate">
            {formatHourlyPrice(technicianProfile?.hourlyRate, 2000)}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Official billing rate</div>
        </div>
      </div>

      {/* Immediate Attention Queue */}
      <div className="bg-white border border-[#E8E2D8] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE3] gap-2">
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-bold text-[#143628] truncate">
              Immediate Action Queue
            </h3>
            <p className="text-xs text-[#69776E] mt-0.5 truncate">
              Service requests requiring your acceptance or currently in progress
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('assigned_jobs')}
            className="text-xs font-semibold text-[#143628] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>All Jobs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {actionNeededJobs.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#52B788] mx-auto" />
            <div className="font-serif text-base font-bold text-[#143628]">
              Your active queue is completely clear!
            </div>
            <p className="text-xs text-[#69776E] max-w-sm mx-auto">
              No pending jobs waiting for response. New dispatches from Operations Management will arrive here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EBE3]">
            {actionNeededJobs.map((req) => (
              <div
                key={req.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) return;
                  onSelectRequest(req);
                }}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] px-2 rounded-lg transition-colors cursor-pointer group"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-[#143628]">
                      {req.ticketNumber}
                    </span>
                    <StatusBadge status={req.status} />
                    <PriorityBadge priority={req.priority} />
                    <span className="text-xs text-[#69776E] capitalize truncate">· {req.category}</span>
                  </div>

                  <h4 className="text-sm font-semibold text-[#1F2421] group-hover:text-[#143628] transition-colors truncate">
                    {req.title}
                  </h4>

                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-[#69776E] flex-wrap">
                    <span className="font-medium text-[#2C3830] truncate">
                      Customer: {req.customerName}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[#143628] font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                      <span>{req.preferredDate}</span>
                    </span>
                    {req.preferredTimeSlot && (
                      <span className="flex items-center gap-1 font-mono text-[#143628] font-semibold">
                        <Clock className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                        <span>{req.preferredTimeSlot}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 truncate max-w-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                      <span className="truncate">{req.serviceAddress?.city || 'On-site'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0EBE3] shrink-0">
                  {actionError?.id === req.id && (
                    <span className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                      {actionError.message}
                    </span>
                  )}

                  {req.status === 'assigned' && (
                    <button
                      type="button"
                      disabled={actionLoadingId === req.id}
                      onClick={(e) => handleAcceptJob(e, req)}
                      className="px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#143628] hover:bg-[#1B4332] disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {actionLoadingId === req.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Accepting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept Job</span>
                        </>
                      )}
                    </button>
                  )}

                  {req.status === 'accepted' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actionLoadingId === req.id}
                        onClick={(e) => handleStartJob(e, req)}
                        className="px-3.5 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#1B4332] hover:bg-[#25614C] disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {actionLoadingId === req.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Starting...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Start Work</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {req.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => onSelectRequest(req)}
                      className="px-3.5 py-2 text-xs font-semibold text-[#143628] bg-[#EAE4D9] hover:bg-[#DDD5C7] rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Complete Work</span>
                    </button>
                  )}

                  <div className="p-1 text-[#8C9B90] group-hover:text-[#143628] group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
