import React, { useState } from 'react';
import { ServiceRequest, User } from '../../types';
import { SupabaseService } from '../../services/supabaseService';
import { WORKING_TIME_SLOTS, WORKING_HOURS_LABEL } from '../../utils/currency';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  History,
} from 'lucide-react';

interface RescheduleSectionProps {
  request: ServiceRequest;
  currentUser: User;
  onUpdated?: () => void;
}

export const RescheduleSection: React.FC<RescheduleSectionProps> = ({
  request,
  currentUser,
  onUpdated,
}) => {
  const minDateStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];

  const [showForm, setShowForm] = useState(false);
  const [proposedDate, setProposedDate] = useState(request.preferredDate || minDateStr);
  const [proposedTimeSlot, setProposedTimeSlot] = useState<string>(
    WORKING_TIME_SLOTS.includes(request.preferredTimeSlot as any)
      ? request.preferredTimeSlot
      : WORKING_TIME_SLOTS[0]
  );
  const [reason, setReason] = useState('');
  const [responseNote, setResponseNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isClosed = request.status === 'completed' || request.status === 'cancelled';
  const canRequestReschedule =
    !isClosed &&
    ((currentUser.role === 'customer' && request.customerId === currentUser.id) ||
      (currentUser.role === 'technician' && request.assignedTechnicianId === currentUser.id) ||
      currentUser.role === 'manager');

  const proposal = request.rescheduleRequest;
  const isPending = proposal?.status === 'pending';

  // Determine if the current user can accept/decline the pending proposal
  const canRespondToPending =
    isPending &&
    !isClosed &&
    ((currentUser.role === 'customer' &&
      request.customerId === currentUser.id &&
      proposal?.requestedByRole !== 'customer') ||
      (currentUser.role === 'technician' &&
        request.assignedTechnicianId === currentUser.id &&
        proposal?.requestedByRole !== 'technician') ||
      (currentUser.role === 'manager' && proposal?.requestedByUserId !== currentUser.id));

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!reason.trim()) {
      setErrorMsg('Please enter a reason for rescheduling.');
      return;
    }
    if (!proposedDate) {
      setErrorMsg('Please select a proposed date.');
      return;
    }

    const slotCheck = SupabaseService.validateWorkingHoursSlot(proposedTimeSlot);
    if (!slotCheck.valid) {
      setErrorMsg(
        slotCheck.error || `Please select a time within ${WORKING_HOURS_LABEL}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await SupabaseService.requestReschedule(
        request.id,
        {
          proposedDate,
          proposedTimeSlot: slotCheck.canonical,
          reason: reason.trim(),
        },
        currentUser
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Could not submit reschedule request.');
      } else {
        setSuccessMsg('Reschedule request sent. Awaiting confirmation.');
        setReason('');
        setShowForm(false);
        onUpdated?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (action: 'accept' | 'decline') => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await SupabaseService.respondToReschedule(
        request.id,
        {
          action,
          responseNote: responseNote.trim() || undefined,
        },
        currentUser
      );

      if (!res.success) {
        setErrorMsg(res.error || `Failed to ${action} reschedule.`);
      } else {
        setSuccessMsg(
          action === 'accept'
            ? 'Appointment updated to the new date and time.'
            : 'Reschedule declined. Original appointment kept.'
        );
        setResponseNote('');
        onUpdated?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: 'pending' | 'accepted' | 'declined') => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="w-3 h-3" />
          Pending Response
        </span>
      );
    }
    if (status === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          Accepted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
        <XCircle className="w-3 h-3" />
        Declined
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-[#E6E1D6] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#143628]" />
            Appointment & Rescheduling
          </h4>
          <p className="text-sm font-semibold text-[#18181B] mt-1">
            Current Schedule: {request.preferredDate} · {request.preferredTimeSlot}
          </p>
        </div>

        {canRequestReschedule && !showForm && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setSuccessMsg('');
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FAF8F5] hover:bg-[#143628] text-[#143628] hover:text-white border border-[#143628]/25 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isPending ? 'Suggest Another Time' : 'Request Reschedule'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active or Latest Reschedule Proposal */}
      {proposal && (
        <div
          className={`p-3.5 rounded-lg border ${
            proposal.status === 'pending'
              ? 'bg-amber-50/70 border-amber-200'
              : proposal.status === 'accepted'
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-gray-50 border-gray-200'
          } space-y-2`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#18181B]">
              Proposed by {proposal.requestedByName} ({proposal.requestedByRole})
            </span>
            {renderStatusBadge(proposal.status)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-white/80 p-2 rounded border border-[#E6E1D6]">
              <span className="text-[#5C5852] block">Proposed New Time</span>
              <span className="font-bold text-[#143628]">
                {proposal.proposedDate} · {proposal.proposedTimeSlot}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded border border-[#E6E1D6]">
              <span className="text-[#5C5852] block">Original Appointment</span>
              <span className="font-medium text-[#18181B]">
                {proposal.previousDate} · {proposal.previousTimeSlot}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#18181B]">
            <span className="font-semibold text-[#5C5852]">Reason:</span> {proposal.reason}
          </p>

          {proposal.respondedByName && (
            <p className="text-[11px] text-[#5C5852]">
              {proposal.status === 'accepted' ? 'Accepted' : 'Declined'} by{' '}
              <span className="font-semibold text-[#18181B]">{proposal.respondedByName}</span>
              {proposal.responseNote ? ` — "${proposal.responseNote}"` : ''}
            </p>
          )}

          {/* Recipient Actions when Pending */}
          {canRespondToPending && (
            <div className="pt-2 border-t border-amber-200/80 space-y-2">
              <input
                type="text"
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="Optional note..."
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg focus:outline-none focus:border-[#143628]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleRespond('accept')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#143628] hover:bg-[#0f291e] text-white transition-colors disabled:opacity-50"
                >
                  Accept New Time
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowForm(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#FAF8F5] text-[#143628] border border-[#143628]/30 transition-colors"
                >
                  Suggest Another Date & Time
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleRespond('decline')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-200 transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request / Counter-Propose Form */}
      {showForm && (
        <form
          onSubmit={handleRequestSubmit}
          className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#18181B]">
              {isPending ? 'Propose Alternative Date & Time' : 'Request Appointment Reschedule'}
            </span>
            <span className="text-[11px] font-medium text-[#143628]">{WORKING_HOURS_LABEL}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                Proposed Date *
              </label>
              <input
                type="date"
                min={minDateStr}
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg focus:outline-none focus:border-[#143628]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                Proposed Time Slot *
              </label>
              <select
                value={proposedTimeSlot}
                onChange={(e) => setProposedTimeSlot(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg focus:outline-none focus:border-[#143628]"
              >
                {WORKING_TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
              Reason for Rescheduling *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly state why a new time is needed"
              required
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg focus:outline-none focus:border-[#143628]"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#5C5852] hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#143628] hover:bg-[#0f291e] text-white disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Send Reschedule Request'}
            </button>
          </div>
        </form>
      )}

      {/* Previous Reschedule History */}
      {request.rescheduleHistory && request.rescheduleHistory.length > 1 && (
        <div className="pt-2 border-t border-[#E6E1D6]">
          <p className="text-[11px] font-semibold text-[#5C5852] flex items-center gap-1 mb-1.5">
            <History className="w-3 h-3" />
            Reschedule History ({request.rescheduleHistory.length})
          </p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {request.rescheduleHistory.map((item) => (
              <div
                key={item.id}
                className="text-[11px] text-[#5C5852] flex flex-wrap items-center justify-between gap-1 bg-[#FAF8F5] px-2.5 py-1 rounded border border-[#E6E1D6]"
              >
                <span>
                  {item.requestedByName} ({item.requestedByRole}) → {item.proposedDate} ·{' '}
                  {item.proposedTimeSlot}
                </span>
                <span className="font-semibold uppercase">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
