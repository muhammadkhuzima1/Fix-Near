import React, { useState, useEffect } from 'react';
import {
  User,
  ServiceRequest,
  TechnicianProfile,
  ServiceCategory,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { TriggerService } from '../../services/triggerService';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge, isUrgentPriority } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { ManagerRequestDetailModal } from './ManagerRequestDetailModal';
import { ManagerRequestsList } from './ManagerRequestsList';
import { ManagerTechniciansList } from './ManagerTechniciansList';
import { ManagerAuditLogs } from './ManagerAuditLogs';
import { ManagerAIInsights } from './ManagerAIInsights';
import {
  formatPrice,
  formatHourlyRate,
  DEFAULT_CATEGORY_RATES,
  WORKING_HOURS_LABEL,
} from '../../utils/currency';
import {
  ClipboardList,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Users,
  Sparkles,
  Loader2,
  Calendar,
  Edit3,
  Save,
  RefreshCw,
} from 'lucide-react';

interface ManagerDashboardProps {
  currentUser?: User;
  requests: ServiceRequest[];
  technicians?: User[];
  customers?: User[];
  technicianProfiles?: TechnicianProfile[];
  activeTab?: string;
  onRefresh?: () => void;
  onSelectRequest?: (req: ServiceRequest) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenCreateTech?: () => void;
  onQuickApprove?: (req: ServiceRequest) => void;
  onQuickAIDispatch?: (req: ServiceRequest) => void;
}

