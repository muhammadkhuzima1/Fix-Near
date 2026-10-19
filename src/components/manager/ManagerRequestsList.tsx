import React, { useState } from 'react';
import { ServiceRequest, ServiceStatus, PriorityLevel } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { EmptyState } from '../common/EmptyState';
import { Search, Wrench, Calendar, MapPin, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';

interface ManagerRequestsListProps {
  requests: ServiceRequest[];
  onSelectRequest: (request: ServiceRequest) => void;
  onQuickApprove?: (request: ServiceRequest) => void;
  onQuickAssign?: (request: ServiceRequest) => void;
  defaultFilter?: ServiceStatus | 'all';
}

export const ManagerRequestsList: React.FC<ManagerRequestsListProps> = ({
  requests,
  onSelectRequest,
  onQuickApprove,
  onQuickAssign,
  defaultFilter = 'all',
}) => {
  const [filter, setFilter] = useState<string>(defaultFilter);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (r.assignedTechnicianName && r.assignedTechnicianName.toLowerCase().includes(search.toLowerCase())) ||
      r.serviceAddress.city.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter !== 'all') {
      if (filter === 'active') {
        if (!['approved', 'assigned', 'accepted', 'in_progress'].includes(r.status)) return false;
      } else if (r.status !== filter) {
        return false;
      }
    }

    if (priorityFilter !== 'all' && r.priority !== priorityFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-3 sm:space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Controls & Search */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-2.5 sm:space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, customer, tech..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white min-w-0"
            />
          </div>

          {/* Priority dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Priority:
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-900 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="emergency">Emergency Only</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 border-t border-slate-100 max-w-full min-w-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'assigned', label: 'Assigned' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                filter === tab.id
                  ? 'bg-[#143628] text-[#FDFBF7] font-semibold shadow-xs'
                  : 'text-[#526056] hover:text-[#143628] hover:bg-[#F5F2EB]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table / Cards */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={search || filter !== 'all' ? 'No matching tickets found' : 'Dispatch queue is empty'}
          description={
            search || filter !== 'all'
              ? 'Try relaxing your filter parameters or search query.'
              : 'No service requests exist in the system yet. When customers submit tickets, they will appear here in Pending status.'
          }
        />
      ) : (
        <div className="divide-y divide-[#F0EBE3] bg-white border border-[#E8E2D8] rounded-xl overflow-hidden shadow-2xs">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              onClick={() => onSelectRequest(req)}
              className="p-3.5 sm:p-5 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3 group"
            >
              <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-[#143628]">
                    {req.ticketNumber}
                  </span>
                  <span className="text-[#C2DDD0]">·</span>
                  <StatusBadge status={req.status} />
                  <PriorityBadge priority={req.priority} />
                  <span className="text-xs text-[#69776E] capitalize truncate">· {req.category}</span>
                </div>

                <h3 className="text-xs sm:text-base font-semibold text-[#1F2421] group-hover:text-[#143628] transition-colors truncate">
                  {req.title}
                </h3>

                <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 flex-wrap">
                  <span className="font-medium text-slate-700 truncate">
                    Customer: {req.customerName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{req.preferredDate}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate max-w-xs">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {req.serviceAddress.city}, {req.serviceAddress.state}
                    </span>
                  </span>
                  {req.assignedTechnicianName && (
                    <span className="text-indigo-600 font-medium truncate">
                      Tech: {req.assignedTechnicianName}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {req.status === 'pending' && onQuickApprove && (
                  <button
                    onClick={() => onQuickApprove(req)}
                    className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer"
                  >
                    Approve
                  </button>
                )}

                {req.status === 'assigned' && req.assignedTechnicianName && (
                  <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 truncate max-w-[140px]">
                    {req.assignedTechnicianName}
                  </span>
                )}

                <button
                  onClick={() => onSelectRequest(req)}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Review</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
