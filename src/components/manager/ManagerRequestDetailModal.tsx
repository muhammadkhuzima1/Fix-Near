import React, { useState, useEffect } from 'react';
import {
  ServiceRequest,
  User,
  TechnicianProfile,
  ServiceRequestLog,
  AIDispatchCandidate,
  ServiceCategory,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { RescheduleSection } from '../common/RescheduleSection';
import { PaymentSummarySection } from '../common/PaymentSummarySection';
import {
  formatPrice,
  formatHourlyRate,
  DEFAULT_CATEGORY_RATES,
  WORKING_TIME_SLOTS,
  WORKING_HOURS_LABEL,
} from '../../utils/currency';
import {
  X,
  MapPin,
  Phone,
  Mail,
  User as UserIcon,
  Wrench,
  CheckCircle2,
  XCircle,
  UserCheck,
  History,
  AlertCircle,
  Star,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface ManagerRequestDetailModalProps {
  request: ServiceRequest;
  currentUser?: User;
  onClose: () => void;
  onUpdated?: () => void;
  onRefresh?: () => void;
}

export const ManagerRequestDetailModal: React.FC<ManagerRequestDetailModalProps> = ({
  request,
  currentUser: propUser,
  onClose,
  onUpdated,
  onRefresh,
}) => {
  const { currentUser: authUser } = useAuth();
  const currentUser =
    propUser ||
    authUser || {
      id: 'manager',
      fullName: 'Operations Manager',
      email: '',
      phone: '',
      role: 'manager',
      createdAt: request.createdAt,
    };
  const triggerRefresh = () => {
    if (onUpdated) onUpdated();
    if (onRefresh) onRefresh();
  };
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [techProfiles, setTechProfiles] = useState<TechnicianProfile[]>([]);
  const [allRequests, setAllRequests] = useState<ServiceRequest[]>([]);
  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);
  const [categoryRates, setCategoryRates] =
    useState<Record<ServiceCategory, number>>(DEFAULT_CATEGORY_RATES);

  const [selectedTechId, setSelectedTechId] = useState(request.assignedTechnicianId || '');
  const [scheduleDate, setScheduleDate] = useState(
    SupabaseService.normalizeAppointmentDate(request.preferredDate)
  );
  const [scheduleTimeSlot, setScheduleTimeSlot] = useState<string>(() => {
    const check = SupabaseService.validateWorkingHoursSlot(request.preferredTimeSlot);
    return check.valid ? check.canonical : WORKING_TIME_SLOTS[0];
  });

  const [aiCandidates, setAiCandidates] = useState<AIDispatchCandidate[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiDispatchError, setAiDispatchError] = useState('');
  const [isDispatchingAI, setIsDispatchingAI] = useState(false);
  const [aiDispatchSuccess, setAiDispatchSuccess] = useState('');

  const [error, setError] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDateStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoadingAI(true);
      const [techs, profiles, reqs, reqLogs, rates] = await Promise.all([
        SupabaseService.fetchTechnicians(),
        SupabaseService.fetchTechnicianProfiles(),
        SupabaseService.fetchServiceRequests(),
        SupabaseService.fetchLogs(request.id),
        SupabaseService.fetchServiceCategoryRates(),
      ]);

      if (!isMounted) return;
      const validTechs = techs.filter((t) => t.role === 'technician');
      setTechnicians(validTechs);
      setTechProfiles(profiles);
      setAllRequests(reqs);
      setLogs(reqLogs);
      if (rates) setCategoryRates(rates);

      if (request.status === 'approved' || request.status === 'pending') {
        const previewRes = await SupabaseService.previewAIDispatch(request.id);
        if (!isMounted) return;
        setAiCandidates(previewRes.allCandidates);
        if (previewRes.candidate) {
          setAiDispatchError('');
          if (!request.assignedTechnicianId) {
            setSelectedTechId(previewRes.candidate.technician.id);
            setScheduleDate(previewRes.candidate.scheduledDate);
            setScheduleTimeSlot(previewRes.candidate.scheduledTimeSlot);
          }
        } else {
          setAiDispatchError(
            previewRes.error || 'No suitable available technician found. Request remains pending.'
          );
        }
      }
      setIsLoadingAI(false);
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [request]);

  const getTechProfile = (userId: string) =>
    techProfiles.find((p) => p.userId === userId || p.id === userId);
  const getActiveJobCount = (techId: string) =>
    allRequests.filter(
      (r) =>
        r.id !== request.id &&
        r.assignedTechnicianId === techId &&
        ['assigned', 'accepted', 'in_progress'].includes(r.status)
    ).length;

  const assignedTechProfile = request.assignedTechnicianId
    ? getTechProfile(request.assignedTechnicianId)
    : undefined;
  const effectiveHourlyRate =
    assignedTechProfile?.hourlyRate ||
    categoryRates[request.category] ||
    DEFAULT_CATEGORY_RATES[request.category] ||
    2000;

  const handleApprove = async () => {
    setError('');
    setIsSubmitting(true);
    const res = await SupabaseService.approveServiceRequest(request.id, currentUser);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not approve request.');
      return;
    }
    triggerRefresh();
  };

  const handleConfirmAIDispatch = async () => {
    setError('');
    setAiDispatchSuccess('');
    if (request.status !== 'pending' && request.status !== 'approved') {
      setError('This request has already been dispatched or closed.');
      return;
    }

    const slotValidation = SupabaseService.validateWorkingHoursSlot(scheduleTimeSlot);
    if (!slotValidation.valid) {
      setError(
        slotValidation.error || `Appointments must fit within ${WORKING_HOURS_LABEL}.`
      );
      return;
    }

    setIsDispatchingAI(true);
    try {
      const dispatchRes = await SupabaseService.aiDispatchServiceRequest(
        request.id,
        currentUser,
        {
          technicianId: selectedTechId || undefined,
          preferredDate: scheduleDate,
          preferredTimeSlot: slotValidation.canonical,
        }
      );

      if (!dispatchRes.assigned) {
        setError(dispatchRes.error || dispatchRes.reason || 'AI Dispatch could not assign a technician.');
        return;
      }

      setAiDispatchSuccess(
        `Assigned to ${dispatchRes.technicianName} for ${dispatchRes.scheduledDate} (${dispatchRes.scheduledTimeSlot}).`
      );
      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'Error during AI Dispatch.');
    } finally {
      setIsDispatchingAI(false);
    }
  };

  const handleAssignManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAiDispatchSuccess('');
    if (!selectedTechId) {
      setError('Select a technician to assign.');
      return;
    }

    const slotValidation = SupabaseService.validateWorkingHoursSlot(scheduleTimeSlot);
    if (!slotValidation.valid) {
      setError(
        slotValidation.error || `Appointments must fit within ${WORKING_HOURS_LABEL}.`
      );
      return;
    }

    setIsSubmitting(true);
    const res = await SupabaseService.assignTechnician(
      request.id,
      selectedTechId,
      currentUser,
      {
        preferredDate: scheduleDate,
        preferredTimeSlot: slotValidation.canonical,
      }
    );
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not assign technician.');
      return;
    }
    setAiDispatchSuccess(
      `Assigned to ${res.request?.assignedTechnicianName || 'technician'} for ${scheduleDate} (${slotValidation.canonical}).`
    );
    triggerRefresh();
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setError('Provide a cancellation reason.');
      return;
    }
    setIsSubmitting(true);
    const res = await SupabaseService.cancelServiceRequest(
      request.id,
      cancelReason.trim(),
      currentUser
    );
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not cancel request.');
      return;
    }
    triggerRefresh();
    onClose();
  };

  const bestCandidate = aiCandidates[0] || null;
  const hasCoords =
    typeof request.serviceAddress.latitude === 'number' &&
    typeof request.serviceAddress.longitude === 'number';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E1D6] shadow-2xl max-w-4xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF8F5] border-b border-[#E6E1D6] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#143628]/10 text-[#143628] flex items-center justify-center">
              <CategoryIcon category={request.category} className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#143628] bg-[#143628]/10 px-2 py-0.5 rounded">
                  {request.ticketNumber}
                </span>
                <StatusBadge status={request.status} size="sm" />
                <PriorityBadge priority={request.priority} size="sm" />
              </div>
              <h2 className="text-base font-bold text-[#18181B] mt-1">{request.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aiDispatchSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{aiDispatchSuccess}</span>
            </div>
          )}

          {/* Manager Approval & Dispatch Controls */}
          {request.status !== 'completed' && request.status !== 'cancelled' && (
            <div className="bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl p-4 space-y-4">
              {request.status === 'pending' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E6E1D6]">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Step 1: Approve Request
                    </h4>
                    <p className="text-xs text-[#5C5852] mt-0.5">
                      Approve this request to unlock technician dispatch.
                    </p>
                  </div>
                  <button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Request
                  </button>
                </div>
              )}

              {(request.status === 'pending' ||
                request.status === 'approved' ||
                request.status === 'assigned' ||
                request.status === 'accepted') && (
                <div className="space-y-3">
                  {/* AI Dispatch Recommendation */}
                  {(request.status === 'pending' || request.status === 'approved') &&
                    !request.assignedTechnicianId && (
                      <div className="bg-white rounded-xl p-3.5 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#143628]">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>AI Dispatch Recommendation</span>
                          </div>
                          {isLoadingAI ? (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Analyzing issue, required skills & technician availability...
                            </p>
                          ) : bestCandidate ? (
                            <p className="text-xs text-[#5C5852] mt-1">
                              Best Match: <strong className="text-[#18181B]">{bestCandidate.technician.fullName}</strong> ({bestCandidate.profile.specialty}) · {bestCandidate.scheduledDate} · {bestCandidate.scheduledTimeSlot}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-800 mt-1">
                              {aiDispatchError || 'No suitable available specialist found. Request will remain pending.'}
                            </p>
                          )}
                        </div>

                        {bestCandidate && (
                          <button
                            type="button"
                            onClick={handleConfirmAIDispatch}
                            disabled={isDispatchingAI || isSubmitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
                          >
                            {isDispatchingAI ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Dispatching...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                Confirm AI Dispatch
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                  {/* Manual Assignment / Schedule Override */}
                  <form onSubmit={handleAssignManual} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5C5852] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#143628]" />
                        {request.assignedTechnicianId ? 'Reassign Technician' : 'Assign Technician'}
                      </label>
                      <span className="text-[11px] font-semibold text-[#143628]">
                        {WORKING_HOURS_LABEL}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                          Technician
                        </label>
                        <select
                          value={selectedTechId}
                          onChange={(e) => setSelectedTechId(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-[#E6E1D6] rounded-lg text-xs"
                        >
                          <option value="">-- Select Technician --</option>
                          {technicians.map((tech) => {
                            const prof = getTechProfile(tech.id);
                            const activeCount = getActiveJobCount(tech.id);
                            return (
                              <option
                                key={tech.id}
                                value={tech.id}
                                disabled={prof?.status === 'off_duty'}
                              >
                                {tech.fullName} — {prof?.specialty || 'General'} ({activeCount}/3 jobs)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          min={minDateStr}
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-[#E6E1D6] rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                          Time Slot
                        </label>
                        <select
                          value={scheduleTimeSlot}
                          onChange={(e) => setScheduleTimeSlot(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-[#E6E1D6] rounded-lg text-xs"
                        >
                          {WORKING_TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || isDispatchingAI}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                      >
                        {request.assignedTechnicianId ? 'Save Reassignment' : 'Assign Technician'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Customer & Issue Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E6E1D6] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5" />
                Customer & Location
              </h4>
              <p className="text-sm font-bold text-[#18181B]">{request.customerName}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C5852]">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {request.customerPhone}
                </span>
                {request.customerEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {request.customerEmail}
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-[#E6E1D6]">
                <p className="text-xs font-semibold text-[#18181B] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#143628]" />
                  {request.serviceAddress.street}
                  {request.serviceAddress.unit ? `, ${request.serviceAddress.unit}` : ''}
                </p>
                <p className="text-xs text-[#5C5852] pl-4">
                  {request.serviceAddress.city}
                  {request.serviceAddress.state ? `, ${request.serviceAddress.state}` : ''}
                </p>
                {hasCoords && (
                  <div className="mt-2 pt-2 border-t border-[#E6E1D6] flex items-center justify-between text-xs">
                    <span className="text-[#5C5852] font-mono">
                      GPS: {request.serviceAddress.latitude}, {request.serviceAddress.longitude}
                    </span>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${request.serviceAddress.latitude}&mlon=${request.serviceAddress.longitude}#map=17/${request.serviceAddress.latitude}/${request.serviceAddress.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#143628] hover:underline"
                    >
                      Open in Maps
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E6E1D6] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                Issue & Field Report
              </h4>
              <p className="text-sm text-[#18181B] leading-relaxed">{request.description}</p>
              <div className="pt-2 border-t border-[#E6E1D6] flex items-center justify-between text-xs">
                <span className="text-[#5C5852]">Assigned Technician:</span>
                <span className="font-bold text-[#18181B]">
                  {request.assignedTechnicianName || 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5C5852]">Hourly Rate:</span>
                <span className="font-bold text-[#143628]">
                  {formatHourlyRate(effectiveHourlyRate)}
                </span>
              </div>
              {request.resolutionSummary && (
                <div className="pt-2 border-t border-[#E6E1D6]">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                    Resolution
                  </span>
                  <p className="text-xs text-[#18181B]">{request.resolutionSummary}</p>
                </div>
              )}
              {request.rating && (
                <div className="pt-2 border-t border-[#E6E1D6] flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-bold">{request.rating.score}/5</span>
                  {request.rating.comment && (
                    <span className="text-xs text-[#5C5852] italic">
                      "{request.rating.comment}"
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Appointment & Rescheduling Section */}
          <RescheduleSection
            request={request}
            currentUser={currentUser}
            onUpdated={onUpdated}
          />

          {/* Payment Summary & Manager Recording Section */}
          <PaymentSummarySection
            request={request}
            currentUser={currentUser}
            hourlyRate={effectiveHourlyRate}
            onUpdated={onUpdated}
          />

          {/* Cancel Request */}
          {request.status !== 'completed' && request.status !== 'cancelled' && (
            <div className="pt-2 border-t border-[#E6E1D6]">
              {!showCancelPrompt ? (
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(true)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancel Request
                </button>
              ) : (
                <form
                  onSubmit={handleCancel}
                  className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2.5"
                >
                  <h5 className="text-xs font-bold text-red-900">Cancel Service Request</h5>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation..."
                    className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Confirm Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(false)}
                      className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg"
                    >
                      Keep Active
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Activity Log */}
          {logs.length > 0 && (
            <div className="pt-2 border-t border-[#E6E1D6]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Audit Trail ({logs.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="text-xs bg-[#FAF8F5] p-2.5 rounded-lg border border-[#E6E1D6]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#18181B]">
                        {log.changedByName} ({log.changedByRole})
                      </span>
                      <span className="text-[11px] text-[#5C5852]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#5C5852] mt-0.5">{log.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
