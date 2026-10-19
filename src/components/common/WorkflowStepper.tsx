import React from 'react';
import { ServiceStatus } from '../../types';
import { Check, Clock, AlertTriangle } from 'lucide-react';

interface WorkflowStepperProps {
  status: ServiceStatus;
  cancellationReason?: string;
  cancelledAt?: string;
}

const STEPS: { key: ServiceStatus; label: string; desc: string }[] = [
  { key: 'pending', label: 'Pending', desc: 'Awaiting manager approval' },
  { key: 'approved', label: 'Approved', desc: 'Approved for dispatch' },
  { key: 'assigned', label: 'Assigned', desc: 'Technician assigned' },
  { key: 'accepted', label: 'Accepted', desc: 'Technician confirmed' },
  { key: 'in_progress', label: 'In Progress', desc: 'Service on-site active' },
  { key: 'completed', label: 'Completed', desc: 'Work done & verified' },
];

const ORDER: Record<ServiceStatus, number> = {
  pending: 0,
  approved: 1,
  assigned: 2,
  accepted: 3,
  in_progress: 4,
  completed: 5,
  cancelled: -1,
};

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  status,
  cancellationReason,
  cancelledAt,
}) => {
  const isCancelled = status === 'cancelled';
  const currentIndex = ORDER[status];

  return (
    <div className="w-full">
      {isCancelled ? (
        <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-rose-900">Request Cancelled</h4>
            <p className="text-xs text-rose-700 mt-0.5">
              {cancellationReason || 'This service request was cancelled.'}
            </p>
            {cancelledAt && (
              <span className="text-[11px] text-rose-500 mt-1.5 block font-mono">
                Cancelled on {new Date(cancelledAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Desktop Stepper */}
          <div className="hidden md:flex items-center justify-between relative">
            {/* Background line */}
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
            
            {/* Active progress line */}
            <div
              className="absolute top-4 left-6 h-0.5 bg-slate-900 transition-all duration-300 -z-0"
              style={{
                width: `${Math.max(0, (currentIndex / (STEPS.length - 1)) * 100)}%`,
              }}
            />

            {STEPS.map((step, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div key={step.key} className="flex flex-col items-center relative z-10 text-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                      isPast
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : isCurrent
                        ? 'bg-white border-slate-900 text-slate-900 ring-4 ring-slate-100 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium whitespace-nowrap ${
                      isCurrent
                        ? 'text-slate-900 font-semibold'
                        : isPast
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 max-w-[90px] leading-tight hidden lg:block">
                    {step.desc}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile compact stepper */}
          <div className="md:hidden flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span className="font-medium text-slate-900">
                Stage {currentIndex + 1} of {STEPS.length}: {STEPS[currentIndex]?.label}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {Math.round(((currentIndex + 1) / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-slate-900 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{STEPS[currentIndex]?.desc}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
