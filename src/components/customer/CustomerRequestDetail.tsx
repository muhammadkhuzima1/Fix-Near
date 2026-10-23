import React, { useState, useEffect } from 'react';
import { ServiceRequest, User, ServiceRequestLog, ServiceCategory } from '../../types';
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
} from '../../utils/currency';
import {
  X,
  MapPin,
  Phone,
  User as UserIcon,
  Wrench,
  CheckCircle2,
  XCircle,
  Star,
  History,
  FileText,
  ExternalLink,
} from 'lucide-react';

interface CustomerRequestDetailProps {
  request: ServiceRequest;
  currentUser?: User;
  onClose: () => void;
  onUpdated?: () => void;
  onRefresh?: () => void;
}

const STEPS = [
  { key: 'pending', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export const CustomerRequestDetail: React.FC<CustomerRequestDetailProps> = ({
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
      id: request.customerId,
      fullName: request.customerName,
      email: request.customerEmail || '',
      phone: request.customerPhone || '',
      role: 'customer',
      createdAt: request.createdAt,
    };
  const triggerRefresh = () => {
    if (onUpdated) onUpdated();
    if (onRefresh) onRefresh();
  };
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ratingScore, setRatingScore] = useState(request.rating?.score || 5);
  const [ratingComment, setRatingComment] = useState(request.rating?.comment || '');
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);
  const [categoryRates, setCategoryRates] =
    useState<Record<ServiceCategory, number>>(DEFAULT_CATEGORY_RATES);
  const [assignedTechRate, setAssignedTechRate] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    SupabaseService.fetchLogs(request.id).then((res) => {
      if (mounted) setLogs(res);
    });
    SupabaseService.fetchServiceCategoryRates().then((rates) => {
      if (mounted && rates) setCategoryRates(rates);
    });
    if (request.assignedTechnicianId) {
      SupabaseService.getTechnicianProfile(request.assignedTechnicianId).then((prof) => {
        if (mounted && prof?.hourlyRate) {
          setAssignedTechRate(prof.hourlyRate);
        }
      });
    } else {
      setAssignedTechRate(null);
    }
    return () => {
      mounted = false;
    };
  }, [request]);

  const effectiveHourlyRate =
    assignedTechRate ||
    categoryRates[request.category] ||
    DEFAULT_CATEGORY_RATES[request.category] ||
    2000;

  const getStepIndex = (status: string) => {
    if (status === 'cancelled') return -1;
    return STEPS.findIndex((s) => s.key === status);
  };

  const currentStepIdx = getStepIndex(request.status);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setCancelError('Enter a reason.');
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
      setCancelError(res.error || 'Could not cancel request.');
      return;
    }
    triggerRefresh();
    onClose();
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRatingError('');
    setIsSubmitting(true);
    const res = await SupabaseService.rateServiceRequest(
      request.id,
      { score: ratingScore, comment: ratingComment },
      currentUser
    );
    setIsSubmitting(false);

    if (res.success) {
      setRatingSuccess(true);
      triggerRefresh();
    } else {
      setRatingError(res.error || 'Could not save rating.');
    }
  };

  const hasCoords =
    typeof request.serviceAddress.latitude === 'number' &&
    typeof request.serviceAddress.longitude === 'number';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E1D6] shadow-2xl max-w-3xl w-full overflow-hidden my-8">
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

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status Progress */}
          {request.status !== 'cancelled' ? (
            <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E6E1D6]">
              <div className="grid grid-cols-6 gap-1.5">
                {STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={step.key} className="flex flex-col items-center text-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mb-1 ${
                          isDone
                            ? 'bg-[#143628] text-white'
                            : 'bg-white border border-gray-300 text-gray-400'
                        } ${isCurrent ? 'ring-2 ring-[#143628]/25' : ''}`}
                      >
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          isDone ? 'text-[#18181B]' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-900">Request Cancelled</h4>
                <p className="text-xs text-red-700 mt-0.5">
                  Reason: {request.cancellationReason || 'Cancelled'}
                </p>
              </div>
            </div>
          )}

          {/* Description, Location & Assigned Technician */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E6E1D6]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Issue Details
                </h4>
                <p className="text-sm text-[#18181B] leading-relaxed">{request.description}</p>
                <div className="mt-2 pt-2 border-t border-[#E6E1D6] text-xs font-semibold text-[#143628]">
                  Service Rate: {formatHourlyRate(effectiveHourlyRate)}
                </div>
              </div>

              <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E6E1D6]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#143628]" />
                  Service Location
                </h4>
                <p className="text-sm font-medium text-[#18181B]">
                  {request.serviceAddress.street}
                  {request.serviceAddress.unit ? `, ${request.serviceAddress.unit}` : ''}
                </p>
                <p className="text-xs text-[#5C5852]">
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

            <div className="space-y-3">
              {/* Assigned Technician */}
              <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E6E1D6] h-full">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Assigned Technician
                </h4>
                {request.assignedTechnicianName ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#143628] text-white flex items-center justify-center font-bold text-sm">
                        {request.assignedTechnicianName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#18181B]">
                          {request.assignedTechnicianName}
                        </p>
                        <p className="text-xs text-[#5C5852]">Certified Field Specialist</p>
                      </div>
                    </div>
                    {request.assignedTechnicianPhone && (
                      <div className="flex items-center gap-2 text-xs text-[#5C5852] pt-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{request.assignedTechnicianPhone}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[#5C5852] py-2">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span>
                      {request.status === 'pending'
                        ? 'Awaiting Manager approval.'
                        : 'Approved — awaiting technician dispatch.'}
                    </span>
                  </div>
                )}

                {request.resolutionSummary && (
                  <div className="mt-3 pt-3 border-t border-[#E6E1D6]">
                    <span className="text-[11px] font-bold uppercase text-emerald-800 block mb-1">
                      Resolution Summary
                    </span>
                    <p className="text-xs text-[#18181B]">{request.resolutionSummary}</p>
                    {request.partsUsed && request.partsUsed.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {request.partsUsed.map((part, i) => (
                          <div key={i} className="flex justify-between text-xs text-[#5C5852]">
                            <span>
                              {part.name} (x{part.quantity})
                            </span>
                            <span className="font-semibold">
                              {formatPrice((part.unitCost ?? part.unitPrice ?? 0) * part.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Appointment & Rescheduling Section */}
          <RescheduleSection
            request={request}
            currentUser={currentUser}
            onUpdated={onUpdated}
          />

          {/* Payment Summary Section */}
          <PaymentSummarySection
            request={request}
            currentUser={currentUser}
            hourlyRate={effectiveHourlyRate}
            onUpdated={onUpdated}
          />

          {/* Rating Section for Completed Requests */}
          {request.status === 'completed' && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                Service Feedback
              </h4>

              {request.rating || ratingSuccess ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= (request.rating?.score || ratingScore)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1.5 text-xs font-bold text-gray-800">
                      {request.rating?.score || ratingScore} / 5
                    </span>
                  </div>
                  {(request.rating?.comment || ratingComment) && (
                    <p className="text-xs text-gray-700 italic">
                      "{request.rating?.comment || ratingComment}"
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRate} className="space-y-2.5">
                  {ratingError && (
                    <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                      {ratingError}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        className="p-1"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= ratingScore
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Comment (optional)"
                    className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Submit Rating
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Cancel Option (Only when Pending) */}
          {request.status === 'pending' && (
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
                  className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2"
                >
                  {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Cancellation reason *"
                    className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(false)}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Activity History */}
          {logs.length > 0 && (
            <div className="pt-2 border-t border-[#E6E1D6]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Activity Log
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
