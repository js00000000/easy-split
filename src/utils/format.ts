import type { Timestamp } from 'firebase/firestore';

/**
 * Format a Firebase Timestamp or Date into a localized string.
 */
export function formatDate(date: Timestamp | Date | undefined, locale: string = 'en') {
  if (!date) return '';
  
  const d = date instanceof Date ? date : date.toDate();
  
  return d.toLocaleString(locale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format a number as a localized currency string.
 */
export function formatCurrency(amount: number) {
  // Simple $ format for now as per current UI
  return `$${amount.toFixed(0)}`;
}

/**
 * Helper to get a consistent integer representation of amount.
 */
export function toAmountDisplay(amount: number) {
  return amount.toFixed(0);
}
