import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ServiceRequest, User, TechnicianProfile } from '../../types';
import { store } from '../../services/store';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  Wrench,
  Clock,
  CheckCircle2,
  Users,
  ShieldCheck,
  ArrowRight,
  Plus,
  Calendar,
  MapPin,
  TrendingUp,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface ManagerDashboardProps {
  requests: ServiceRequest[];
  technicians: User[];
  customers: User[];
  technicianProfiles?: TechnicianProfile[];
  onSelectRequest: (request: ServiceRequest) => void;
  onNavigateTab: (tab: string) => void;
  onOpenCreateTech: () => void;
  onQuickApprove?: (request: ServiceRequest) => void | Promise<void>;
  onQuickAIDispatch?: (request: ServiceRequest) => void | Promise<void>;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  requests,
  technicians,
  customers,
  technicianProfiles,
  onSelectRequest,
  onNavigateTab,
  onOpenCreateTech,
  onQuickApprove,
  onQuickAIDispatch,
}) => {
  const { currentUser, isSupabaseActive } = useAuth();
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const handleRowApprove = async (req: ServiceRequest) => {
    if (!onQuickApprove || busyIds[req.id]) return;
    setBusyIds((prev) => ({ ...prev, [req.id]: true }));
    try {
      await onQuickApprove(req);
    } finally {
      setBusyIds((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  const handleRowAIDispatch = async (req: ServiceRequest) => {
    if (busyIds[req.id]) return;
    if (!onQuickAIDispatch) {
      onSelectRequest(req);
      return;
    }
    setBusyIds((prev) => ({ ...prev, [req.id]: true }));
    try {
      await onQuickAIDispatch(req);
    } finally {
      setBusyIds((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const activeDispatches = requests.filter((r) =>
    ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );
  const activeCount = activeDispatches.length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  // Technicians stats strictly filtered against active technician users
  const validTechIds = new Set(technicians.map((t) => t.id));
  const rawProfiles =
    technicianProfiles && technicianProfiles.length > 0
      ? technicianProfiles
      : isSupabaseActive
      ? []
      : store.getTechnicianProfiles();
  const techProfiles = rawProfiles.filter(
    (p) => validTechIds.has(p.id) || validTechIds.has(p.userId)
  );
  const availableTechs = techProfiles.filter((p) => p.status === 'available').length;

  const urgentQueue = requests.filter(
    (r) => r.status === 'pending' || r.status === 'approved'
  );

  return (
    <div className="space-y-6 w-full max-w-full font-sans">
      {/* Top Banner */}
      <div className="bg-[#143628] text-[#FDFBF7] rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm border border-[#1B4332]">
        <div className="space-y-2 max-w-xl min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[#A3C9B6] uppercase tracking-wider">
              Central Operations Console
            </span>
            <span className="text-xs text-[#C8DCD1]">· Field Dispatch Supervision</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF8F5] truncate">
            Welcome, {currentUser?.fullName}
          </h2>
          <p className="text-xs sm:text-sm text-[#C8DCD1] leading-relaxed">
            Review incoming customer requests, authorize dispatches, assign field technicians, and track end-to-end resolution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => onNavigateTab('users')}
            className="px-3.5 py-2.5 bg-[#0E251B]/60 hover:bg-[#183D2D] text-[#C2DDD0] hover:text-white border border-[#1B4332] font-medium text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#52B788]" />
            <span>Users & Roles</span>
          </button>
          <button
            onClick={onOpenCreateTech}
            className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-white text-[#143628] font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Technician</span>
          </button>
        </div>
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-2 min-[640px]:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
            <span className="truncate">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {pendingCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Awaiting manager approval</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-[#143628] font-medium flex items-center justify-between">
            <span className="truncate">Ready for Tech</span>
            <Wrench className="w-4 h-4 text-[#1B4332] shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {approvedCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Approved, ready for AI Dispatch</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-[#1B4332] font-medium flex items-center justify-between">
            <span className="truncate">Active Dispatches</span>
            <TrendingUp className="w-4 h-4 text-[#2D6A4F] shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {activeCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Assigned & scheduled</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs">
          <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span className="truncate">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {completedCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Successfully resolved</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1 shadow-2xs col-span-2 min-[640px]:col-span-1">
          <div className="text-xs text-[#526056] font-medium flex items-center justify-between">
            <span className="truncate">Field Techs</span>
            <Users className="w-4 h-4 text-[#8C9B90] shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#143628] font-mono tabular-nums">
            {technicians.length}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">
            {availableTechs} available for dispatch
          </div>
        </div>
      </div>

      {/* Two Column Layout: Dispatches + Sidebar widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Pending & Unassigned Dispatches */}
          <div className="bg-white border border-[#E8E2D8] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE3] gap-2">
              <div className="min-w-0">
                <h3 className="font-serif text-lg font-bold text-[#143628] truncate">
                  Pending & Unassigned Dispatches
                </h3>
                <p className="text-xs text-[#69776E] mt-0.5 truncate">
                  Step 1: Approve pending tickets · Step 2: Confirm AI Dispatch & schedule
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('requests')}
                className="text-xs font-semibold text-[#143628] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {urgentQueue.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#52B788] mx-auto" />
                <div className="font-serif text-base font-bold text-[#143628]">
                  All dispatches are up to date!
                </div>
                <p className="text-xs text-[#69776E] max-w-sm mx-auto">
                  No tickets currently require approval or technician dispatch.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EBE3]">
                {urgentQueue.map((req) => {
                  const isBusy = Boolean(busyIds[req.id]);
                  return (
                    <div
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] px-2 rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-[#143628]">
                            {req.ticketNumber}
                          </span>
                          <StatusBadge status={req.status} />
                          <PriorityBadge priority={req.priority} />
                          <span className="text-xs text-[#69776E] capitalize truncate">
                            · {req.category}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-[#1F2421] group-hover:text-[#143628] transition-colors truncate">
                          {req.title}
                        </h4>

                        <div className="flex items-center gap-3 sm:gap-4 text-xs text-[#69776E] flex-wrap">
                          <span className="font-medium text-[#2C3830] truncate">
                            Customer: {req.customerName}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                            <span>{req.preferredDate}</span>
                          </span>
                          {req.preferredTimeSlot && (
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                              <span>{req.preferredTimeSlot}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                            <span className="truncate">{req.serviceAddress.city}</span>
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0EBE3]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {req.status === 'pending' && onQuickApprove ? (
                          <button
                            onClick={() => handleRowApprove(req)}
                            disabled={isBusy}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md transition-colors cursor-pointer"
                          >
                            {isBusy ? 'Approving...' : 'Approve'}
                          </button>
                        ) : req.status === 'approved' && !req.assignedTechnicianId ? (
                          <button
                            onClick={() => handleRowAIDispatch(req)}
                            disabled={isBusy}
                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>{isBusy ? 'Dispatching...' : 'AI Dispatch'}</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-[#143628] bg-[#EAE4D9] px-2 py-0.5 rounded border border-[#D8CFBE]">
                            {req.status === 'pending' ? 'Needs Approval' : 'Ready for Dispatch'}
                          </span>
                        )}
                        <button
                          onClick={() => onSelectRequest(req)}
                          className="p-1.5 text-[#8C9B90] hover:text-[#143628] rounded-md transition-colors cursor-pointer"
                          title="Open Ticket Details"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Scheduled & Active Dispatches (Assigned / Accepted / In Progress) */}
          <div className="bg-white border border-[#E8E2D8] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE3] gap-2">
              <div className="min-w-0">
                <h3 className="font-serif text-lg font-bold text-[#143628] truncate">
                  Scheduled & Active Dispatches
                </h3>
                <p className="text-xs text-[#69776E] mt-0.5 truncate">
                  Confirmed technician assignments and scheduled service appointments
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-[#143628] bg-[#E2EFE7] px-2.5 py-1 rounded-md border border-[#BFDFCD] shrink-0">
                {activeDispatches.length} Active
              </span>
            </div>

            {activeDispatches.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#69776E]">
                No active scheduled dispatches right now. Dispatched jobs will appear here with their assigned technician and appointment time.
              </div>
            ) : (
              <div className="divide-y divide-[#F0EBE3]">
                {activeDispatches.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => onSelectRequest(req)}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] px-2 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-[#143628]">
                          {req.ticketNumber}
                        </span>
                        <StatusBadge status={req.status} />
                        <PriorityBadge priority={req.priority} />
                        <span className="text-xs text-[#69776E] capitalize truncate">
                          · {req.category}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-[#1F2421] group-hover:text-[#143628] transition-colors truncate">
                        {req.title}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-[#69776E] flex-wrap">
                        {req.assignedTechnicianName && (
                          <span className="inline-flex items-center gap-1 text-indigo-800 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{req.assignedTechnicianName}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-mono text-[#143628] font-semibold bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E8E2D8]">
                          <Calendar className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                          <span>{req.preferredDate}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[#143628] font-semibold bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E8E2D8]">
                          <Clock className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                          <span>{req.preferredTimeSlot || '09:00 - 11:00'}</span>
                        </span>
                        <span className="text-[#526056] truncate">
                          Customer: {req.customerName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <ArrowRight className="w-4 h-4 text-[#8C9B90] group-hover:text-[#143628] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Roster & Customers */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E2D8] rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE3] text-xs">
              <h4 className="font-serif font-bold text-base text-[#143628]">Technician Roster</h4>
              <button
                onClick={() => onNavigateTab('technicians')}
                className="text-xs font-semibold text-[#143628] hover:underline"
              >
                Manage
              </button>
            </div>

            {technicians.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#69776E] space-y-2">
                <p>No field technicians registered.</p>
                <button
                  onClick={onOpenCreateTech}
                  className="px-3.5 py-1.5 bg-[#143628] text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  + Add First Tech
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {technicians.slice(0, 5).map((tech) => {
                  const prof =
                    techProfiles.find((p) => p.id === tech.id) || store.getTechnicianProfile(tech.id);
                  return (
                    <div key={tech.id} className="flex items-center justify-between text-xs gap-2 min-w-0">
                      <div className="truncate min-w-0 flex-1">
                        <div className="font-semibold text-[#1F2421] truncate">{tech.fullName}</div>
                        <div className="text-[11px] text-[#69776E] truncate">
                          {prof?.specialty || 'General Field Tech'}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize shrink-0 font-medium ${
                          prof?.status === 'available'
                            ? 'bg-[#E2EFE7] text-[#1B4332] border border-[#BFDFCD]'
                            : prof?.status === 'on_job'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {prof?.status?.replace('_', ' ') || 'available'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer Base Info */}
          <div className="bg-[#F5F2EB] border border-[#E8E2D8] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2DBD0] text-xs">
              <span className="font-serif font-bold text-sm text-[#143628]">Customer Base</span>
              <button
                onClick={() => onNavigateTab('customers')}
                className="text-xs font-semibold text-[#143628] hover:underline"
              >
                View ({customers.length})
              </button>
            </div>
            <div className="text-xs text-[#526056] leading-relaxed">
              {customers.length === 0
                ? 'No registered customers yet.'
                : `${customers.length} customer account(s) registered with ${requests.length} total work orders tracked.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

