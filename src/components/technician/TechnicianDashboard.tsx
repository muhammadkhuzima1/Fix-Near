import React, { useState, useEffect } from 'react';
import { User, ServiceRequest, TechnicianProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge, isUrgentPriority } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { TechnicianJobDetailModal } from './TechnicianJobDetailModal';
import {
  formatPrice,
  formatHourlyRate,
  WORKING_HOURS_LABEL,
} from '../../utils/currency';
import {
  Wrench,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  Star,
  Phone,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

interface TechnicianDashboardProps {
  currentUser?: User;
  requests: ServiceRequest[];
  activeTab?: string;
  onRefresh?: () => void;
  onSelectRequest?: (req: ServiceRequest) => void;
  onNavigateTab?: (tab: string) => void;
}

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({
  currentUser: propUser,
  requests,
  activeTab = 'dashboard',
  onRefresh,
  onSelectRequest,
}) => {
  const { currentUser: authUser } = useAuth();
  const currentUser = propUser || authUser;

  const [selectedJob, setSelectedJob] = useState<ServiceRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [techProfile, setTechProfile] = useState<TechnicianProfile | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;
    SupabaseService.getTechnicianProfile(currentUser.id).then((prof) => {
      if (isMounted) setTechProfile(prof);
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, requests]);

  // Sort urgent jobs ahead of normal jobs for the technician
  const myJobs = (
    currentUser
      ? requests.filter((r) => r.assignedTechnicianId === currentUser.id)
      : requests
  ).sort((a, b) => {
    const aUrgent = isUrgentPriority(a.priority) ? 1 : 0;
    const bUrgent = isUrgentPriority(b.priority) ? 1 : 0;
    if (bUrgent !== aUrgent) return bUrgent - aUrgent;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const newDispatchedJobs = myJobs.filter((r) => r.status === 'assigned');
  const activeJobs = myJobs.filter((r) =>
    ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );
  const completedJobs = myJobs.filter((r) => r.status === 'completed');

  const handleDutyStatusChange = async (newStatus: 'available' | 'on_job' | 'off_duty') => {
    if (!currentUser) return;
    await SupabaseService.updateTechnicianStatus(currentUser.id, newStatus);
    if (techProfile) {
      setTechProfile({ ...techProfile, status: newStatus });
    }
    onRefresh?.();
  };

  const filteredJobs = myJobs.filter((job) => {
    if (activeTab === 'completed') return job.status === 'completed';
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') {
      return ['assigned', 'accepted', 'in_progress'].includes(job.status);
    }
    return job.status === statusFilter;
  });

  const activeSelectedJob = selectedJob
    ? requests.find((r) => r.id === selectedJob.id) || null
    : null;

  const handleJobClick = (job: ServiceRequest) => {
    if (onSelectRequest) {
      onSelectRequest(job);
    } else {
      setSelectedJob(job);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#143628] rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Technician Portal · {WORKING_HOURS_LABEL}
          </span>
          <h1 className="text-2xl font-bold mt-1">{currentUser?.fullName || 'Technician'}</h1>
          <p className="text-xs text-[#E6E1D6]/85 mt-1">
            {techProfile?.specialty || 'Field Specialist'} · Rate:{' '}
            {formatHourlyRate(techProfile?.hourlyRate || 2000)}
          </p>
        </div>

        {/* Duty Status Switcher */}
        <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/15 shrink-0">
          {(['available', 'on_job', 'off_duty'] as const).map((st) => {
            const active = (techProfile?.status || 'available') === st;
            const label =
              st === 'available' ? 'Available' : st === 'on_job' ? 'On Job' : 'Off Duty';
            return (
              <button
                key={st}
                onClick={() => handleDutyStatusChange(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-[#143628] shadow-sm'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">New Assigned</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{newDispatchedJobs.length}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Active Jobs</span>
            <Wrench className="w-4 h-4 text-[#143628]" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{activeJobs.length}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">{completedJobs.length}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E6E1D6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5852]">Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-2xl font-bold text-[#18181B] mt-1">
            {Number(techProfile?.rating || 5.0).toFixed(1)}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      {activeTab !== 'completed' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-xl border border-[#E6E1D6]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#18181B]">
            Assigned Work Orders ({filteredJobs.length})
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'active', label: 'Active' },
              { id: 'assigned', label: 'New Assigned' },
              { id: 'accepted', label: 'Accepted' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'completed', label: 'Completed' },
              { id: 'all', label: 'All' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#143628] text-white'
                    : 'bg-[#FAF8F5] text-[#5C5852] hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E1D6] p-10 text-center">
          <Wrench className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#18181B]">No assigned jobs</h3>
          <p className="text-xs text-[#5C5852] mt-1">
            New jobs dispatched to you will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.map((job) => {
            const payment = SupabaseService.computePaymentSummary(
              job,
              techProfile?.hourlyRate
            );
            const paymentStatusLabel =
              payment.status === 'paid'
                ? 'Paid'
                : payment.status === 'partially_paid'
                ? 'Partially Paid'
                : 'Unpaid';

            return (
              <div
                key={job.id}
                onClick={() => handleJobClick(job)}
                className="bg-white rounded-xl border border-[#E6E1D6] hover:border-[#143628] p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#143628] bg-[#143628]/10 px-2 py-0.5 rounded">
                        {job.ticketNumber}
                      </span>
                      <StatusBadge status={job.status} size="sm" />
                    </div>
                    <PriorityBadge priority={job.priority} size="sm" />
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] flex items-center justify-center shrink-0 mt-0.5">
                      <CategoryIcon category={job.category} className="w-4 h-4 text-[#143628]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#18181B] line-clamp-1">
                        {job.title}
                      </h3>
                      <p className="text-xs text-[#5C5852] line-clamp-2 mt-0.5">
                        {job.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E6E1D6] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[#5C5852]">
                    <span className="flex items-center gap-1 font-medium text-[#18181B]">
                      <Calendar className="w-3.5 h-3.5 text-[#143628]" />
                      {job.preferredDate} · {job.preferredTimeSlot}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {job.serviceAddress.street}, {job.serviceAddress.city}
                    </span>
                  </div>

                  {job.rescheduleRequest && (
                    <div
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center justify-between ${
                        job.rescheduleRequest.status === 'pending'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : job.rescheduleRequest.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Reschedule ({job.rescheduleRequest.proposedDate})
                      </span>
                      <span className="uppercase font-bold">
                        {job.rescheduleRequest.status === 'pending'
                          ? 'Pending Response'
                          : job.rescheduleRequest.status}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-[#5C5852]">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      {job.customerName} ({job.customerPhone})
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

      {activeSelectedJob && currentUser && (
        <TechnicianJobDetailModal
          request={activeSelectedJob}
          currentUser={currentUser}
          onClose={() => setSelectedJob(null)}
          onUpdated={() => onRefresh?.()}
        />
      )}
    </div>
  );
};
