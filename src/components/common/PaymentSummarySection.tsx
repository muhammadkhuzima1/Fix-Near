import React, { useState, useEffect } from 'react';
import { ServiceRequest, User, PaymentMethod } from '../../types';
import { SupabaseService } from '../../services/supabaseService';
import { formatPrice } from '../../utils/currency';
import { CreditCard, CheckCircle2, AlertCircle, Edit3, ShieldCheck } from 'lucide-react';

interface PaymentSummarySectionProps {
  request: ServiceRequest;
  currentUser: User;
  hourlyRate?: number;
  onUpdated?: () => void;
}

export const PaymentSummarySection: React.FC<PaymentSummarySectionProps> = ({
  request,
  currentUser,
  hourlyRate,
  onUpdated,
}) => {
  const summary = SupabaseService.computePaymentSummary(request, hourlyRate);

  const [isEditing, setIsEditing] = useState(false);
  const [totalAmount, setTotalAmount] = useState<string>(String(summary.totalAmount));
  const [amountPaid, setAmountPaid] = useState<string>(String(summary.amountPaid));
  const [method, setMethod] = useState<PaymentMethod>(
    summary.method === 'online' ? 'online' : 'cash'
  );
  const [transactionReference, setTransactionReference] = useState<string>(
    summary.transactionReference || ''
  );
  const [verifiedOnline, setVerifiedOnline] = useState<boolean>(
    summary.method === 'online' && summary.amountPaid > 0
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const latest = SupabaseService.computePaymentSummary(request, hourlyRate);
    setTotalAmount(String(latest.totalAmount));
    setAmountPaid(String(latest.amountPaid));
    setMethod(latest.method === 'online' ? 'online' : 'cash');
    setTransactionReference(latest.transactionReference || '');
    setVerifiedOnline(latest.method === 'online' && latest.amountPaid > 0);
  }, [request, hourlyRate]);

  // Role permission: Manager can record/update across requests; Assigned Technician can record for their assigned job
  const canRecordPayment =
    currentUser.role === 'manager' ||
    (currentUser.role === 'technician' && request.assignedTechnicianId === currentUser.id);

  const statusBadge = () => {
    if (summary.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          Paid
        </span>
      );
    }
    if (summary.status === 'partially_paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          Partially Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-800 border border-gray-300">
        Unpaid
      </span>
    );
  };

  const methodLabel =
    summary.method === 'cash'
      ? 'Cash'
      : summary.method === 'online'
      ? 'Online'
      : 'Not Recorded';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const parsedTotal = Math.round(Number(totalAmount));
    const parsedPaid = Math.round(Number(amountPaid));

    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setErrorMsg('Enter a valid total amount.');
      return;
    }
    if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
      setErrorMsg('Enter a valid paid amount.');
      return;
    }
    if (parsedPaid > parsedTotal) {
      setErrorMsg('Paid amount cannot exceed total.');
      return;
    }

    if (method === 'online' && parsedPaid > 0) {
      if (!transactionReference.trim()) {
        setErrorMsg('Transaction reference required.');
        return;
      }
      if (!verifiedOnline) {
        setErrorMsg('Confirm online payment verification.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await SupabaseService.updatePaymentRecord(
        request.id,
        {
          totalAmount: parsedTotal,
          amountPaid: parsedPaid,
          method: parsedPaid > 0 ? method : 'unrecorded',
          transactionReference:
            method === 'online' && parsedPaid > 0 ? transactionReference.trim() : undefined,
          verifiedOnline: method === 'online' ? verifiedOnline : undefined,
        },
        currentUser
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Could not save payment.');
      } else {
        setSuccessMsg('Payment saved.');
        setIsEditing(false);
        onUpdated?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-3.5 border border-[#E6E1D6] space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-[#143628]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C5852]">
            Payment
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge()}
          {canRecordPayment && !isEditing && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FAF8F5] hover:bg-[#143628] text-[#143628] hover:text-white border border-[#143628]/25 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]">
          <span className="text-[11px] text-[#5C5852] block">Total</span>
          <span className="text-sm font-bold text-[#18181B]">
            {formatPrice(summary.totalAmount)}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]">
          <span className="text-[11px] text-[#5C5852] block">Paid</span>
          <span className="text-sm font-bold text-emerald-700">
            {formatPrice(summary.amountPaid)}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]">
          <span className="text-[11px] text-[#5C5852] block">Balance</span>
          <span className="text-sm font-bold text-[#18181B]">
            {formatPrice(summary.remainingBalance)}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6]">
          <span className="text-[11px] text-[#5C5852] block">Method</span>
          <span className="text-sm font-bold text-[#143628]">{methodLabel}</span>
        </div>
      </div>

      {summary.transactionReference && (
        <div className="text-xs text-[#5C5852] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            Ref: <strong className="text-[#18181B]">{summary.transactionReference}</strong>
            {summary.verifiedByName ? ` · ${summary.verifiedByName}` : ''}
          </span>
        </div>
      )}

      {!summary.transactionReference && summary.verifiedByName && summary.amountPaid > 0 && (
        <div className="text-xs text-[#5C5852]">
          Recorded by <strong className="text-[#18181B]">{summary.verifiedByName}</strong>
        </div>
      )}

      {isEditing && canRecordPayment && (
        <form
          onSubmit={handleSave}
          className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E6E1D6] space-y-2.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                Total (PKR)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={currentUser.role !== 'manager'}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                Paid (PKR) *
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#5C5852] mb-1">
                Method *
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg"
              >
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          {method === 'online' && Number(amountPaid) > 0 && (
            <div className="space-y-2 p-2.5 rounded-lg bg-white border border-[#E6E1D6]">
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Transaction / receipt ID *"
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E6E1D6] rounded-lg"
              />
              <label className="flex items-center gap-2 text-xs text-[#18181B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnline}
                  onChange={(e) => setVerifiedOnline(e.target.checked)}
                  className="rounded border-gray-300 text-[#143628]"
                />
                <span>Online payment verified</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAmountPaid(totalAmount)}
                className="px-2 py-1 rounded text-[11px] font-semibold bg-white border border-[#E6E1D6] text-[#143628] hover:bg-gray-50"
              >
                Full Paid
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid('0')}
                className="px-2 py-1 rounded text-[11px] font-semibold bg-white border border-[#E6E1D6] text-[#5C5852] hover:bg-gray-50"
              >
                Unpaid
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#5C5852] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#143628] hover:bg-[#0f291e] text-white disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