const SERVICE_CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: 'plumbing', label: 'Plumbing' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'hvac', label: 'HVAC' },
  { key: 'appliance', label: 'Appliance' },
  { key: 'carpentry', label: 'Carpentry' },
  { key: 'general', label: 'General' },
];

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  currentUser: propUser,
  requests,
  technicians: propTechnicians,
  technicianProfiles: propTechProfiles,
  activeTab = 'dashboard',
  onRefresh,
  onSelectRequest,
  onOpenCreateTech,
  onQuickApprove,
  onQuickAIDispatch,
}) => {
  const { currentUser: authUser } = useAuth();
  const currentUser = propUser || authUser;

  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [technicians, setTechnicians] = useState<User[]>(propTechnicians || []);
  const [techProfiles, setTechProfiles] = useState<TechnicianProfile[]>(propTechProfiles || []);
  const [isAutoDispatching, setIsAutoDispatching] = useState(false);
  const [singleDispatchingId, setSingleDispatchingId] = useState<string | null>(null);
  const [autoDispatchBanner, setAutoDispatchBanner] = useState<{
    type: 'success' | 'info';
    text: string;
  } | null>(null);

  // Manager Fee Management State
  const [categoryRates, setCategoryRates] =
    useState<Record<ServiceCategory, number>>(DEFAULT_CATEGORY_RATES);
  const [editingRates, setEditingRates] =
    useState<Record<ServiceCategory, string>>({
      plumbing: String(DEFAULT_CATEGORY_RATES.plumbing),
      electrical: String(DEFAULT_CATEGORY_RATES.electrical),
      hvac: String(DEFAULT_CATEGORY_RATES.hvac),
      appliance: String(DEFAULT_CATEGORY_RATES.appliance),
      carpentry: String(DEFAULT_CATEGORY_RATES.carpentry),
      general: String(DEFAULT_CATEGORY_RATES.general),
    });
  const [showFeeEditor, setShowFeeEditor] = useState(false);
  const [syncTechRatesOnSave, setSyncTechRatesOnSave] = useState(true);
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [feeBanner, setFeeBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadManagerData = async () => {
      const [techs, profiles, fetchedRates] = await Promise.all([
        SupabaseService.fetchTechnicians(),
        SupabaseService.fetchTechnicianProfiles(),
        SupabaseService.fetchServiceCategoryRates(),
      ]);
      if (isMounted) {
        setTechnicians(techs);
        setTechProfiles(profiles);
        if (fetchedRates) {
          setCategoryRates(fetchedRates);
          setEditingRates({
            plumbing: String(fetchedRates.plumbing),
            electrical: String(fetchedRates.electrical),
            hvac: String(fetchedRates.hvac),
            appliance: String(fetchedRates.appliance),
            carpentry: String(fetchedRates.carpentry),
            general: String(fetchedRates.general),
          });
        }
      }
    };
    loadManagerData();
    return () => {
      isMounted = false;
    };
  }, [requests, activeTab]);

  const handleSaveServicePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeBanner(null);

    const parsedRates: Partial<Record<ServiceCategory, number>> = {};
    for (const item of SERVICE_CATEGORIES) {
      const val = Number(editingRates[item.key]);
      if (!Number.isFinite(val) || val < 100 || val > 500000) {
        setFeeBanner({
          type: 'error',
          text: `${item.label}: Enter a valid hourly rate between PKR 100 and PKR 500,000.`,
        });
        return;
      }
      parsedRates[item.key] = Math.round(val);
    }

    setIsSavingRates(true);
    try {
      const res = await SupabaseService.updateServiceCategoryRates(
        parsedRates,
        currentUser || null,
        syncTechRatesOnSave
      );
      if (!res.success || !res.rates) {
        setFeeBanner({
          type: 'error',
          text: res.error || 'Failed to save service prices.',
        });
      } else {
        setCategoryRates(res.rates);
        setShowFeeEditor(false);
        setFeeBanner({
          type: 'success',
          text: 'Service prices saved to Supabase.',
        });
        onRefresh?.();
      }
    } finally {
      setIsSavingRates(false);
    }
  };

  // Sort urgent requests ahead of normal requests in the queue
  const priorityWeight: Record<string, number> = {
    emergency: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const pendingApprovalRequests = requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

  const approvedUnassignedRequests = requests
    .filter((r) => r.status === 'approved' && !r.assignedTechnicianId)
    .sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

  const queueRequests = [...approvedUnassignedRequests, ...pendingApprovalRequests];

  const activeJobs = requests.filter((r) =>
    ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );
  const completedRequests = requests.filter((r) => r.status === 'completed');
  const urgentActiveRequests = requests.filter(
    (r) =>
      isUrgentPriority(r.priority) &&
      r.status !== 'completed' &&
      r.status !== 'cancelled'
  );
  const pendingReschedules = requests.filter(
    (r) => r.rescheduleRequest?.status === 'pending'
  );

  const availableTechs = techProfiles.filter((t) => t.status === 'available').length;

  const handleApproveAction = async (req: ServiceRequest, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onQuickApprove) {
      onQuickApprove(req);
      return;
    }
    if (!currentUser) return;
    setAutoDispatchBanner(null);
    const res = await SupabaseService.approveServiceRequest(req.id, currentUser);
    if (!res.success) {
      setAutoDispatchBanner({
        type: 'info',
        text: res.error || `Could not approve ${req.ticketNumber}.`,
      });
      return;
    }
    setAutoDispatchBanner({
      type: 'success',
      text: `${req.ticketNumber} approved. Ready for AI Dispatch.`,
    });
    onRefresh?.();
  };

  const handleDispatchAction = async (req: ServiceRequest, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onQuickAIDispatch) {
      onQuickAIDispatch(req);
      return;
    }
    if (!currentUser || singleDispatchingId || isAutoDispatching) return;

    setSingleDispatchingId(req.id);
    setAutoDispatchBanner(null);

    try {
      const res = await SupabaseService.aiDispatchServiceRequest(req.id, currentUser);
      if (res.assigned) {
        setAutoDispatchBanner({
          type: 'success',
          text: `Dispatched ${res.ticketNumber} to ${res.technicianName} (${res.matchedSkill}) for ${res.scheduledDate} · ${res.scheduledTimeSlot}.`,
        });
      } else {
        setAutoDispatchBanner({
          type: 'info',
          text: res.error || res.reason || `Could not dispatch ${req.ticketNumber}.`,
        });
      }
      onRefresh?.();
    } catch (err: any) {
      setAutoDispatchBanner({
        type: 'info',
        text: err.message || 'Error during AI Dispatch.',
      });
    } finally {
      setSingleDispatchingId(null);
    }
  };

  const handleRunAutoDispatch = async () => {
    if (approvedUnassignedRequests.length === 0) {
      setAutoDispatchBanner({
        type: 'info',
        text:
          pendingApprovalRequests.length > 0
            ? `Approve pending requests first (${pendingApprovalRequests.length} awaiting approval) before running AI Auto-Dispatch.`
            : 'No approved unassigned requests in the queue.',
      });
      return;
    }

    setIsAutoDispatching(true);
    setAutoDispatchBanner(null);
    try {
      const results = await SupabaseService.autoAssignPendingRequests(currentUser || undefined);
      const assignedList = results.filter((r) => r.assigned);

      for (const r of assignedList) {
        const req = requests.find((item) => item.id === r.requestId);
        const tech = technicians.find((t) => t.id === r.technicianId);
        if (req && tech) {
          TriggerService.triggerTechnicianAssigned(
            req,
            { id: tech.id, fullName: tech.fullName, email: tech.email, phone: tech.phone },
            { fullName: req.customerName, email: req.customerEmail, phone: req.customerPhone }
          );
        }
      }

      if (assignedList.length > 0) {
        const summary = assignedList
          .map((a) => `${a.ticketNumber} → ${a.technicianName} (${a.scheduledDate} · ${a.scheduledTimeSlot})`)
          .join('; ');
        setAutoDispatchBanner({
          type: 'success',
          text: `AI Auto-Dispatch assigned ${assignedList.length} request(s): ${summary}`,
        });
      } else {
        const firstReason = results[0]?.error || results[0]?.reason;
        setAutoDispatchBanner({
          type: 'info',
          text:
            firstReason ||
            'No available technicians with matching skills and conflict-free working hours found.',
        });
      }
      onRefresh?.();
    } catch {
      setAutoDispatchBanner({
        type: 'info',
        text: 'Could not complete batch AI auto-dispatch.',
      });
    } finally {
      setIsAutoDispatching(false);
    }
  };

  const handleRequestSelect = (req: ServiceRequest) => {
    if (onSelectRequest) {
      onSelectRequest(req);
    } else {
      setSelectedRequest(req);
    }
  };

  const activeSelectedRequest = selectedRequest
    ? requests.find((r) => r.id === selectedRequest.id) || null
    : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#143628] rounded-2xl p-6 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Operations Manager · {WORKING_HOURS_LABEL}
          </span>
          <h1 className="text-2xl font-bold mt-1">Dispatch & Operations Control</h1>
          <p className="text-xs text-[#E6E1D6]/85 mt-1">
            Approve requests, run AI Dispatch (urgent requests prioritized first), manage fees, and track payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="bg-white/10 border border-white/15 rounded-xl px-3.5 py-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-300" />
            <div className="text-xs">
              <span className="text-white/75 block">Available Techs</span>
              <span className="font-bold">
                {availableTechs} / {techProfiles.length}
              </span>
            </div>
          </div>

          <button
            onClick={handleRunAutoDispatch}
            disabled={isAutoDispatching}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#143628] hover:bg-[#FAF8F5] disabled:opacity-50 font-bold text-xs rounded-xl shadow-sm cursor-pointer"
          >
            {isAutoDispatching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-500" />
                AI Auto-Dispatch ({approvedUnassignedRequests.length})
              </>
            )}
          </button>
        </div>
      </div>

      {autoDispatchBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            autoDispatchBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{autoDispatchBanner.text}</span>
          <button
            onClick={() => setAutoDispatchBanner(null)}
            className="text-xs font-bold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <>
          {/* KPI Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5C5852]">Total</span>
                <ClipboardList className="w-4 h-4 text-[#143628]" />
              </div>
              <p className="text-2xl font-bold text-[#18181B] mt-1">{requests.length}</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5C5852]">Pending</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-[#18181B] mt-1">
                {pendingApprovalRequests.length}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5C5852]">Urgent Active</span>
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {urgentActiveRequests.length}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5C5852]">In Field</span>
                <Wrench className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-[#18181B] mt-1">{activeJobs.length}</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5C5852]">Reschedules</span>
                <RefreshCw className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-[#18181B] mt-1">
                {pendingReschedules.length}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#5C5852]">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-[#18181B] mt-1">
                {completedRequests.length}
              </p>
            </div>
          </div>

          {/* Manager Fee Management Card */}
          <div className="bg-white rounded-xl border border-[#E6E1D6] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#18181B]">
                  Service Category Hourly Rates (PKR)
                </h2>
                <p className="text-xs text-[#5C5852]">
                  Standard rates applied to service requests and payment summaries.
                </p>
              </div>
              {!showFeeEditor && (
                <button
                  type="button"
                  onClick={() => {
                    setFeeBanner(null);
                    setShowFeeEditor(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#143628] hover:bg-[#0f291e] text-white text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Service Prices
                </button>
              )}
            </div>

            {feeBanner && (
              <div
                className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
                  feeBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <span>{feeBanner.text}</span>
                <button
                  type="button"
                  onClick={() => setFeeBanner(null)}
                  className="text-xs font-bold underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {showFeeEditor ? (
              <form onSubmit={handleSaveServicePrices} className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {SERVICE_CATEGORIES.map((item) => (
                    <div
                      key={item.key}
                      className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]"
                    >
                      <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                        {item.label} (PKR/hr)
                      </label>
                      <input
                        type="number"
                        min={100}
                        max={500000}
                        step={50}
                        value={editingRates[item.key]}
                        onChange={(e) =>
                          setEditingRates((prev) => ({
                            ...prev,
                            [item.key]: e.target.value,
                          }))
                        }
                        required
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E6E1D6] rounded text-xs font-bold text-[#143628]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-[#5C5852] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncTechRatesOnSave}
                      onChange={(e) => setSyncTechRatesOnSave(e.target.checked)}
                      className="rounded border-gray-300 text-[#143628]"
                    />
                    <span>Sync matching technicians' hourly rates in Supabase</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFeeEditor(false)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingRates}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingRates ? 'Saving...' : 'Save Prices'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {SERVICE_CATEGORIES.map((item) => (
                  <div
                    key={item.key}
                    className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]"
                  >
                    <span className="text-[11px] font-semibold text-[#5C5852] block">
                      {item.label}
                    </span>
                    <span className="text-sm font-bold text-[#143628]">
                      {formatHourlyRate(categoryRates[item.key])}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Priority Dispatch Queue & Technician Roster */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#E6E1D6] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E6E1D6] flex items-center justify-between bg-[#FAF8F5]">
                <div>
                  <h2 className="text-sm font-bold text-[#18181B]">
                    Approval & Dispatch Queue ({queueRequests.length})
                  </h2>
                  <p className="text-[11px] text-[#5C5852]">
                    Urgent requests are prioritized first for available specialists
                  </p>
                </div>
              </div>

              {queueRequests.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-[#18181B]">Queue Clear</p>
                  <p className="text-xs text-[#5C5852] mt-0.5">
                    All incoming requests have been approved and dispatched.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E6E1D6]">
                  {queueRequests.slice(0, 8).map((req) => {
                    const payment = SupabaseService.computePaymentSummary(req);
                    return (
                      <div
                        key={req.id}
                        onClick={() => handleRequestSelect(req)}
                        className="p-4 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center shrink-0 mt-0.5">
                            <CategoryIcon
                              category={req.category}
                              className="w-4 h-4 text-[#143628]"
                            />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[#143628]">
                                {req.ticketNumber}
                              </span>
                              <StatusBadge status={req.status} size="sm" />
                              <PriorityBadge priority={req.priority} size="sm" />
                            </div>
                            <h3 className="text-sm font-bold text-[#18181B] mt-0.5">
                              {req.title}
                            </h3>
                            <p className="text-xs text-[#5C5852] mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{req.customerName}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#143628]" />
                                {req.preferredDate} · {req.preferredTimeSlot}
                              </span>
                              <span>·</span>
                              <span className="font-semibold text-[#143628]">
                                {formatPrice(payment.totalAmount)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {req.status === 'pending' && (
                            <button
                              onClick={(e) => handleApproveAction(req, e)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          {req.status === 'approved' && !req.assignedTechnicianId && (
                            <button
                              onClick={(e) => handleDispatchAction(req, e)}
                              disabled={singleDispatchingId === req.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white cursor-pointer"
                            >
                              {singleDispatchingId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              )}
                              AI Dispatch
                            </button>
                          )}

                          <button
                            onClick={() => handleRequestSelect(req)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FAF8F5] hover:bg-gray-100 text-[#18181B] border border-[#E6E1D6] cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Technician Roster Summary */}
            <div className="bg-white rounded-xl border border-[#E6E1D6] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E6E1D6] bg-[#FAF8F5] flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#18181B]">
                  Technician Status ({technicians.length})
                </h2>
                {onOpenCreateTech && (
                  <button
                    onClick={onOpenCreateTech}
                    className="text-xs font-semibold text-[#143628] hover:underline cursor-pointer"
                  >
                    + Add Tech
                  </button>
                )}
              </div>

              {technicians.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5C5852]">
                  No technicians registered in Supabase.
                </div>
              ) : (
                <div className="divide-y divide-[#E6E1D6]">
                  {technicians.map((tech) => {
                    const prof = techProfiles.find((p) => p.userId === tech.id);
                    const activeCount = requests.filter(
                      (r) =>
                        r.assignedTechnicianId === tech.id &&
                        ['assigned', 'accepted', 'in_progress'].includes(r.status)
                    ).length;

                    return (
                      <div
                        key={tech.id}
                        className="p-3.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#18181B]">{tech.fullName}</p>
                          <p className="text-[#5C5852]">
                            {prof?.specialty || 'General'} ·{' '}
                            {formatHourlyRate(prof?.hourlyRate || 2000)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              prof?.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : prof?.status === 'on_job'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {prof?.status === 'available'
                              ? 'Available'
                              : prof?.status === 'on_job'
                              ? 'On Job'
                              : 'Off Duty'}
                          </span>
                          <span className="block text-[11px] text-[#5C5852] mt-0.5">
                            {activeCount}/3 jobs
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'requests' && (
        <ManagerRequestsList
          requests={requests}
          onSelectRequest={(req) => handleRequestSelect(req)}
          onQuickApprove={handleApproveAction}
          onQuickAIDispatch={handleDispatchAction}
          dispatchingId={singleDispatchingId}
        />
      )}

      {activeTab === 'ai-insights' && (
        <ManagerAIInsights
          requests={requests}
          technicians={technicians}
          technicianProfiles={techProfiles}
        />
      )}

      {activeTab === 'technicians' && (
        <ManagerTechniciansList
          technicians={technicians}
          technicianProfiles={techProfiles}
          requests={requests}
          onOpenCreateTech={() => onOpenCreateTech?.()}
          onRefresh={() => onRefresh?.()}
        />
      )}

      {activeTab === 'audit' && <ManagerAuditLogs />}

      {activeSelectedRequest && currentUser && (
        <ManagerRequestDetailModal
          request={activeSelectedRequest}
          currentUser={currentUser}
          onClose={() => setSelectedRequest(null)}
          onUpdated={() => onRefresh?.()}
        />
      )}
    </div>
  );
};
