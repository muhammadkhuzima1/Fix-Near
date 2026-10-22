import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseService';
import { store } from '../../services/store';
import { AIService } from '../../services/aiService';
import { ServiceAddress, AIProblemAnalysis, ServiceCategory } from '../../types';
import {
  WORKING_TIME_SLOTS,
  WORKING_HOURS_DISPLAY,
  formatHourlyRate,
  DEFAULT_CATEGORY_RATES,
} from '../../utils/currency';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Sparkles,
  Wrench,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Loader2,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
}

const TIME_SLOTS = WORKING_TIME_SLOTS;

const SUGGESTED_PROBLEMS = [
  'Water heater is leaking from the bottom valve and water is pooling on the basement floor.',
  'Kitchen outlets are sparking and tripping the breaker whenever the microwave turns on.',
  'AC unit stopped cooling completely and is blowing room-temperature air during 85°F weather.',
  'Refrigerator freezer is warm, ice maker stopped, and food is starting to thaw.',
  'Heavy oak front door is sticking against the frame and will not latch securely.',
];

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // Natural language problem description
  const [problemDescription, setProblemDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIProblemAnalysis | null>(null);

  // Preferred schedule
  const [preferredDate, setPreferredDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>(TIME_SLOTS[0]);

  // Service address
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '');

  // Photo attachments (simulated data URLs)
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryRates, setCategoryRates] = useState<Record<ServiceCategory, number>>(() =>
    store.getServiceCategoryRates()
  );

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      SupabaseService.fetchServiceCategoryRates()
        .then((rates) => setCategoryRates(rates))
        .catch(() => {});
    }
  }, [isOpen]);

  // Debounced AI analysis as user types their problem description
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = problemDescription.trim();
    if (trimmed.length < 15) {
      setAiAnalysis(null);
      setAnalyzing(false);
      return;
    }

    setAnalyzing(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const analysis = await AIService.analyzeProblem(trimmed);
        setAiAnalysis(analysis);
      } catch (err) {
        console.error('Error during auto-analysis:', err);
      } finally {
        setAnalyzing(false);
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [problemDescription]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachmentPreviews((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachmentPreviews((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setProblemDescription(suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!currentUser) {
      setFormError('Authentication required to submit a request.');
      return;
    }

    const trimmedProblem = problemDescription.trim();
    if (trimmedProblem.length < 10) {
      setFormError('Please provide a descriptive explanation of your problem.');
      return;
    }

    if (!street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setFormError('Please complete all required service address fields.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Ensure latest AI analysis is available
      let analysis = aiAnalysis;
      if (!analysis) {
        analysis = await AIService.analyzeProblem(trimmedProblem);
        setAiAnalysis(analysis);
      }

      const address: ServiceAddress = {
        street: street.trim(),
        unit: unit.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        contactPhone: contactPhone.trim() || currentUser.phone,
      };

      // 2. Submit to Supabase with AI-determined category, priority, skill, and technician summary
      // SupabaseService will automatically evaluate real Supabase technician availability and auto-assign!
      const res = await SupabaseService.createServiceRequest({
        customerId: currentUser.id,
        title: analysis.title,
        category: analysis.category,
        description: trimmedProblem,
        priority: analysis.priority,
        serviceAddress: address,
        preferredDate,
        preferredTimeSlot,
        requiredSkill: analysis.requiredSkill,
        technicianSummary: analysis.technicianSummary,
        attachments: attachmentPreviews,
      });

      if (!res.success || !res.request) {
        throw new Error(res.error || 'Failed to submit service request');
      }

      if (res.autoDispatchedTo) {
        showToast(
          `Ticket ${res.request.ticketNumber} created! AI auto-dispatched to technician ${res.autoDispatchedTo}.`,
          'success'
        );
      } else {
        showToast(
          `Ticket ${res.request.ticketNumber} submitted! Pending Operations Manager approval for AI technician dispatch.`,
          'success'
        );
      }

      onSuccess(res.request.id);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit service request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="min-h-screen px-2 sm:px-4 text-center flex items-center justify-center py-4">
        <div className="relative bg-white text-left rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 z-10 box-border">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#EAE4D9] text-[#143628] border border-[#D8CFBE]">
                  <Sparkles className="w-3 h-3 text-[#143628]" />
                  <span>AI-Powered Dispatch</span>
                </span>
                <span className="text-xs text-[#69776E]">· Real-Time Match</span>
              </div>
              <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#143628] mt-1 truncate">
                Request Service
              </h2>
              <p className="text-xs sm:text-sm text-[#4A554E] mt-0.5">
                Explain your problem in natural language. AI will identify the required skills and automatically dispatch an available technician.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#69776E] hover:text-[#143628] rounded-lg hover:bg-[#EAE4D9] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-4 sm:space-y-6">
            {/* 1. AI-Powered Problem Description */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Problem Description (Natural Language)
                </label>
                {analyzing ? (
                  <span className="text-[11px] font-medium text-indigo-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    AI Analyzing...
                  </span>
                ) : aiAnalysis ? (
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    AI Classified
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <textarea
                  required
                  rows={4}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="Tell us what is broken, what symptoms you see, strange noises, when it started, or if there is active water or electrical danger..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 leading-relaxed min-w-0"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div>
                <div className="text-[11px] text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                  <span>Try an example prompt:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROBLEMS.map((suggestion, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="text-[11px] text-left px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg text-slate-600 transition-colors cursor-pointer truncate max-w-full"
                    >
                      {suggestion.length > 55 ? `${suggestion.slice(0, 55)}...` : suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Diagnostics Card */}
              {aiAnalysis && (
                <div className="p-3.5 sm:p-4 bg-linear-to-br from-indigo-50/90 to-sky-50/60 border border-indigo-200 rounded-xl space-y-2.5 transition-all">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        AI Operational Diagnosis
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-mono">
                      {aiAnalysis.source === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : 'NLP Intelligence'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-white/80 rounded-lg border border-indigo-100/80">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        Identified Category
                      </div>
                      <div className="font-bold text-slate-900 capitalize mt-0.5 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{aiAnalysis.category}</span>
                      </div>
                    </div>

                    <div className="p-2 bg-white/80 rounded-lg border border-indigo-100/80">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        Standard Rate
                      </div>
                      <div className="font-bold text-[#143628] font-mono mt-0.5">
                        {formatHourlyRate(
                          categoryRates[aiAnalysis.category] ||
                            DEFAULT_CATEGORY_RATES[aiAnalysis.category] ||
                            2000
                        )}
                      </div>
                    </div>

                    <div className="p-2 bg-white/80 rounded-lg border border-indigo-100/80">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">
                        Assessed Urgency
                      </div>
                      <div className="mt-0.5">
                        <PriorityBadge priority={aiAnalysis.priority} />
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-lg border border-indigo-100/80 space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Required Technician Skill
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      {aiAnalysis.requiredSkill}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {aiAnalysis.reasoning}
                    </p>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-lg border border-indigo-100/80 space-y-0.5">
                    <div className="text-[10px] uppercase font-semibold text-indigo-600">
                      Technician Briefing Summary
                    </div>
                    <p className="text-xs text-slate-700 italic">
                      "{aiAnalysis.technicianSummary}"
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Upon submission, system will check real Supabase technician availability and auto-assign immediately.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Preferred Schedule */}
            <div className="space-y-2.5 sm:space-y-3 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Preferred Schedule
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#143628] bg-[#FAF8F5] px-2.5 py-0.5 rounded border border-[#E8E2D8]">
                  <Clock className="w-3 h-3" />
                  <span>{WORKING_HOURS_DISPLAY}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Appointment Window (9:00 AM – 6:00 PM)
                  </label>
                  <select
                    value={preferredTimeSlot}
                    onChange={(e) => setPreferredTimeSlot(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Service Address */}
            <div className="space-y-2.5 sm:space-y-3 pt-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Service Location
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Street Address (e.g., 742 Evergreen Terrace)"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Unit / Apt # (optional)"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <input
                    type="text"
                    required
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="ZIP Code"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Contact Phone for Technician
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="On-site contact number"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 min-w-0"
                />
              </div>
            </div>

            {/* 4. Photo Attachments */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Photo Evidence (Optional)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer px-3 py-2 bg-slate-50 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Attach Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                <span className="text-[11px] text-slate-400">
                  Upload photos of leaks, error codes, damage, or labels.
                </span>
              </div>

              {attachmentPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {attachmentPreviews.map((preview, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group"
                    >
                      <img
                        src={preview}
                        alt={`Attachment ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#FDFBF7] bg-[#143628] hover:bg-[#1B4332] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Matching & Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Submit & Auto-Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
