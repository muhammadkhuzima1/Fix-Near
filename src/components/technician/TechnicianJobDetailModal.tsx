import React, { useState, useEffect } from 'react';
import { ServiceRequest, User, PartItem, ServiceRequestLog, ServiceCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { TriggerService } from '../../services/triggerService';
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
  Mail,
  User as UserIcon,
  Wrench,
  CheckCircle2,
  Play,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash2,
  FileText,
  History,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface TechnicianJobDetailModalProps {
  request: ServiceRequest;
  currentUser?: User;
  onClose: () => void;
  onUpdated?: () => void;
  onRefresh?: () => void;
}

export const TechnicianJobDetailModal: React.FC<TechnicianJobDetailModalProps> = ({
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
      id: request.assignedTechnicianId || '',
      fullName: request.assignedTechnicianName || 'Technician',
      email: '',
      phone: request.assignedTechnicianPhone || '',
      role: 'technician',
      createdAt: request.createdAt,
    };
  const triggerRefresh = () => {
    if (onUpdated) onUpdated();
    if (onRefresh) onRefresh();
  };
  const [workNotes, setWorkNotes] = useState(request.workNotes || '');
  const [laborHours, setLaborHours] = useState(request.laborHours || 1.5);
  const [resolutionSummary, setResolutionSummary] = useState(request.resolutionSummary || '');
  const [parts, setParts] = useState<PartItem[]>(request.partsUsed || []);

  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartCost, setNewPartCost] = useState(500);

  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);
  const [categoryRates, setCategoryRates] =
    useState<Record<ServiceCategory, number>>(DEFAULT_CATEGORY_RATES);
  const [techHourlyRate, setTechHourlyRate] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    SupabaseService.fetchLogs(request.id).then((res) => {
      if (mounted) setLogs(res);
    });
    SupabaseService.fetchServiceCategoryRates().then((rates) => {
      if (mounted && rates) setCategoryRates(rates);
    });
    SupabaseService.getTechnicianProfile(currentUser.id).then((prof) => {
      if (mounted && prof?.hourlyRate) {
        setTechHourlyRate(prof.hourlyRate);
      }
    });
    return () => {
      mounted = false;
    };
  }, [request, currentUser.id]);

  const effectiveHourlyRate =
    techHourlyRate ||
    categoryRates[request.category] ||
    DEFAULT_CATEGORY_RATES[request.category] ||
    2000;

  const handleAccept = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await SupabaseService.acceptServiceRequest(request.id, currentUser);
      if (!res.success) {
        setError(res.error || 'Could not accept job.');
        return;
      }

      const targetRequest = res.request || request;
      await TriggerService.triggerServiceRequestAccepted(targetRequest, {
        id: currentUser.id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        phone: currentUser.phone,
      });

      triggerRefresh();
    } catch (err: any) {
      setError(err.message || 'Error accepting job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setError('Enter a reason for declining.');
      return;
    }
    setIsSubmitting(true);
    const res = await SupabaseService.rejectServiceRequest(
      request.id,
      rejectReason.trim(),
      currentUser
    );
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not decline job.');
      return;
    }
    triggerRefresh();
    onClose();
  };

  const handleStartJob = async () => {
    setError('');
    setIsSubmitting(true);
    const res = await SupabaseService.startServiceRequest(request.id, currentUser);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not start job.');
      return;
    }
    triggerRefresh();
  };

  const handleSaveNotes = async () => {
    setError('');
    setIsSubmitting(true);
    const res = await SupabaseService.updateWorkProgress(
      request.id,
      { workNotes, partsUsed: parts, laborHours },
      currentUser
    );
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not save notes.');
      return;
    }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2500);
    triggerRefresh();
  };

  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    setParts([
      ...parts,
      {
        id: `part-${Date.now()}`,
        name: newPartName.trim(),
        quantity: Number(newPartQty) || 1,
        unitPrice: Number(newPartCost) || 0,
        unitCost: Number(newPartCost) || 0,
      },
    ]);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartCost(500);
  };

  const handleRemovePart = (idx: number) => {
    setParts(parts.filter((_, i) => i !== idx));
  };

  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!resolutionSummary.trim()) {
      setError('Enter resolution summary.');
      return;
    }
    setIsSubmitting(true);
    const res = await SupabaseService.completeServiceRequest(
      request.id,
      {
        resolutionSummary: resolutionSummary.trim(),
        workNotes: workNotes.trim(),
        partsUsed: parts,
        laborHours: Number(laborHours) || 1,
      },
      currentUser
    );
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Could not complete job.');
      return;
    }

    TriggerService.triggerServiceRequestCompleted(
      request,
      {
        id: currentUser.id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        phone: currentUser.phone,
      },
      {
        resolutionSummary: resolutionSummary.trim(),
        workNotes: workNotes.trim(),
        partsUsed: parts,
        laborHours: Number(laborHours) || 1,
      }
    );

    triggerRefresh();
    onClose();
  };

  const totalPartsCost = parts.reduce(
    (acc, p) => acc + p.quantity * (p.unitCost ?? p.unitPrice ?? 0),
    0
  );
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

        <div className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Banner for Assigned / Accepted Status */}
          {request.status === 'assigned' && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                New Assignment
              </span>
              {!showRejectPrompt && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleAccept}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => setShowRejectPrompt(true)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-xl"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {showRejectPrompt && request.status === 'assigned' && (
            <form
              onSubmit={handleReject}
              className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2"
            >
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for declining *"
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
                  onClick={() => setShowRejectPrompt(false)}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {request.status === 'accepted' && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
                Ready to Start
              </span>
              <button
                onClick={handleStartJob}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Job
              </button>
            </div>
          )}

          {/* Customer, Address & Problem Info */}
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
                <FileText className="w-3.5 h-3.5" />
                Problem Description
              </h4>
              <p className="text-sm text-[#18181B] leading-relaxed">{request.description}</p>
              <div className="pt-2 border-t border-[#E6E1D6] text-xs font-semibold text-[#143628]">
                Applicable Rate: {formatHourlyRate(effectiveHourlyRate)}
              </div>
            </div>
          </div>

          {/* Appointment & Rescheduling Section */}
          <RescheduleSection
            request={request}
            currentUser={currentUser}
            onUpdated={onUpdated}
          />

          {/* Payment Summary & Recording Section */}
          <PaymentSummarySection
            request={request}
            currentUser={currentUser}
            hourlyRate={effectiveHourlyRate}
            onUpdated={onUpdated}
          />

          {/* Field Execution & Completion Form */}
          {(request.status === 'accepted' ||
            request.status === 'in_progress' ||
            request.status === 'completed') && (
            <div className="bg-white rounded-xl border border-[#E6E1D6] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-[#143628]" />
                  Field Work & Completion
                </h4>
                {noteSaved && (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5C5852] mb-1">
                    Technician Notes
                  </label>
                  <textarea
                    rows={2}
                    disabled={request.status === 'completed'}
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    placeholder="Inspection notes and repair actions..."
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C5852] mb-1">
                    Labor Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    disabled={request.status === 'completed'}
                    value={laborHours}
                    onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Parts Used */}
              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1.5">
                  Parts & Materials Used
                </label>
                {parts.length > 0 && (
                  <div className="mb-2 bg-[#FAF8F5] rounded-xl border border-[#E6E1D6] divide-y divide-[#E6E1D6]">
                    {parts.map((part, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-[#18181B]">
                          {part.name} (x{part.quantity})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#18181B]">
                            {formatPrice((part.unitCost ?? part.unitPrice ?? 0) * part.quantity)}
                          </span>
                          {request.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleRemovePart(idx)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="px-3 py-1.5 bg-gray-100/70 flex justify-between text-xs font-bold">
                      <span>Total Parts</span>
                      <span>{formatPrice(totalPartsCost)}</span>
                    </div>
                  </div>
                )}

                {request.status !== 'completed' && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      placeholder="Part name"
                      className="sm:col-span-6 px-3 py-1.5 bg-[#FAF8F5] border border-[#E6E1D6] rounded-lg text-xs"
                    />
                    <input
                      type="number"
                      min="1"
                      value={newPartQty}
                      onChange={(e) => setNewPartQty(parseInt(e.target.value) || 1)}
                      placeholder="Qty"
                      className="sm:col-span-2 px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E6E1D6] rounded-lg text-xs"
                    />
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={newPartCost}
                      onChange={(e) => setNewPartCost(parseFloat(e.target.value) || 0)}
                      placeholder="PKR"
                      className="sm:col-span-2 px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E6E1D6] rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddPart}
                      className="sm:col-span-2 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                )}
              </div>

              {request.status !== 'completed' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
                  >
                    Save Progress
                  </button>
                </div>
              )}

              {request.status === 'in_progress' && (
                <form
                  onSubmit={handleCompleteJob}
                  className="pt-3 border-t border-[#E6E1D6] space-y-2.5"
                >
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Resolution Summary *
                    </label>
                    <textarea
                      rows={2}
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Summary of completed work..."
                      className="w-full px-3 py-2 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Job
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
                Activity Log
              </h4>
              <div className="space-y-2 max-h-36 overflow-y-auto">
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
