import React, { useState, useEffect, useCallback } from 'react';
import {
  ServiceRequest,
  ServiceRequestLog,
  TechnicianProfile,
  AIDispatchCandidate,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import {
  formatPrice,
  formatHourlyPrice,
  WORKING_TIME_SLOTS,
  WORKING_HOURS_DISPLAY,
} from '../../utils/currency';
import { WorkflowStepper } from '../common/WorkflowStepper';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  X,
  Calendar,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle,
  History,
  Package,
  Star,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface ManagerRequestDetailModalProps {
  request: ServiceRequest;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
}

const WORKING_HOUR_SLOTS = WORKING_TIME_SLOTS;

export const ManagerRequestDetailModal: React.FC<ManagerRequestDetailModalProps> = ({
  request,
  onClose,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // Local copy of request so UI updates immediately upon Approve / AI Dispatch / Cancel
  const [currentRequest, setCurrentRequest] = useState<ServiceRequest>(request);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);
  const [techProfile, setTechProfile] = useState<TechnicianProfile | null>(null);

  // AI Dispatch preview & confirmation state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [candidates, setCandidates] = useState<AIDispatchCandidate[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(request.preferredDate || '');
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<string>(
    request.preferredTimeSlot || WORKING_HOUR_SLOTS[0]
  );
  const [previewDiagnostic, setPreviewDiagnostic] = useState<string>('');

  // Explicit feedback banner inside the modal
  const [dispatchBanner, setDispatchBanner] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Keep currentRequest synced when parent prop updates
  useEffect(() => {
    setCurrentRequest(request);
  }, [request]);

  const loadLogsAndTechProfile = useCallback(async (reqObj: ServiceRequest) => {
    const data = await SupabaseService.fetchLogs(reqObj.id);
    setLogs(data);

    if (reqObj.assignedTechnicianId) {
      const prof = await SupabaseService.getTechnicianProfile(reqObj.assignedTechnicianId);
      setTechProfile(prof);
    } else {
      setTechProfile(null);
    }
  }, []);

  useEffect(() => {
    loadLogsAndTechProfile(currentRequest);
  }, [currentRequest.id, currentRequest.assignedTechnicianId, currentRequest.status, loadLogsAndTechProfile]);

  // Load AI Dispatch candidate recommendation whenever ticket is in 'approved' unassigned state
  const loadDispatchPreview = useCallback(async (reqId: string) => {
    setPreviewLoading(true);
    try {
      const preview = await SupabaseService.previewAIDispatch(reqId);
      setCandidates(preview.allCandidates);
      setPreviewDiagnostic(preview.error || '');
      if (preview.candidate) {
        setSelectedTechId(preview.candidate.technician.id);
        setScheduledDate(preview.candidate.scheduledDate);
        setScheduledTimeSlot(preview.candidate.scheduledTimeSlot);
      } else {
        setSelectedTechId('');
      }
    } catch (err: any) {
      setPreviewDiagnostic(err.message || 'Unable to evaluate technician availability.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentRequest.status === 'approved' && !currentRequest.assignedTechnicianId) {
      loadDispatchPreview(currentRequest.id);
    }
  }, [currentRequest.id, currentRequest.status, currentRequest.assignedTechnicianId, loadDispatchPreview]);

  // When manager changes selected candidate from dropdown, sync default conflict-free schedule
  const handleSelectCandidate = (techId: string) => {
    setSelectedTechId(techId);
    const found = candidates.find((c) => c.technician.id === techId);
    if (found) {
      setScheduledDate(found.scheduledDate);
      setScheduledTimeSlot(found.scheduledTimeSlot);
    }
  };

  // 1. Approve Request (Pending -> Approved)
  const handleApprove = async () => {
    if (!currentUser || loading) return;
    setLoading(true);
    setDispatchBanner(null);
    try {
      const res = await SupabaseService.approveServiceRequest(currentRequest.id, currentUser);
      if (res.success) {
        const updatedReq = res.request || { ...currentRequest, status: 'approved' as const };
        setCurrentRequest(updatedReq);
        showToast(
          `Ticket ${currentRequest.ticketNumber} approved! Ready for AI Dispatch & Scheduling.`,
          'success'
        );
        setDispatchBanner({
          type: 'info',
          title: 'Request Approved — Ready for AI Dispatch',
          message:
            'Review the AI-matched available technician and appointment schedule below, then click "Confirm AI Dispatch & Schedule" to assign and save to Supabase.',
        });
        await loadLogsAndTechProfile(updatedReq);
        await loadDispatchPreview(updatedReq.id);
        await onRefresh();
      } else {
        const errMsg = res.error || 'Failed to approve service request.';
        setDispatchBanner({
          type: 'error',
          title: 'Approval Failed',
          message: errMsg,
        });
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unexpected error approving request.';
      setDispatchBanner({
        type: 'error',
        title: 'Approval Error',
        message: errMsg,
      });
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Confirm AI Dispatch & Save Assignment + Schedule to Supabase
  const handleConfirmAIDispatch = async () => {
    if (!currentUser) return;
    if (isDispatching || loading) return;

    if (currentRequest.status !== 'approved') {
      const msg =
        currentRequest.status === 'pending'
          ? 'Please approve this service request before running AI Dispatch.'
          : `Ticket ${currentRequest.ticketNumber} is already in "${currentRequest.status}" status.`;
      setDispatchBanner({
        type: 'error',
        title: 'Cannot Dispatch Request',
        message: msg,
      });
      showToast(msg, 'error');
      return;
    }

    setIsDispatching(true);
    setLoading(true);
    setDispatchBanner(null);

    try {
      const result = await SupabaseService.aiDispatchServiceRequest(
        currentRequest.id,
        currentUser,
        {
          technicianId: selectedTechId || undefined,
          preferredDate: scheduledDate || undefined,
          preferredTimeSlot: scheduledTimeSlot || undefined,
        }
      );

      if (result.assigned && result.request) {
        setCurrentRequest(result.request);
        await loadLogsAndTechProfile(result.request);

        const successMsg = `Assigned to ${result.technicianName} (${result.matchedSkill}) · Scheduled for ${result.scheduledDate} (${result.scheduledTimeSlot}).`;
        setDispatchBanner({
          type: 'success',
          title: 'AI Dispatch Confirmed & Saved',
          message: successMsg,
        });
        showToast(
          `AI Dispatch confirmed: ${result.technicianName} scheduled for ${result.scheduledDate} (${result.scheduledTimeSlot}).`,
          'success'
        );

        await onRefresh();
      } else {
        const errText =
          result.error ||
          result.reason ||
          'No suitable available technician could be assigned and scheduled.';
        setDispatchBanner({
          type: 'error',
          title: 'AI Dispatch Could Not Complete Assignment',
          message: errText,
        });
        showToast(errText, 'error');
        // Refresh preview in case state changed
        await loadDispatchPreview(currentRequest.id);
      }
    } catch (err: any) {
      const errText = err.message || 'An unexpected error occurred during AI Dispatch.';
      setDispatchBanner({
        type: 'error',
        title: 'AI Dispatch Failed',
        message: errText,
      });
      showToast(errText, 'error');
    } finally {
      setIsDispatching(false);
      setLoading(false);
    }
  };

  // 3. Cancel Request (Pending/Active -> Cancelled)
  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!cancelReason.trim()) {
      showToast('Please state a reason for cancellation.', 'error');
      return;
    }

    setLoading(true);
    const res = await SupabaseService.cancelServiceRequest(
      currentRequest.id,
      cancelReason,
      currentUser
    );
    if (res.success) {
      const updatedReq: ServiceRequest = {
        ...currentRequest,
        status: 'cancelled',
        cancellationReason: cancelReason,
        cancelledAt: new Date().toISOString(),
      };
      setCurrentRequest(updatedReq);
      showToast(`Ticket ${currentRequest.ticketNumber} was cancelled.`, 'info');
      setIsCancelling(false);
      await loadLogsAndTechProfile(updatedReq);
      await onRefresh();
    } else {
      showToast(res.error || 'Failed to cancel request.', 'error');
    }
    setLoading(false);
  };

  const canApprove = currentRequest.status === 'pending';
  const canAutoDispatch =
    currentRequest.status === 'approved' && !currentRequest.assignedTechnicianId;
  const canCancel =
    currentRequest.status !== 'completed' && currentRequest.status !== 'cancelled';

  const activeCandidate =
    candidates.find((c) => c.technician.id === selectedTechId) || candidates[0] || null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="min-h-screen px-2 sm:px-4 text-center flex items-center justify-center py-4">
        <div className="relative bg-white text-left rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 z-10 box-border">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono font-semibold text-slate-500">
                  {currentRequest.ticketNumber}
                </span>
                <span className="text-slate-300">·</span>
                <StatusBadge status={currentRequest.status} />
                <PriorityBadge priority={currentRequest.priority} />
                <span className="text-xs text-[#69776E] capitalize truncate">
                  · {currentRequest.category}
                </span>
              </div>
              <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#143628] truncate">
                {currentRequest.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#69776E] hover:text-[#143628] rounded-lg hover:bg-[#FAF8F5] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 sm:mt-5 space-y-4 sm:space-y-6">
            {/* Status Stepper */}
            <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl overflow-hidden">
              <WorkflowStepper
                status={currentRequest.status}
                cancellationReason={currentRequest.cancellationReason}
                cancelledAt={currentRequest.cancelledAt}
              />
            </div>

            {/* Dispatch Feedback Banner */}
            {dispatchBanner && (
              <div
                className={`p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 ${
                  dispatchBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : dispatchBanner.type === 'error'
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-950'
                }`}
              >
                {dispatchBanner.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : dispatchBanner.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold">{dispatchBanner.title}</div>
                  <p className="text-xs mt-0.5 leading-relaxed break-words">
                    {dispatchBanner.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDispatchBanner(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Manager Primary Workflow Actions */}
            <div className="p-4 sm:p-5 bg-[#143628] text-[#FDFBF7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border border-[#1B4332]">
              <div className="min-w-0">
                <div className="text-xs font-mono text-[#A3C9B6] uppercase tracking-wider">
                  Dispatch Operations Action
                </div>
                <div className="text-xs sm:text-sm font-semibold mt-0.5 truncate">
                  {currentRequest.status === 'pending'
                    ? 'Step 1: Approve Service Request Before Dispatch'
                    : currentRequest.status === 'approved'
                    ? 'Step 2: Approved — Ready for AI Dispatch & Scheduling'
                    : currentRequest.status === 'assigned'
                    ? `Dispatched to ${currentRequest.assignedTechnicianName || 'Technician'} · ${currentRequest.preferredDate} (${currentRequest.preferredTimeSlot})`
                    : `Status: ${currentRequest.status.replace('_', ' ').toUpperCase()}`}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {canApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="px-3.5 sm:px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    {loading ? 'Approving...' : 'Approve Ticket'}
                  </button>
                )}

                {canAutoDispatch && (
                  <button
                    onClick={handleConfirmAIDispatch}
                    disabled={loading || isDispatching}
                    className="px-3.5 sm:px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {isDispatching ? 'Dispatching...' : 'AI Dispatch'}
                    </span>
                  </button>
                )}

                {canCancel && !isCancelling && (
                  <button
                    onClick={() => setIsCancelling(true)}
                    disabled={loading}
                    className="px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel Ticket
                  </button>
                )}
              </div>
            </div>

            {/* AI Dispatch & Conflict-Free Appointment Scheduling Card (shown when status === 'approved') */}
            {canAutoDispatch && (
              <div className="p-4 sm:p-5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        AI Dispatch & Appointment Scheduling
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Evaluates technician availability, specialty skills, active workload, and working hours (9:00 AM – 6:00 PM)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-white text-[#143628] border border-indigo-200">
                      <Clock className="w-3 h-3" />
                      <span>{WORKING_HOURS_DISPLAY}</span>
                    </span>
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Manager Approved
                    </span>
                  </div>
                </div>

                {previewLoading ? (
                  <div className="p-4 bg-white rounded-lg border border-indigo-100 text-xs text-slate-600 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                    <span>Scanning available technicians and checking appointment schedules in Supabase...</span>
                  </div>
                ) : activeCandidate ? (
                  <div className="space-y-3.5">
                    {/* Matched Technician Summary */}
                    <div className="p-3.5 bg-white rounded-xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#143628] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {activeCandidate.technician.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">
                              {activeCandidate.technician.fullName}
                            </span>
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Available
                            </span>
                            <span className="text-xs text-amber-600 font-semibold flex items-center gap-0.5">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                              {activeCandidate.profile.rating.toFixed(1)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Specialty:{' '}
                            <span className="font-semibold text-slate-800">
                              {activeCandidate.profile.specialty}
                            </span>{' '}
                            · Active Load:{' '}
                            <span className="font-mono font-semibold">
                              {activeCandidate.activeWorkload} job(s)
                            </span>{' '}
                            · Rate:{' '}
                            <span className="font-mono font-semibold text-emerald-700">
                              {formatHourlyPrice(activeCandidate.profile.hourlyRate, 2000)}
                            </span>
                          </div>
                          <div className="text-[11px] text-indigo-700 mt-1 font-medium">
                            {activeCandidate.matchReason}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Technician Selector (if multiple eligible technicians exist) & Appointment Date/Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                          Eligible Technician ({candidates.length})
                        </label>
                        <select
                          value={selectedTechId}
                          onChange={(e) => handleSelectCandidate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                        >
                          {candidates.map((cand, idx) => (
                            <option key={cand.technician.id} value={cand.technician.id}>
                              {idx === 0 ? '★ AI Best Match: ' : ''}
                              {cand.technician.fullName} ({cand.profile.specialty} · {cand.activeWorkload} active)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                          Appointment Date
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                          Working Hours Slot (9 AM – 6 PM)
                        </label>
                        <select
                          value={scheduledTimeSlot}
                          onChange={(e) => setScheduledTimeSlot(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
                        >
                          {WORKING_HOUR_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Zero overlapping jobs on {scheduledDate} ({scheduledTimeSlot})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmAIDispatch}
                        disabled={loading || isDispatching}
                        className="px-4 py-2.5 text-xs font-semibold bg-[#143628] hover:bg-[#1B4332] disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2"
                      >
                        <UserCheck className="w-4 h-4 text-emerald-300" />
                        <span>
                          {isDispatching
                            ? 'Assigning & Saving Schedule...'
                            : `Confirm AI Dispatch & Schedule (${activeCandidate.technician.fullName})`}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">No Available Technician Currently Eligible</div>
                      <p className="mt-0.5 text-amber-800 leading-relaxed">
                        {previewDiagnostic ||
                          'All technicians are either off-duty, currently on an active job, or have conflicting schedules.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cancellation Form */}
            {isCancelling && (
              <form
                onSubmit={handleCancel}
                className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3"
              >
                <h4 className="text-xs sm:text-sm font-semibold text-rose-900">
                  Cancel Service Ticket
                </h4>
                <p className="text-xs text-rose-700">
                  State administrative reason for cancellation:
                </p>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Administrative reason for cancellation..."
                  className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-lg text-slate-900 focus:outline-none min-w-0"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCancelling(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-white rounded-md cursor-pointer"
                  >
                    Keep Ticket
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </form>
            )}

            {/* Assigned Technician & Confirmed Schedule Card (if assigned) */}
            {currentRequest.assignedTechnicianName && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {currentRequest.assignedTechnicianName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-indigo-700 font-semibold uppercase tracking-wider font-mono">
                      Assigned Field Technician
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {currentRequest.assignedTechnicianName}
                      {techProfile?.specialty ? ` · ${techProfile.specialty}` : ''}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600 font-mono">
                      {currentRequest.assignedTechnicianPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{currentRequest.assignedTechnicianPhone}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-indigo-900 font-semibold bg-white px-2 py-0.5 rounded border border-indigo-200">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Scheduled: {currentRequest.preferredDate}</span>
                      </span>
                      <span className="flex items-center gap-1 text-indigo-900 font-semibold bg-white px-2 py-0.5 rounded border border-indigo-200">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{currentRequest.preferredTimeSlot || '09:00 - 11:00'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <div className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                    Rate: {formatHourlyPrice(techProfile?.hourlyRate, 2000)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1 capitalize">
                    Status: {currentRequest.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            )}

            {/* Customer & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customer Profile & Contact
                </h4>
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {currentRequest.customerName}
                </div>
                <div className="text-xs text-slate-600 font-mono truncate">
                  Phone: {currentRequest.customerPhone}
                </div>
                <div className="text-xs text-slate-500 font-mono truncate">
                  Email: {currentRequest.customerEmail}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Service Address & Appointment Slot
                </h4>
                <div className="text-xs sm:text-sm text-slate-800 break-words">
                  {currentRequest.serviceAddress.street}
                  {currentRequest.serviceAddress.unit
                    ? `, ${currentRequest.serviceAddress.unit}`
                    : ''}
                </div>
                <div className="text-xs text-slate-500">
                  {currentRequest.serviceAddress.city}, {currentRequest.serviceAddress.state}{' '}
                  {currentRequest.serviceAddress.zip}
                </div>
                <div className="pt-1 text-xs text-slate-700 font-mono flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentRequest.preferredDate}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentRequest.preferredTimeSlot || '09:00 - 11:00'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Description & Attachments */}
            <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Issue Description
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {currentRequest.description}
              </p>

              {currentRequest.workNotes && currentRequest.status !== 'completed' && (
                <div className="pt-2 mt-2 border-t border-slate-100 text-xs text-slate-600 font-mono whitespace-pre-wrap">
                  {currentRequest.workNotes}
                </div>
              )}

              {currentRequest.attachments && currentRequest.attachments.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-slate-400 mb-1.5">Attached Photos:</div>
                  <div className="flex flex-wrap gap-2">
                    {currentRequest.attachments.map((img, idx) => (
                      <a
                        key={idx}
                        href={img}
                        target="_blank"
                        rel="noreferrer"
                        className="w-14 h-14 rounded-md border border-slate-200 overflow-hidden block"
                      >
                        <img src={img} alt="Attachment" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Completion & Resolution details (if completed) */}
            {currentRequest.status === 'completed' && (
              <div className="p-3.5 sm:p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Completion Record</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words">
                  {currentRequest.resolutionSummary}
                </p>
                {currentRequest.workNotes && (
                  <div className="text-xs text-slate-600 border-t border-emerald-100 pt-2">
                    <span className="font-semibold text-slate-700">Tech notes: </span>
                    <span className="break-words">{currentRequest.workNotes}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-slate-600 pt-1">
                  {currentRequest.laborHours !== undefined && (
                    <span>
                      Labor: {currentRequest.laborHours}h{' '}
                      {techProfile?.hourlyRate
                        ? `(${formatHourlyPrice(techProfile.hourlyRate, 2000)})`
                        : ''}
                    </span>
                  )}
                  {currentRequest.completedAt && (
                    <span>
                      Completed: {new Date(currentRequest.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Parts used */}
                {currentRequest.partsUsed && currentRequest.partsUsed.length > 0 && (
                  <div className="pt-2 border-t border-emerald-100 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        <span>Parts & Materials Consumed</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-800 font-semibold">
                        Total:{' '}
                        {formatPrice(
                          currentRequest.partsUsed.reduce(
                            (sum, p) => sum + p.quantity * p.unitPrice,
                            0
                          )
                        )}
                      </span>
                    </div>
                    <div className="divide-y divide-emerald-100 text-xs">
                      {currentRequest.partsUsed.map((p) => (
                        <div
                          key={p.id}
                          className="py-1 flex items-center justify-between text-slate-600"
                        >
                          <span className="truncate pr-2">
                            {p.name} (x{p.quantity})
                          </span>
                          <span className="font-mono font-medium text-emerald-800 shrink-0">
                            {formatPrice(p.quantity * p.unitPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentRequest.rating && (
                  <div className="pt-2 border-t border-emerald-100 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Customer Review:</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < currentRequest.rating!.score
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    {currentRequest.rating.comment && (
                      <span className="text-slate-600 italic break-words">
                        "{currentRequest.rating.comment}"
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Audit Logs */}
            <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Ticket Lifecycle Audit Trail</span>
              </h4>
              <div className="space-y-1.5 text-xs">
                {logs.length === 0 ? (
                  <div className="text-slate-400 text-xs py-1">No logs recorded yet.</div>
                ) : (
                  logs.map((l) => (
                    <div
                      key={l.id}
                      className="p-2 bg-slate-50 rounded flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800 break-words">{l.note}</span>
                        <span className="text-[11px] text-slate-400 ml-2 truncate">
                          ({l.changedByName} · {l.changedByRole})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {new Date(l.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

