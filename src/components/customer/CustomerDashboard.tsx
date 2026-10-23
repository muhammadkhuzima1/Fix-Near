import React, { useState } from 'react';
import { User, ServiceRequest, ServiceCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { CreateRequestModal } from './CreateRequestModal';
import { CustomerRequestDetail } from './CustomerRequestDetail';
import {
  formatPrice,
  WORKING_HOURS_LABEL,
} from '../../utils/currency';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Wrench,
  Clock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

interface CustomerDashboardProps {
  currentUser?: User;
  requests: ServiceRequest[];
  activeTab?: string;
  onRefresh?: () => void;
  onOpenNewRequest?: () => void;
  onSelectRequest?: (req: ServiceRequest) => void;
  onViewAllRequests?: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  currentUser: propUser,
  requests,
  onRefresh,
  onOpenNewRequest,
  onSelectRequest,
}) => {
  const { currentUser: authUser } = useAuth();
  const currentUser = propUser || authUser;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const myRequests = currentUser
    ? requests.filter((r) => r.customerId === currentUser.id)
    : requests;

  const activeCount = myRequests.filter((r) =>
    ['pending', 'approved', 'assigned', 'accepted', 'in_progress'].includes(r.status)
  ).length;
  const completedCount = myRequests.filter((r) => r.status === 'completed').length;
  const pendingRescheduleCount = myRequests.filter(
    (r) => r.rescheduleRequest?.status === 'pending'
  ).length;

  const filteredRequests = myRequests.filter((req) => {
    const matchesSearch =
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? ['pending', 'approved', 'assigned', 'accepted', 'in_progress'].includes(req.status)
        : req.status === statusFilter;

    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const activeSelectedRequest = selectedRequest
    ? requests.find((r) => r.id === selectedRequest.id) || null
    : null;

  const handleOpenNew = () => {
    if (onOpenNewRequest) {
      onOpenNewRequest();
    } else {
      setShowCreateModal(true);
    }
  };

  const handleClickRequest = (req: ServiceRequest) => {
    if (onSelectRequest) {
      onSelectRequest(req);
    } else {
      setSelectedRequest(req);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#143628] rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Customer Portal · {WORKING_HOURS_LABEL}
          </span>
          <h1 className="text-2xl font-bold mt-1">
            Hello, {currentUser?.fullName || 'Customer'}
          </h1>
          <p className="text-xs text-[#E6E1D6]/85 mt-1">
            Submit repair requests, track technician status, reschedule appointments, and view payments.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-[#143628] hover:bg-[#FAF8F5] font-bold text-sm rounded-xl shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Service Request
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Total Requests</span>
            <ClipboardList className="w-4 h-4 text-[#143628]" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{myRequests.length}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Active Requests</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{activeCount}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{completedCount}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Reschedule Alerts</span>
            <RefreshCw className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{pendingRescheduleCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-[#E6E1D6] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticket number or title..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#143628]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs font-medium text-[#18181B]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-xs font-medium text-[#18181B]"
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

      {/* Service Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E1D6] p-10 text-center">
          <Wrench className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#18181B]">No service requests found</h3>
          <p className="text-xs text-[#5C5852] mt-1 mb-4">
            {myRequests.length === 0
              ? 'You have not submitted any service requests yet.'
              : 'No requests match your current filters.'}
          </p>
          {myRequests.length === 0 && (
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#143628] text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Request
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => {
            const payment = SupabaseService.computePaymentSummary(req);
            const paymentStatusLabel =
              payment.status === 'paid'
                ? 'Paid'
                : payment.status === 'partially_paid'
                ? 'Partially Paid'
                : 'Unpaid';

            return (
              <div
                key={req.id}
                onClick={() => handleClickRequest(req)}
                className="bg-white rounded-xl border border-[#E6E1D6] hover:border-[#143628] p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#143628] bg-[#143628]/10 px-2 py-0.5 rounded">
                        {req.ticketNumber}
                      </span>
                      <StatusBadge status={req.status} size="sm" />
                    </div>
                    <PriorityBadge priority={req.priority} size="sm" />
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center shrink-0 mt-0.5">
                      <CategoryIcon
                        category={req.category as ServiceCategory}
                        className="w-4 h-4 text-[#143628]"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#18181B] line-clamp-1">
                        {req.title}
                      </h3>
                      <p className="text-xs text-[#5C5852] line-clamp-2 mt-0.5">
                        {req.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E6E1D6] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[#5C5852]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#143628]" />
                      {req.preferredDate} · {req.preferredTimeSlot}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {req.serviceAddress.city}
                    </span>
                  </div>

                  {req.rescheduleRequest && (
                    <div
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center justify-between ${
                        req.rescheduleRequest.status === 'pending'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : req.rescheduleRequest.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}
                    >
                      <span>
                        Reschedule ({req.rescheduleRequest.proposedDate}):
                      </span>
                      <span className="uppercase font-bold">
                        {req.rescheduleRequest.status === 'pending'
                          ? 'Pending Response'
                          : req.rescheduleRequest.status}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[#5C5852]">
                      Tech:{' '}
                      <strong className="text-[#18181B]">
                        {req.assignedTechnicianName || 'Pending Assignment'}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-[#143628]">
                      <CreditCard className="w-3.5 h-3.5" />
                      {formatPrice(payment.totalAmount)} ({paymentStatusLabel})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && currentUser && (
        <CreateRequestModal
          customerId={currentUser.id}
          customerPhone={currentUser.phone}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => onRefresh?.()}
        />
      )}

      {activeSelectedRequest && currentUser && (
        <CustomerRequestDetail
          request={activeSelectedRequest}
          currentUser={currentUser}
          onClose={() => setSelectedRequest(null)}
          onUpdated={() => onRefresh?.()}
        />
      )}
    </div>
  );
};
