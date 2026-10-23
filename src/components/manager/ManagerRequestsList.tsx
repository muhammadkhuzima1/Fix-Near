import React, { useState } from 'react';
import { ServiceRequest } from '../../types';
import { SupabaseService } from '../../services/supabaseService';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge, isUrgentPriority } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { formatPrice } from '../../utils/currency';
import {
  Search,
  Calendar,
  MapPin,
  Wrench,
  Sparkles,
  Loader2,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

interface ManagerRequestsListProps {
  requests: ServiceRequest[];
  onSelectRequest: (req: ServiceRequest) => void;
  onQuickApprove?: (req: ServiceRequest, e: React.MouseEvent) => void;
  onQuickAIDispatch?: (req: ServiceRequest, e: React.MouseEvent) => void;
  dispatchingId?: string | null;
}

export const ManagerRequestsList: React.FC<ManagerRequestsListProps> = ({
  requests,
  onSelectRequest,
  onQuickApprove,
  onQuickAIDispatch,
  dispatchingId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const priorityRank: Record<string, number> = {
    emergency: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filtered = requests
    .filter((req) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (req.title || '').toLowerCase().includes(q) ||
        (req.ticketNumber || '').toLowerCase().includes(q) ||
        (req.customerName || '').toLowerCase().includes(q) ||
        (req.assignedTechnicianName &&
          req.assignedTechnicianName.toLowerCase().includes(q)) ||
        (req.serviceAddress?.city || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesPriority =
        priorityFilter === 'all'
          ? true
          : priorityFilter === 'urgent'
          ? isUrgentPriority(req.priority)
          : priorityFilter === 'normal'
          ? !isUrgentPriority(req.priority)
          : req.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    })
    .sort((a, b) => {
      // Prioritize urgent pending/approved requests first
      const aActiveQueue = a.status === 'pending' || a.status === 'approved' ? 1 : 0;
      const bActiveQueue = b.status === 'pending' || b.status === 'approved' ? 1 : 0;
      if (aActiveQueue && bActiveQueue) {
        const diff = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
        if (diff !== 0) return diff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 border border-[#E6E1D6] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket, customer, technician, or city..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#143628]"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs font-medium text-[#18181B]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs font-medium text-[#18181B]"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent Only</option>
            <option value="normal">Normal Only</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs font-medium text-[#18181B]"
          >
            <option value="all">All Categories</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="hvac">HVAC</option>
            <option value="appliance">Appliance</option>
            <option value="carpentry">Carpentry</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E6E1D6] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-[#18181B]">No service requests found</h3>
            <p className="text-xs text-[#5C5852] mt-1">
              No records match the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E6E1D6] text-[11px] font-bold uppercase tracking-wider text-[#5C5852]">
                  <th className="py-3 px-4">Ticket & Issue</th>
                  <th className="py-3 px-4">Customer & Location</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Technician & Schedule</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E1D6] text-xs">
                {filtered.map((req) => {
                  const payment = SupabaseService.computePaymentSummary(req);
                  const paymentStatusLabel =
                    payment.status === 'paid'
                      ? 'Paid'
                      : payment.status === 'partially_paid'
                      ? 'Partial'
                      : 'Unpaid';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center shrink-0 mt-0.5">
                            <CategoryIcon
                              category={req.category}
                              className="w-4 h-4 text-[#143628]"
                            />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-[#143628]">
                              {req.ticketNumber}
                            </span>
                            <p className="font-semibold text-[#18181B] line-clamp-1 mt-0.5">
                              {req.title}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#18181B]">{req.customerName}</p>
                        <p className="text-[#5C5852] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {req.serviceAddress.city}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={req.priority} size="sm" />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <StatusBadge status={req.status} size="sm" />
                          {req.rescheduleRequest?.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <RefreshCw className="w-2.5 h-2.5" />
                              Reschedule Pending
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {req.assignedTechnicianName ? (
                          <div>
                            <span className="font-semibold text-[#18181B] block">
                              {req.assignedTechnicianName}
                            </span>
                            <span className="text-[11px] text-[#5C5852] flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-[#143628]" />
                              {req.preferredDate} · {req.preferredTimeSlot}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-amber-700 font-semibold block">Unassigned</span>
                            <span className="text-[11px] text-[#5C5852]">
                              Pref: {req.preferredDate} · {req.preferredTimeSlot}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#18181B] block">
                          {formatPrice(payment.totalAmount)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                            payment.status === 'paid'
                              ? 'text-emerald-700'
                              : payment.status === 'partially_paid'
                              ? 'text-amber-700'
                              : 'text-gray-500'
                          }`}
                        >
                          <CreditCard className="w-3 h-3" />
                          {paymentStatusLabel}
                          {payment.method !== 'unrecorded' ? ` (${payment.method})` : ''}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          {req.status === 'pending' && onQuickApprove && (
                            <button
                              onClick={(e) => onQuickApprove(req, e)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Approve
                            </button>
                          )}

                          {(req.status === 'pending' || req.status === 'approved') &&
                            !req.assignedTechnicianId &&
                            onQuickAIDispatch && (
                              <button
                                onClick={(e) => onQuickAIDispatch(req, e)}
                                disabled={dispatchingId === req.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white cursor-pointer"
                              >
                                {dispatchingId === req.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                )}
                                AI Dispatch
                              </button>
                            )}

                          <button
                            onClick={() => onSelectRequest(req)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#143628] hover:bg-[#143628]/10"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
