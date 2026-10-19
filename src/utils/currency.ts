/**
 * FixNear Currency Formatting Utilities
 * Standardizes all pricing displays to Pakistani Rupees (PKR / Rs.)
 * Example: "PKR 2,000/hour"
 */

export const CURRENCY_CODE = 'PKR';
export const CURRENCY_SYMBOL = 'Rs.';
export const CURRENCY_HOURLY_LABEL = 'PKR/hour';

/**
 * Formats a technician's hourly billing rate into standard PKR presentation.
 * Example: 2000 -> "PKR 2,000/hour"
 */
export const formatHourlyPrice = (rate?: number | null, fallback = 2000): string => {
  const value = rate !== undefined && rate !== null && !isNaN(Number(rate)) ? Number(rate) : fallback;
  return `PKR ${value.toLocaleString()}/hour`;
};

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
