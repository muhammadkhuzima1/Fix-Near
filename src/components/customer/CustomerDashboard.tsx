import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ServiceRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { WorkflowStepper } from '../common/WorkflowStepper';
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ArrowRight,
  Shield,
  HelpCircle,
  Zap,
  Flame,
  Refrigerator,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

interface CustomerDashboardProps {
  requests: ServiceRequest[];
  onOpenNewRequest: () => void;
  onSelectRequest: (request: ServiceRequest) => void;
  onViewAllRequests: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  requests,
  onOpenNewRequest,
  onSelectRequest,
  onViewAllRequests,
}) => {
  const { currentUser } = useAuth();

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const inProgressCount = requests.filter((r) =>
    ['assigned', 'accepted', 'in_progress'].includes(r.status)
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const totalCount = requests.length;

  const recentRequests = requests.slice(0, 5);

  // Find the most recent active/in-progress request to show live workflow tracking
  const activeRequest = requests.find((r) =>
    ['pending', 'approved', 'assigned', 'accepted', 'in_progress'].includes(r.status)
  );

  return (
    <div className="space-y-6 w-full max-w-full font-sans">
      {/* 1. Welcome Header Hero Banner */}
      <div className="bg-[#143628] text-[#FDFBF7] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm border border-[#1B4332]">
        <div className="space-y-2 max-w-xl min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-[#A3C9B6]">
            <span>Verified Customer Account</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF8F5] truncate">
            Welcome, {currentUser?.fullName || 'Valued Customer'}
          </h2>
          <p className="text-xs sm:text-sm text-[#C8DCD1] leading-relaxed">
            Submit service requests in plain text, track your assigned field technician,
            and monitor repair completion with transparent PKR hourly billing.
          </p>
        </div>

        <button
          onClick={onOpenNewRequest}
          className="w-full sm:w-auto px-6 py-3.5 bg-[#FAF8F5] hover:bg-white text-[#143628] font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer hover:shadow-lg"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Request a Service</span>
        </button>
      </div>

      {/* 2. Overview Counts Grid (Accurate real Supabase data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1.5 shadow-2xs">
          <div className="text-xs text-[#526056] font-medium flex items-center justify-between">
            <span className="truncate">Total Requests</span>
            <Wrench className="w-4 h-4 text-[#8C9B90] shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#143628] tabular-nums">
            {totalCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Lifetime repair orders</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1.5 shadow-2xs">
          <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
            <span className="truncate">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#143628] tabular-nums">
            {pendingCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Awaiting manager dispatch</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1.5 shadow-2xs">
          <div className="text-xs text-[#1B4332] font-medium flex items-center justify-between">
            <span className="truncate">In-Progress</span>
            <AlertCircle className="w-4 h-4 text-[#2D6A4F] shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#143628] tabular-nums">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Dispatched or active on-site</div>
        </div>

        <div className="p-5 bg-white border border-[#E8E2D8] rounded-xl space-y-1.5 shadow-2xs">
          <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span className="truncate">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#143628] tabular-nums">
            {completedCount}
          </div>
          <div className="text-[11px] text-[#69776E] truncate">Successfully resolved jobs</div>
        </div>
      </div>

      {/* 3. Live Request Progress Tracker (if an active order exists) */}
      {activeRequest && (
        <div className="bg-white border border-[#E8E2D8] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F0EBE3]">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-[#143628]">
                Active Work Order Tracker
              </div>
              <h3 className="font-serif text-lg font-bold text-[#143628] mt-0.5 truncate">
                {activeRequest.ticketNumber}: {activeRequest.title}
              </h3>
            </div>
            <button
              onClick={() => onSelectRequest(activeRequest)}
              className="px-3.5 py-1.5 bg-[#F5F2EB] hover:bg-[#EAE4D9] text-[#143628] text-xs font-medium rounded-lg border border-[#DDD5C7] transition-colors self-start sm:self-auto cursor-pointer"
            >
              View Order Details →
            </button>
          </div>

          <div className="py-2">
            <WorkflowStepper status={activeRequest.status} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F0EBE3] text-xs text-[#526056]">
            <div>
              <span className="font-medium text-[#2C3830]">Scheduled Date:</span>{' '}
              <span className="font-mono">{activeRequest.preferredDate}</span> ({activeRequest.preferredTimeSlot || 'Flexible'})
            </div>
            {activeRequest.assignedTechnicianName && (
              <div>
                <span className="font-medium text-[#2C3830]">Assigned Tech:</span>{' '}
                <span className="font-semibold text-[#143628]">{activeRequest.assignedTechnicianName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Recent Service Requests Table & Action List */}
      <div className="bg-white border border-[#E8E2D8] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE3] gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#143628]">
              Recent Service Requests
            </h3>
            <p className="text-xs text-[#69776E] mt-0.5">
              Review your filed tickets, assigned technicians, and status progression
            </p>
          </div>

          {requests.length > 0 && (
            <button
              onClick={onViewAllRequests}
              className="text-xs font-semibold text-[#143628] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>View All ({requests.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentRequests.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F5F2EB] text-[#143628] flex items-center justify-center mx-auto">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="font-serif text-base font-bold text-[#143628]">
              No Service Requests Yet
            </div>
            <p className="text-xs text-[#69776E] max-w-sm mx-auto leading-relaxed">
              When something in your home needs repair, submit a ticket in plain text and our AI assistant will analyze the requirements.
            </p>
            <button
              onClick={onOpenNewRequest}
              className="px-5 py-2.5 bg-[#143628] text-[#FDFBF7] rounded-lg text-xs font-medium hover:bg-[#1B4332] transition-colors cursor-pointer shadow-xs"
            >
              + Submit First Request
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EBE3]">
            {recentRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] px-2 rounded-lg transition-colors cursor-pointer group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-[#143628]">
                      {req.ticketNumber}
                    </span>
                    <StatusBadge status={req.status} />
                    <PriorityBadge priority={req.priority} />
                    <span className="text-xs font-medium text-[#69776E]">
                      · Category: {req.category}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#1F2421] group-hover:text-[#143628] transition-colors truncate">
                    {req.title}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#69776E] flex-wrap">
                    <span>Date: {req.preferredDate}</span>
                    {req.assignedTechnicianName && (
                      <span className="flex items-center gap-1 font-medium text-[#143628]">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Tech: {req.assignedTechnicianName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-[#143628] group-hover:underline">
                    View Details
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#8C9B90] group-hover:text-[#143628] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Supported Categories Banner & Compact Help Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories Quick Glance */}
        <div className="lg:col-span-2 bg-white border border-[#E8E2D8] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-base font-bold text-[#143628]">
              Standard Hourly Rates (PKR)
            </h4>
            <span className="text-xs text-[#69776E] font-medium">Transparent Pricing</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E2D8] space-y-1">
              <div className="flex items-center gap-1.5 text-[#143628] font-semibold">
                <Wrench className="w-3.5 h-3.5" />
                <span>Plumbing</span>
              </div>
              <div className="font-mono text-[#143628] font-bold">PKR 2,000/hr</div>
            </div>

            <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E2D8] space-y-1">
              <div className="flex items-center gap-1.5 text-[#143628] font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Electrical</span>
              </div>
              <div className="font-mono text-[#143628] font-bold">PKR 2,200/hr</div>
            </div>

            <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E2D8] space-y-1">
              <div className="flex items-center gap-1.5 text-[#143628] font-semibold">
                <Flame className="w-3.5 h-3.5" />
                <span>AC / HVAC</span>
              </div>
              <div className="font-mono text-[#143628] font-bold">PKR 2,500/hr</div>
            </div>

            <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E2D8] space-y-1">
              <div className="flex items-center gap-1.5 text-[#143628] font-semibold">
                <Refrigerator className="w-3.5 h-3.5" />
                <span>Appliance</span>
              </div>
              <div className="font-mono text-[#143628] font-bold">PKR 2,000/hr</div>
            </div>
          </div>
        </div>

        {/* Compact Help Section */}
        <div className="bg-[#F5F2EB] border border-[#E8E2D8] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#143628] font-serif font-bold text-base">
            <HelpCircle className="w-4 h-4 text-[#143628]" />
            <span>Need Help?</span>
          </div>
          <p className="text-xs text-[#526056] leading-relaxed">
            When creating a new request, describe the symptom (e.g. "water leaking from underneath water heater"). Our system automatically extracts priority and required tools.
          </p>
          <div className="pt-2 border-t border-[#E2DBD0] text-xs text-[#143628] font-medium flex items-center justify-between">
            <span>Official Billing:</span>
            <span className="font-mono font-bold">PKR Standard</span>
          </div>
        </div>
      </div>
    </div>
  );
};
