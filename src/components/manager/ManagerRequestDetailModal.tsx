import React, { useState, useEffect } from 'react';
import { ServiceRequest, ServiceRequestLog, TechnicianProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
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
  CheckCircle2,
  AlertTriangle,
  History,
  Wrench,
  Package,
  Star,
  Sparkles,
} from 'lucide-react';

interface ManagerRequestDetailModalProps {
  request: ServiceRequest;
  onClose: () => void;
  onRefresh: () => void;
}

export const ManagerRequestDetailModal: React.FC<ManagerRequestDetailModalProps> = ({
  request,
  onClose,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);
  const [techProfile, setTechProfile] = useState<TechnicianProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadLogs = async () => {
      const data = await SupabaseService.fetchLogs(request.id);
      if (isMounted) setLogs(data);
    };
    loadLogs();

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

  // 1. AI Auto-Dispatch evaluation trigger
  const handleAutoDispatch = async () => {
    setLoading(true);
    try {
      const results = await SupabaseService.autoAssignPendingRequests();
      const matched = results.find((r) => r.requestId === request.id);
      if (matched && matched.assigned) {
        showToast(`AI auto-assigned ticket ${request.ticketNumber} to technician ${matched.technicianName}.`, 'success');
      } else {
        showToast(`No matching technician currently available for ${request.category}. Ticket remains Pending for auto-dispatch when a technician becomes available.`, 'info');
      }
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Auto-dispatch error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Approve Request (Pending → Approved)
  const handleApprove = async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await SupabaseService.approveServiceRequest(request.id, currentUser);
    if (res.success) {
      showToast(`Ticket ${request.ticketNumber} approved. AI auto-dispatching...`, 'success');
      await SupabaseService.autoAssignPendingRequests();
      onRefresh();
    } else {
      showToast(res.error || 'Failed to approve request.', 'error');
    }
    setLoading(false);
  };

  // 2. Cancel Request (Pending/Active → Cancelled)
  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!cancelReason.trim()) {
      showToast('Please state a reason for cancellation.', 'error');
      return;
    }

    setLoading(true);
    const res = await SupabaseService.cancelServiceRequest(request.id, cancelReason, currentUser);
    if (res.success) {
      showToast(`Ticket ${request.ticketNumber} was cancelled.`, 'info');
      setIsCancelling(false);
      onRefresh();
    } else {
      showToast(res.error || 'Failed to cancel request.', 'error');
    }
    setLoading(false);
  };

  const canApprove = request.status === 'pending';
  const canAutoDispatch = request.status === 'pending' || request.status === 'approved';
  const canCancel = request.status !== 'completed' && request.status !== 'cancelled';

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
                  {request.ticketNumber}
                </span>
                <span className="text-slate-300">·</span>
                <StatusBadge status={request.status} />
                <PriorityBadge priority={request.priority} />
                <span className="text-xs text-[#69776E] capitalize truncate">· {request.category}</span>
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

          <div className="mt-4 sm:mt-5 space-y-4 sm:space-y-6">
            {/* Status Stepper */}
            <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl overflow-hidden">
              <WorkflowStepper
                status={request.status}
                cancellationReason={request.cancellationReason}
                cancelledAt={request.cancelledAt}
              />
            </div>

            {/* Manager Primary Workflow Actions */}
            <div className="p-4 sm:p-5 bg-[#143628] text-[#FDFBF7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border border-[#1B4332]">
              <div className="min-w-0">
                <div className="text-xs font-mono text-[#A3C9B6] uppercase tracking-wider">
                  Dispatch Operations Action
                </div>
                <div className="text-xs sm:text-sm font-semibold mt-0.5 truncate">
                  {request.status === 'pending'
                    ? 'Pending Manager Approval'
                    : request.status === 'approved'
                    ? 'Ready for Technician Assignment'
                    : request.status === 'assigned'
                    ? `Assigned to ${request.assignedTechnicianName || 'Technician'}`
                    : `Status: ${request.status.toUpperCase()}`}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {canApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="px-3.5 sm:px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    Approve Ticket
                  </button>
                )}

                {canAutoDispatch && (
                  <button
                    onClick={handleAutoDispatch}
                    disabled={loading}
                    className="px-3.5 sm:px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Run AI Auto-Dispatch</span>
                  </button>
                )}

                {canCancel && !isCancelling && (
                  <button
                    onClick={() => setIsCancelling(true)}
                    className="px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel Ticket
                  </button>
                )}
              </div>
            </div>

            {/* Cancellation Form */}
            {isCancelling && (
              <form onSubmit={handleCancel} className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
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

            {/* Assigned Technician Card (if assigned) */}
            {request.assignedTechnicianName && (
              <div className="p-3.5 sm:p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                    {request.assignedTechnicianName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-indigo-700 font-semibold uppercase tracking-wider font-mono">
                      Assigned Field Technician
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {request.assignedTechnicianName}
                    </div>
                    {request.assignedTechnicianPhone && (
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{request.assignedTechnicianPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <div className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                    Rate: {formatHourlyPrice(techProfile?.hourlyRate, 2000)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1 capitalize">
                    Status: {request.status.replace('_', ' ')}
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
                  {request.customerName}
                </div>
                <div className="text-xs text-slate-600 font-mono truncate">
                  Phone: {request.customerPhone}
                </div>
                <div className="text-xs text-slate-500 font-mono truncate">
                  Email: {request.customerEmail}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Service Address & Slot
                </h4>
                <div className="text-xs sm:text-sm text-slate-800 break-words">
                  {request.serviceAddress.street}
                  {request.serviceAddress.unit ? `, ${request.serviceAddress.unit}` : ''}
                </div>
                <div className="text-xs text-slate-500">
                  {request.serviceAddress.city}, {request.serviceAddress.state} {request.serviceAddress.zip}
                </div>
                <div className="pt-1 text-xs text-slate-500 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{request.preferredDate}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{request.preferredTimeSlot ? request.preferredTimeSlot.split(' ')[0] : 'Flexible'}</span>
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
                {request.description}
              </p>

              {request.attachments && request.attachments.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-slate-400 mb-1.5">Attached Photos:</div>
                  <div className="flex flex-wrap gap-2">
                    {request.attachments.map((img, idx) => (
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
            {request.status === 'completed' && (
              <div className="p-3.5 sm:p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Completion Record</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed break-words">
                  {request.resolutionSummary}
                </p>
                {request.workNotes && (
                  <div className="text-xs text-slate-600 border-t border-emerald-100 pt-2">
                    <span className="font-semibold text-slate-700">Tech notes: </span>
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
                    <span>Completed: {new Date(request.completedAt).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Parts used */}
                {request.partsUsed && request.partsUsed.length > 0 && (
                  <div className="pt-2 border-t border-emerald-100 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        <span>Parts & Materials Consumed</span>
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

                {request.rating && (
                  <div className="pt-2 border-t border-emerald-100 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Customer Review:</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < request.rating!.score
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    {request.rating.comment && (
                      <span className="text-slate-600 italic break-words">"{request.rating.comment}"</span>
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
                    <div key={l.id} className="p-2 bg-slate-50 rounded flex items-center justify-between gap-2">
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
