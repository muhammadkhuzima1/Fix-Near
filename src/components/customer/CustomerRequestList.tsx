import React, { useState } from 'react';
import { ServiceRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { EmptyState } from '../common/EmptyState';
import { Search, Wrench, Calendar, MapPin, ArrowRight } from 'lucide-react';

interface CustomerRequestListProps {
  requests: ServiceRequest[];
  onSelectRequest: (request: ServiceRequest) => void;
  onOpenNewRequest: () => void;
}

export const CustomerRequestList: React.FC<CustomerRequestListProps> = ({
  requests,
  onSelectRequest,
  onOpenNewRequest,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed' | 'cancelled'>('all');

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'completed') return r.status === 'completed';
    if (filter === 'cancelled') return r.status === 'cancelled';
    if (filter === 'active') {
      return ['approved', 'assigned', 'accepted', 'in_progress'].includes(r.status);
    }
    return true;
  });

  return (
    <div className="space-y-4 w-full max-w-full font-sans">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-[#E8E2D8] shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[#8C9B90] absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket # or title..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-[#FAF8F5] border border-[#DDD5C7] rounded-lg focus:outline-none focus:border-[#143628] focus:bg-white transition-all min-w-0"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 max-w-full min-w-0">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending' },
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
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

      {/* List / Table */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={search || filter !== 'all' ? 'No matching requests' : 'No service requests yet'}
          description={
            search || filter !== 'all'
              ? 'Try modifying your search query or switching active filter categories.'
              : 'You have not submitted any service requests yet. When you need repairs, book a technician in just a few clicks.'
          }
          actionLabel="+ Request Service"
          onAction={onOpenNewRequest}
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
                  <span className="capitalize font-medium text-[#143628]">
                    {req.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                    <span>{req.preferredDate}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate max-w-xs">
                    <MapPin className="w-3.5 h-3.5 text-[#8C9B90] shrink-0" />
                    <span className="truncate">{req.serviceAddress.city}, {req.serviceAddress.state}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F0EBE3] shrink-0">
                {req.assignedTechnicianName && (
                  <div className="text-left sm:text-right text-xs truncate max-w-[150px]">
                    <div className="text-[#69776E] text-[11px]">Technician</div>
                    <div className="font-medium text-[#143628] truncate">{req.assignedTechnicianName}</div>
                  </div>
                )}
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
