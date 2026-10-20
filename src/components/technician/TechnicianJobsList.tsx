import React, { useState } from 'react';
import { ServiceRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { EmptyState } from '../common/EmptyState';
import { Search, Wrench, Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';

interface TechnicianJobsListProps {
  requests: ServiceRequest[];
  onSelectRequest: (request: ServiceRequest) => void;
  defaultFilter?: 'assigned' | 'active' | 'completed' | 'all';
}

export const TechnicianJobsList: React.FC<TechnicianJobsListProps> = ({
  requests,
  onSelectRequest,
  defaultFilter = 'all',
}) => {
  const [filter, setFilter] = useState<'all' | 'assigned' | 'active' | 'completed'>(defaultFilter);
  const [search, setSearch] = useState('');

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.serviceAddress.city.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'assigned') return r.status === 'assigned';
    if (filter === 'active') return ['accepted', 'in_progress'].includes(r.status);
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-4 w-full max-w-full font-sans">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-[#E8E2D8] shadow-2xs">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[#8C9B90] absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket #, customer, address..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg focus:outline-none focus:border-[#143628] focus:bg-white min-w-0"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 max-w-full min-w-0">
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'assigned', label: 'Needs Acceptance' },
            { id: 'active', label: 'Active Dispatches' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
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

      {/* Table / List */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={search || filter !== 'all' ? 'No matching technician jobs' : 'Queue is empty'}
          description={
            search || filter !== 'all'
              ? 'Try modifying your search filter.'
              : 'You have no assigned jobs in the queue. New work orders assigned by Operations Management will appear here.'
          }
        />
      ) : (
        <div className="divide-y divide-[#F0EBE3] bg-white border border-[#E8E2D8] rounded-xl overflow-hidden shadow-2xs">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              onClick={() => onSelectRequest(req)}
              className="p-4 sm:p-5 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-[#143628]">
                    {req.ticketNumber}
                  </span>
                  <span className="text-[#C2DDD0]">·</span>
                  <StatusBadge status={req.status} />
                  <PriorityBadge priority={req.priority} />
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-[#1F2421] group-hover:text-[#143628] transition-colors truncate">
                  {req.title}
                </h3>

                <div className="flex items-center gap-3 sm:gap-4 text-xs text-[#69776E] flex-wrap">
                  <span className="font-medium text-[#2C3830]">
                    Customer: {req.customerName}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[#143628] font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                    <span>{req.preferredDate}</span>
                  </span>
                  {req.preferredTimeSlot && (
                    <span className="flex items-center gap-1 font-mono text-[#143628] font-semibold">
                      <Clock className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                      <span>{req.preferredTimeSlot}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1 truncate max-w-xs">
                    <MapPin className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                    <span className="truncate">{req.serviceAddress.street}, {req.serviceAddress.city}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0EBE3] shrink-0">
                <div className="text-left sm:text-right text-xs truncate max-w-[150px]">
                  <div className="text-[#69776E] text-[11px]">Specialty</div>
                  <div className="font-semibold text-[#143628] capitalize truncate">
                    {req.category}
                  </div>
                </div>
                <div className="p-1 sm:p-2 text-[#8C9B90] group-hover:text-[#143628] group-hover:translate-x-0.5 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
