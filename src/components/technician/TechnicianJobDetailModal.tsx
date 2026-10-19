import React, { useState, useEffect } from 'react';
import { ServiceRequest, ServiceRequestLog, PartItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import { WorkflowStepper } from '../common/WorkflowStepper';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatPrice, formatHourlyPrice } from '../../utils/currency';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Phone,
  User,
  CheckCircle2,
  Play,
  XCircle,
  Plus,
  Trash2,
  Package,
  AlertCircle,
  FileText,
  Star,
  Wrench,
} from 'lucide-react';

interface TechnicianJobDetailModalProps {
  request: ServiceRequest;
  onClose: () => void;
  onRefresh: () => void;
}

export const TechnicianJobDetailModal: React.FC<TechnicianJobDetailModalProps> = ({
  request,
  onClose,
  onRefresh,
}) => {
  const { currentUser, technicianProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);

  // Decline state
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Complete work state
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [workNotes, setWorkNotes] = useState('');
  const [laborHours, setLaborHours] = useState<number>(1);
  const [parts, setParts] = useState<PartItem[]>([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartPrice, setNewPartPrice] = useState(0);

  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      const data = await SupabaseService.fetchLogs(request.id);
      if (isMounted) setLogs(data);
    };
    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [request.id]);

  // 1. Accept Job (Assigned → Accepted)
  const handleAcceptJob = async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await SupabaseService.acceptServiceRequest(request.id, currentUser);
    if (res.success) {
      showToast(`Job ${request.ticketNumber} accepted. Ready for dispatch!`, 'success');
      onRefresh();
      onClose();
    } else {
      showToast(res.error || 'Failed to accept job.', 'error');
    }
    setLoading(false);
  };

  // 2. Decline Job (Assigned → Approved)
  const handleDeclineJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!declineReason.trim()) {
      showToast('Please state reason for declining.', 'error');
      return;
    }

    setLoading(true);
    const res = await SupabaseService.declineServiceRequest(request.id, declineReason, currentUser);
    if (res.success) {
      showToast(`Job ${request.ticketNumber} returned to dispatch pool.`, 'info');
      setShowDeclineForm(false);
      onRefresh();
      onClose();
    } else {
      showToast(res.error || 'Failed to decline job.', 'error');
    }
    setLoading(false);
  };

  // 3. Start Work (Accepted → In Progress)
  const handleStartWork = async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await SupabaseService.startWork(request.id, currentUser);
    if (res.success) {
      showToast(`Work started on ${request.ticketNumber}. Status: In Progress.`, 'success');
      onRefresh();
    } else {
      showToast(res.error || 'Failed to start job.', 'error');
    }
    setLoading(false);
  };

  // 4. Add Part to list
  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    const newPart: PartItem = {
      id: 'part_' + Date.now(),
      name: newPartName.trim(),
      quantity: Number(newPartQty) || 1,
      unitPrice: Number(newPartPrice) || 0,
    };
    setParts([...parts, newPart]);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartPrice(0);
  };

  const handleRemovePart = (id: string) => {
    setParts(parts.filter((p) => p.id !== id));
  };

  // 5. Complete Job (In Progress → Completed)
  const handleCompleteWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!resolutionSummary.trim()) {
      showToast('Please enter a resolution summary describing what was fixed.', 'error');
      return;
    }

    setLoading(true);
    const res = await SupabaseService.completeWork(
      request.id,
      {
        resolutionSummary,
        workNotes,
        laborHours: Number(laborHours) || 1,
        partsUsed: parts,
      },
      currentUser
    );

    if (res.success) {
      showToast(`Job ${request.ticketNumber} marked as Completed!`, 'success');
      onRefresh();
    } else {
      showToast(res.error || 'Failed to complete job.', 'error');
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
        <div className="relative bg-white text-left rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 z-10 box-border">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-2">
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

          <div className="mt-4 sm:mt-5 space-y-4 sm:space-y-6">
            {/* Status Stepper */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <WorkflowStepper
                status={request.status}
                cancellationReason={request.cancellationReason}
                cancelledAt={request.cancelledAt}
              />
            </div>

            {/* ACTION BANNER DEPENDING ON CURRENT STATUS */}
            {request.status === 'assigned' && !showDeclineForm && (
              <div className="p-3.5 sm:p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-indigo-950">
                    New Job Assignment Assigned to You
                  </h4>
                  <p className="text-xs text-indigo-800 mt-0.5 leading-relaxed">
                    Review problem details and schedule. Accept to confirm or decline to return to dispatch pool.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDeclineForm(true)}
                    className="px-3 py-1.5 sm:py-2 text-xs font-medium text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleAcceptJob}
                    className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    {loading ? 'Processing...' : 'Accept Job'}
                  </button>
                </div>
              </div>
            )}

            {/* Decline Form */}
            {showDeclineForm && (
              <form onSubmit={handleDeclineJob} className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-semibold text-rose-900">Decline Assignment</h4>
                  <button
                    type="button"
                    onClick={() => setShowDeclineForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Back
                  </button>
                </div>
                <p className="text-xs text-rose-700">
                  Provide reason (e.g., schedule conflict, missing specialty tools):
                </p>
                <input
                  type="text"
                  required
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Reason for declining..."
                  className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-lg text-slate-900 focus:outline-none min-w-0"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeclineForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-white rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                  >
                    Confirm Decline
                  </button>
                </div>
              </form>
            )}

            {request.status === 'accepted' && (
              <div className="p-3.5 sm:p-4 bg-violet-50 border border-violet-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-violet-950">
                    Assignment Confirmed
                  </h4>
                  <p className="text-xs text-violet-800 mt-0.5 leading-relaxed">
                    Upon arrival at the customer location, press "Start Work" to notify customer and begin tracking.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartWork}
                  className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Work (On-Site)</span>
                </button>
              </div>
            )}

            {/* In-Progress Job Completion Form */}
            {request.status === 'in_progress' && (
              <form onSubmit={handleCompleteWork} className="p-3.5 sm:p-5 bg-emerald-50/60 border border-emerald-300 rounded-xl space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h4 className="text-xs sm:text-sm font-semibold text-emerald-950">
                    Active Job In Progress — Complete Resolution Details
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resolution Summary *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    placeholder="Describe the solution applied (e.g. Replaced worn intake gasket, verified pressure to 45 PSI)."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-0"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Diagnostic / Work Notes
                    </label>
                    <input
                      type="text"
                      value={workNotes}
                      onChange={(e) => setWorkNotes(e.target.value)}
                      placeholder="Notes for customer record"
                      className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-none min-w-0"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Labor Hours Spent *
                      </label>
                      <span className="text-[11px] font-mono text-emerald-800 font-medium">
                        Rate: {formatHourlyPrice(technicianProfile?.hourlyRate, 2000)}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      required
                      value={laborHours}
                      onChange={(e) => setLaborHours(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-none font-mono min-w-0"
                    />
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      Est. Labor Fee: {formatPrice((Number(laborHours) || 0) * (technicianProfile?.hourlyRate || 2000))}
                    </div>
                  </div>
                </div>

                {/* Parts Used Builder */}
                <div className="pt-2 border-t border-emerald-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Parts & Materials Consumed
                  </label>

                  <div className="flex flex-col min-[480px]:flex-row items-stretch min-[480px]:items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      placeholder="Part item name (e.g., 3/4 Ball Valve)"
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none min-w-0"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={newPartQty}
                        onChange={(e) => setNewPartQty(Number(e.target.value))}
                        placeholder="Qty"
                        className="w-16 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none font-mono"
                      />
                      <input
                        type="number"
                        step="10"
                        min="0"
                        value={newPartPrice}
                        onChange={(e) => setNewPartPrice(Number(e.target.value))}
                        placeholder="Price (PKR)"
                        className="w-24 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddPart}
                        className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {parts.length > 0 && (
                    <div className="space-y-2">
                      <div className="divide-y divide-emerald-200/60 bg-white/80 rounded-lg border border-emerald-200 p-2">
                        {parts.map((p) => (
                          <div key={p.id} className="py-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800 truncate pr-2">
                              {p.name} (x{p.quantity})
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-medium text-emerald-800">
                                {formatPrice(p.quantity * p.unitPrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePart(p.id)}
                                className="text-rose-500 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Parts Total Cost in PKR */}
                      <div className="flex items-center justify-between text-xs px-2 py-1 bg-emerald-100/70 text-emerald-950 rounded border border-emerald-200 font-medium">
                        <span>Total Installed Parts:</span>
                        <span className="font-mono font-bold text-emerald-900">
                          {formatPrice(parts.reduce((acc, curr) => acc + curr.quantity * curr.unitPrice, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    {loading ? 'Submitting...' : 'Complete & Close Ticket'}
                  </button>
                </div>
              </form>
            )}

            {/* Customer & Location Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Customer Contact */}
              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customer Information
                </h4>
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {request.customerName}
                </div>
                {request.customerPhone && (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`tel:${request.customerPhone}`} className="hover:underline text-sky-700 truncate">
                      {request.customerPhone}
                    </a>
                  </div>
                )}
                {request.customerEmail && (
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {request.customerEmail}
                  </div>
                )}
              </div>

              {/* Service Address */}
              <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Service Address
                </h4>
                <div className="text-xs sm:text-sm text-slate-800 flex items-start gap-1.5">
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
                <div className="pt-1.5 text-xs text-slate-500 flex items-center gap-3">
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

            {/* AI Technician Diagnostic Briefing */}
            <div className="p-3.5 sm:p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    AI Technician Diagnostic Brief
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-indigo-700 capitalize bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {request.category}
                  </span>
                  <PriorityBadge priority={request.priority} />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-indigo-900 leading-relaxed font-medium">
                [AI Dispatch Analysis] Customer problem identified as <span className="font-semibold underline capitalize">{request.category}</span> with <span className="font-semibold">{request.priority}</span> urgency. Prepare standard diagnostic equipment, proper safety isolation gear, and parts for {request.category} repair.
              </p>
            </div>

            {/* Problem Description & Evidence */}
            <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Customer Natural Language Problem Description
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

            {/* If completed: review info */}
            {request.status === 'completed' && request.rating && (
              <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Customer Review
                </div>
                <div className="flex items-center gap-1 mb-1">
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
                  <p className="text-xs text-slate-600 italic break-words">"{request.rating.comment}"</p>
                )}
              </div>
            )}

            {/* Audit Logs */}
            <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Activity Audit Trail
              </h4>
              <div className="space-y-1.5 text-xs">
                {logs.length === 0 ? (
                  <div className="text-slate-400 text-xs py-1">No logs available.</div>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="p-2 bg-slate-50 rounded flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800 break-words">{l.note}</span>
                        <span className="text-[11px] text-slate-400 ml-2">({l.changedByName})</span>
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
