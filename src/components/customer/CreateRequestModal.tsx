import React, { useState, useEffect } from 'react';
import { ServiceCategory, PriorityLevel, ServiceAddress, AIProblemAnalysis } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { AIService } from '../../services/aiService';
import { TriggerService } from '../../services/triggerService';
import { CategoryIcon } from '../common/CategoryIcon';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  formatHourlyRate,
  DEFAULT_CATEGORY_RATES,
  WORKING_TIME_SLOTS,
  WORKING_HOURS_LABEL,
} from '../../utils/currency';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  Navigation,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface CreateRequestModalProps {
  isOpen?: boolean;
  customerId?: string;
  customerPhone?: string;
  onClose: () => void;
  onCreated?: () => void;
  onSuccess?: (reqId: string) => void;
}

const CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'general', label: 'General' },
];

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  isOpen = true,
  customerId: propCustomerId,
  customerPhone: propCustomerPhone,
  onClose,
  onCreated,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const customerId = propCustomerId || currentUser?.id || '';
  const customerPhone = propCustomerPhone ?? currentUser?.phone ?? '';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('plumbing');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');

  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [contactPhone, setContactPhone] = useState(customerPhone || '');

  // GPS Coordinates (populated strictly when customer clicks "Use My Current Location" and grants permission)
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    formattedAddress?: string;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const tomorrow = new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
  const minDateStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];

  const [preferredDate, setPreferredDate] = useState(tomorrow);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>(WORKING_TIME_SLOTS[0]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live service category rates from Supabase
  const [categoryRates, setCategoryRates] =
    useState<Record<ServiceCategory, number>>(DEFAULT_CATEGORY_RATES);

  useEffect(() => {
    let mounted = true;
    SupabaseService.fetchServiceCategoryRates().then((rates) => {
      if (mounted && rates) {
        setCategoryRates(rates);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // AI Smart Triage State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIProblemAnalysis | null>(null);

  const handleAIAnalyze = async () => {
    if (!description.trim() && !title.trim()) {
      setError('Enter a problem description first to run AI analysis.');
      return;
    }

    setError('');
    setIsAnalyzing(true);
    try {
      const analysis = await AIService.analyzeProblem(description || title);
      setAiResult(analysis);
      setCategory(analysis.category);
      setPriority(analysis.priority);
      if (!title.trim() || title.trim().length < 5) {
        setTitle(analysis.title);
      }
    } catch {
      setError('AI analysis failed. You can select the category and priority manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Request browser location permission ONLY when customer clicks "Use My Current Location"
  const handleUseCurrentLocation = () => {
    setLocationMessage(null);

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setCoords(null);
      setLocationMessage({
        type: 'error',
        text: 'Geolocation is not supported by your browser. Please enter your address manually.',
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const acc = position.coords.accuracy ? Math.round(position.coords.accuracy) : undefined;

        let formatted = '';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            {
              headers: {
                Accept: 'application/json',
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            const addr = data?.address || {};
            const road =
              addr.road ||
              addr.pedestrian ||
              addr.suburb ||
              addr.neighbourhood ||
              addr.residential ||
              '';
            const houseNumber = addr.house_number ? `${addr.house_number} ` : '';
            const detectedStreet = `${houseNumber}${road}`.trim();
            const detectedCity =
              addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
            const detectedState = addr.state || addr.region || '';
            const detectedZip = addr.postcode || '';

            if (detectedStreet && !street.trim()) setStreet(detectedStreet);
            if (detectedCity && !city.trim()) setCity(detectedCity);
            if (detectedState && !state.trim()) setState(detectedState);
            if (detectedZip && !zip.trim()) setZip(detectedZip);
            if (data?.display_name) {
              formatted = String(data.display_name);
              if (!street.trim() && !detectedStreet) {
                setStreet(formatted.split(',').slice(0, 2).join(',').trim());
              }
            }
          }
        } catch {
          // Reverse geocoding is optional; coordinates are still saved
        }

        setCoords({
          latitude: lat,
          longitude: lng,
          accuracyMeters: acc,
          formattedAddress: formatted || undefined,
        });
        setIsLocating(false);
        setLocationMessage({
          type: 'success',
          text: `GPS coordinates captured (${lat}, ${lng}). Verify or complete the address fields below.`,
        });
      },
      (geoError) => {
        setCoords(null);
        setIsLocating(false);
        let msg = 'Unable to get your current location. Please enter your address manually.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please enter your address manually below.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable on this device. Please enter your address manually.';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'Location request timed out. Please try again or enter your address manually.';
        }
        setLocationMessage({
          type: 'error',
          text: msg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const isUrgent = priority === 'emergency' || priority === 'high';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!description.trim() && !title.trim()) {
      setError('Please describe the repair issue.');
      return;
    }
    if (!street.trim() || !city.trim()) {
      setError('Street address and city are required.');
      return;
    }
    if (!preferredDate) {
      setError('Please select a preferred appointment date.');
      return;
    }

    const slotValidation = SupabaseService.validateWorkingHoursSlot(preferredTimeSlot);
    if (!slotValidation.valid) {
      setError(
        slotValidation.error ||
          `Appointments must be scheduled during ${WORKING_HOURS_LABEL}.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let finalCategory = category;
      let finalPriority = priority;
      let finalTitle = title.trim();
      let requiredSkill: string | undefined = aiResult?.requiredSkill;
      let technicianSummary: string | undefined = aiResult?.technicianSummary;

      if (!aiResult) {
        try {
          const autoAnalysis = await AIService.analyzeProblem(description || title);
          finalCategory = autoAnalysis.category;
          // Preserve customer's explicit Urgent selection or apply AI detected urgency
          if (priority === 'high' || priority === 'emergency') {
            finalPriority =
              autoAnalysis.priority === 'emergency' ? 'emergency' : priority;
          } else {
            finalPriority = autoAnalysis.priority;
          }
          if (!finalTitle) {
            finalTitle = autoAnalysis.title;
          }
          requiredSkill = autoAnalysis.requiredSkill;
          technicianSummary = autoAnalysis.technicianSummary;
        } catch {
          if (!finalTitle) finalTitle = `${category.toUpperCase()} Service Request`;
        }
      } else if (!finalTitle) {
        finalTitle = aiResult.title;
      }

      const serviceAddress: ServiceAddress = {
        street: street.trim(),
        unit: unit.trim() || undefined,
        city: city.trim(),
        state: state.trim() || 'PK',
        zip: zip.trim() || '00000',
        contactPhone: contactPhone.trim() || customerPhone,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracyMeters: coords?.accuracyMeters,
        formattedAddress: coords?.formattedAddress,
      };

      const res = await SupabaseService.createServiceRequest({
        customerId,
        title: finalTitle,
        category: finalCategory,
        description: description.trim() || finalTitle,
        priority: finalPriority,
        serviceAddress,
        preferredDate,
        preferredTimeSlot: slotValidation.canonical,
        requiredSkill,
        technicianSummary,
      });

      if (!res.success || !res.request) {
        setError(res.error || 'Failed to submit service request.');
        setIsSubmitting(false);
        return;
      }

      const customerProfile = await SupabaseService.getProfile(customerId);
      TriggerService.triggerServiceRequestCreated(
        res.request,
        customerProfile
          ? {
              id: customerProfile.id,
              fullName: customerProfile.fullName,
              email: customerProfile.email,
              phone: customerProfile.phone,
            }
          : {
              id: customerId,
              fullName: res.request.customerName,
              email: res.request.customerEmail || '',
              phone: contactPhone.trim() || customerPhone,
            },
        {
          aiSummary: technicianSummary || aiResult?.reasoning || null,
          requiredSkill: requiredSkill || null,
          autoDispatchedTo: null,
        }
      );

      if (onCreated) onCreated();
      if (onSuccess) onSuccess(res.request.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating service request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E6E1D6] shadow-2xl max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#143628] text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">New Service Request</h2>
            <p className="text-xs text-[#E6E1D6]/80 mt-0.5">{WORKING_HOURS_LABEL}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Problem Description & AI Analysis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18181B]">
                1. Describe the Issue *
              </label>
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={isAnalyzing || (!description.trim() && !title.trim())}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#143628] hover:bg-[#0f291e] disabled:opacity-40 text-white text-xs font-semibold transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Auto-Detect Category & Urgency
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs repair (mention if there is an urgent leak, spark, or outage)..."
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
              required
            />

            {aiResult && (
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-semibold text-[#143628]">
                    AI Classification: {aiResult.requiredSkill}
                  </span>
                </div>
                <PriorityBadge priority={priority} size="sm" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#5C5852] mb-1">
                Short Summary Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief title of the issue"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                required
              />
            </div>
          </div>

          {/* 2. Category & Priority */}
          <div className="space-y-3 pt-2 border-t border-[#E6E1D6]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18181B]">
                2. Category & Priority
              </label>
              <span className="text-xs font-bold text-[#143628]">
                Rate: {formatHourlyRate(categoryRates[category])}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CATEGORIES.map((cat) => {
                const selected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      selected
                        ? 'border-[#143628] bg-[#143628]/5 text-[#143628] ring-2 ring-[#143628]/20'
                        : 'border-[#E6E1D6] hover:border-gray-300 text-[#5C5852]'
                    }`}
                  >
                    <CategoryIcon
                      category={cat.value}
                      className={`w-4 h-4 mb-1 ${selected ? 'text-[#143628]' : 'text-[#5C5852]'}`}
                    />
                    <span className="text-[11px] font-bold">{cat.label}</span>
                    <span className="text-[10px] text-[#5C5852]">
                      PKR {(categoryRates[cat.value] || 2000).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Priority Selector (Normal vs Urgent) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6]">
              <div>
                <span className="text-xs font-bold text-[#18181B] block">Request Priority</span>
                <span className="text-[11px] text-[#5C5852]">
                  Urgent requests are prioritized in the dispatch queue for available specialists.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPriority('medium')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    !isUrgent
                      ? 'bg-[#143628] text-white border-[#143628]'
                      : 'bg-white text-[#5C5852] border-[#E6E1D6]'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPriority(priority === 'emergency' ? 'emergency' : 'high')
                  }
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    isUrgent
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Urgent
                </button>
              </div>
            </div>
          </div>

          {/* 3. Customer Location Selection */}
          <div className="space-y-3 pt-2 border-t border-[#E6E1D6]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#143628]" />
                3. Service Location *
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FAF8F5] hover:bg-[#143628] text-[#143628] hover:text-white border border-[#143628]/30 transition-colors disabled:opacity-50"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Getting GPS...
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    Use My Current Location
                  </>
                )}
              </button>
            </div>

            {locationMessage && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  locationMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <span>{locationMessage.text}</span>
                {coords && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=17/${coords.latitude}/${coords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#143628] underline shrink-0"
                  >
                    Map Pin
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Enter street address or area"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  Unit / Floor
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  Province / State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Province / State"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Preferred Schedule */}
          <div className="space-y-3 pt-2 border-t border-[#E6E1D6]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#143628]" />
                4. Preferred Schedule *
              </label>
              <span className="text-[11px] font-semibold text-[#143628]">
                {WORKING_HOURS_LABEL}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  min={minDateStr}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5852] mb-1">
                  Time Window *
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={preferredTimeSlot}
                    onChange={(e) => setPreferredTimeSlot(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#E6E1D6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#143628]"
                  >
                    {WORKING_TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E6E1D6] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E6E1D6] text-xs font-semibold text-[#5C5852] hover:bg-[#FAF8F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#143628] hover:bg-[#0f291e] disabled:opacity-50 text-white text-xs font-semibold shadow-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
