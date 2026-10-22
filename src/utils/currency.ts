import { ServiceCategory } from '../types';

/**
 * FixNear Currency & Working Hours Utilities
 * Standardizes all pricing displays to Pakistani Rupees (PKR / Rs.)
 * and enforces official Working Hours: 9:00 AM – 6:00 PM across the platform.
 */

export const CURRENCY_CODE = 'PKR';
export const CURRENCY_SYMBOL = 'Rs.';
export const CURRENCY_HOURLY_LABEL = 'PKR/hour';

export const WORKING_HOURS_TEXT = 'Working Hours: 9:00 AM – 6:00 PM';
export const WORKING_HOURS_DISPLAY = WORKING_HOURS_TEXT;
export const WORKING_HOURS_SHORT = '9:00 AM – 6:00 PM';
export const WORKING_HOURS_START = 9; // 9:00 AM (09:00)
export const WORKING_HOURS_END = 18; // 6:00 PM (18:00)

export const WORKING_TIME_SLOTS = [
  '09:00 AM – 11:00 AM',
  '11:00 AM – 01:00 PM',
  '01:00 PM – 03:00 PM',
  '03:00 PM – 05:00 PM',
  '05:00 PM – 06:00 PM',
] as const;

export const DEFAULT_CATEGORY_RATES: Record<ServiceCategory, number> = {
  plumbing: 2000,
  electrical: 2200,
  hvac: 2500,
  appliance: 2000,
  carpentry: 2000,
  general: 2000,
};

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'AC & HVAC',
  appliance: 'Appliance Repair',
  carpentry: 'Carpentry & Framing',
  general: 'General Maintenance',
};

/**
 * Maps a technician's specialty string to its corresponding ServiceCategory.
 */
export const mapSpecialtyToCategory = (specialty?: string): ServiceCategory => {
  const s = (specialty || '').toLowerCase();
  if (s.includes('plumb') || s.includes('pipe') || s.includes('water')) return 'plumbing';
  if (s.includes('electr') || s.includes('wiring')) return 'electrical';
  if (s.includes('hvac') || s.includes('climate') || s.includes('ac') || s.includes('cooling')) return 'hvac';
  if (s.includes('appliance') || s.includes('fridge') || s.includes('washer')) return 'appliance';
  if (s.includes('carpent') || s.includes('wood') || s.includes('framing')) return 'carpentry';
  return 'general';
};

/**
 * Formats a technician's hourly billing rate into standard PKR presentation.
 * Example: 2000 -> "PKR 2,000/hour"
 */
export const formatHourlyPrice = (rate?: number | null, fallback = 2000): string => {
  const value = rate !== undefined && rate !== null && !isNaN(Number(rate)) && Number(rate) > 0 ? Number(rate) : fallback;
  return `PKR ${value.toLocaleString()}/hour`;
};

export const formatHourlyRate = formatHourlyPrice;

/**
 * Formats general amounts or parts totals into standard PKR presentation.
 * Example: 450 -> "PKR 450"
 */
export const formatPrice = (amount?: number | null): string => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return 'PKR 0';
  }
  return `PKR ${Number(amount).toLocaleString()}`;
};

