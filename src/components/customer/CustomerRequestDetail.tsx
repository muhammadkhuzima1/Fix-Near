import React, { useState, useEffect } from 'react';
import { ServiceRequest, ServiceRequestLog, TechnicianProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import { store } from '../../services/store';
import { formatPrice, formatHourlyPrice } from '../../utils/currency';
import { WorkflowStepper } from '../common/WorkflowStepper';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Phone,
  User,
  Star,
  AlertTriangle,
  History,
  CheckCircle2,
  Package,
} from 'lucide-react';

interface CustomerRequestDetailProps {
  request: ServiceRequest;
  onClose: () => void;
  onRefresh: () => void;
}

export const CustomerRequestDetail: React.FC<CustomerRequestDetailProps> = ({
  request,
  onClose,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Rating state
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);
  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);
  const [techProfile, setTechProfile] = useState<TechnicianProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      const data = await SupabaseService.fetchLogs(request.id);
      if (isMounted) setLogs(data);
    };
    fetchLogs();

    if (request.assignedTechnicianId) {
      SupabaseService.getTechnicianProfile(request.assignedTechnicianId).then((prof) => {
        if (isMounted) setTechProfile(prof);
      });
    } else {
      setTechProfile(null);
    }

    return () => {
      isMounted = false;
    };
  }, [request.id, request.assignedTechnicianId]);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!cancelReason.trim()) {
      showToast('Please state a reason for cancelling.', 'error');
      return;
    }

    setCancelLoading(true);
    const res = await SupabaseService.cancelServiceRequest(request.id, cancelReason, currentUser);
    if (res.success) {
      showToast('Service request was cancelled.', 'info');
      setIsCancelling(false);
      onRefresh();
    } else {
      showToast(res.error || 'Failed to cancel request.', 'error');
    }
    setCancelLoading(false);
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setRatingLoading(true);
    const res = await SupabaseService.rateServiceRequest(
      request.id,
      { score: ratingScore, comment: ratingComment },
      currentUser
    );
    if (res.success) {
      showToast('Thank you for rating your service experience!', 'success');
      onRefresh();
    } else {
      showToast(res.error || 'Failed to submit review.', 'error');
    }
    setRatingLoading(false);
  };

  const canCancel = request.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="min-h-screen px-2 sm:px-4 text-center flex items-center justify-center py-4">
        <div className="relative bg-white text-left rounded-2xl shadow-xl border border-[#E8E2D8] max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 z-10 box-border font-sans">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-[#F0EBE3] gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono font-semibold text-[#143628]">
                  {request.ticketNumber}
                </span>
                <span className="text-[#C2DDD0]">·</span>
                <StatusBadge status={request.status} />
                <PriorityBadge priority={request.priority} />
              </div>
              <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#143628] truncate">
                {request.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#69776E] hover:text-[#143628] rounded-lg hover:bg-[#FAF8F5] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
            {/* 1. Complete Workflow Progress Stepper */}
            <div className="p-3.5 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 sm:mb-4">
                Status Progression
              </div>
              <WorkflowStepper
                status={request.status}
                cancellationReason={request.cancellationReason}
                cancelledAt={request.cancelledAt}
              />
            </div>

            {/* 2. Cancellation Dialog if user clicked Cancel */}
            {isCancelling && (
              <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <h3 className="text-sm font-semibold text-rose-900 mb-1">
                  Cancel Service Request
                </h3>
                <p className="text-xs text-rose-700 mb-3 leading-relaxed">
                  Are you sure? Since your request is still in Pending status, you may cancel it now.
                </p>
                <form onSubmit={handleCancel} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Provide a brief reason (e.g. Issue resolved on my own)"
                    className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-lg text-slate-900 focus:outline-none min-w-0"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCancelling(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-white rounded-md cursor-pointer"
                    >
                      Keep Request
                    </button>
                    <button
                      type="submit"
                      disabled={cancelLoading}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                    >
                      {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 3. Problem Description & Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Description */}
              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Issue Description
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {request.description}
                </p>
                <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="text-slate-500 font-mono">
                    AI Category: <span className="capitalize font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{request.category}</span>
                  </div>
                  {request.assignedTechnicianName ? (
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Auto-Assigned: {request.assignedTechnicianName}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      AI Dispatch Queue: Awaiting matching tech
                    </span>
                  )}
                </div>

                {request.attachments && request.attachments.length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs font-medium text-slate-500 mb-1.5">
                      Attachments ({request.attachments.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {request.attachments.map((img, idx) => (
                        <a
                          key={idx}
                          href={img}
                          target="_blank"
                          rel="noreferrer"
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-md border border-slate-200 overflow-hidden block"
                        >
                          <img
                            src={img}
                            alt="Attachment preview"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Service Schedule & Location */}
              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Location & Schedule
                </h4>
                <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="break-words">
                      {request.serviceAddress.street}
                      {request.serviceAddress.unit ? `, ${request.serviceAddress.unit}` : ''}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {request.serviceAddress.city}, {request.serviceAddress.state}{' '}
                      {request.serviceAddress.zip}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-700 pt-1 border-t border-slate-100">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Scheduled: {request.preferredDate}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{request.preferredTimeSlot}</span>
                </div>
              </div>
            </div>

            {/* 4. Assigned Technician Card (if assigned) */}
            {request.assignedTechnicianName && (
              <div className="p-3.5 sm:p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs sm:text-sm shrink-0">
                    {request.assignedTechnicianName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-indigo-600 font-medium">Assigned Technician</div>
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {request.assignedTechnicianName}
                    </div>
                    {request.assignedTechnicianPhone && (
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{request.assignedTechnicianPhone}</span>
                      </div>
                    )}
                    <div className="text-xs font-mono text-emerald-700 font-semibold mt-1">
                      Billing Rate: {formatHourlyPrice(techProfile?.hourlyRate, 2000)}
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-500 font-mono">
                  {request.status === 'in_progress' ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active on site
                    </span>
                  ) : request.status === 'accepted' ? (
                    <span className="text-violet-700 font-medium">Confirmed for appointment</span>
                  ) : (
                    <span className="text-indigo-600">Dispatched</span>
                  )}
                </div>
              </div>
            )}

            {/* 5. Completion Summary (if completed) */}
            {request.status === 'completed' && (
              <div className="p-3.5 sm:p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Job Resolution Summary</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words">
                  {request.resolutionSummary || 'Service was completed by the technician.'}
                </p>
                {request.workNotes && (
                  <div className="text-xs text-slate-600 border-t border-emerald-100 pt-2">
                    <span className="font-semibold text-slate-700">Technician notes: </span>
                    <span className="break-words">{request.workNotes}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-slate-600 pt-1">
                  {request.laborHours !== undefined && (
                    <span>
                      Labor: {request.laborHours}h {techProfile?.hourlyRate ? `(${formatHourlyPrice(techProfile.hourlyRate, 2000)})` : ''}
                    </span>
                  )}
                  {request.completedAt && (
                    <span>
                      Completed: {new Date(request.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Parts used */}
                {request.partsUsed && request.partsUsed.length > 0 && (
                  <div className="pt-2 border-t border-emerald-100 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        <span>Parts Installed</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-800 font-semibold">
                        Total: {formatPrice(request.partsUsed.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0))}
                      </span>
                    </div>
                    <div className="divide-y divide-emerald-100 text-xs">
                      {request.partsUsed.map((p) => (
                        <div key={p.id} className="py-1 flex items-center justify-between text-slate-600">
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
              </div>
            )}

            {/* 6. Customer Rating Section */}
            {request.status === 'completed' && (
              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl">
                {request.rating ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Your Service Review
                    </h4>
                    <div className="flex items-center gap-1.5 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < request.rating!.score
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-semibold text-slate-800 ml-1">
                        {request.rating.score} / 5
                      </span>
                    </div>
                    {request.rating.comment && (
                      <p className="text-xs text-slate-600 mt-1 italic break-words">
                        "{request.rating.comment}"
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleRate} className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Rate Your Service Experience
                    </h4>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingScore(star)}
                            className="p-1 hover:scale-110 transition-transform cursor-pointer"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= ratingScore
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {ratingScore} Stars
                      </span>
                    </div>
                    <input
                      type="text"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Optional feedback (e.g., Punctual, very thorough repair!)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none min-w-0"
                    />
                    <button
                      type="submit"
                      disabled={ratingLoading}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      {ratingLoading ? 'Submitting...' : 'Submit Rating'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 7. Audit History Logs */}
            <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Service Activity History</span>
              </h4>
              <div className="space-y-1.5 text-xs">
                {logs.length === 0 ? (
                  <div className="text-slate-400 text-xs py-1">No logs recorded yet.</div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-50/70 border border-slate-100 min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-800 break-words">{log.note}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          By {log.changedByName} ({log.changedByRole})
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-3 sm:pt-4 border-t border-slate-200 flex items-center justify-between">
              {canCancel && !isCancelling ? (
                <button
                  type="button"
                  onClick={() => setIsCancelling(true)}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel Request
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
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
