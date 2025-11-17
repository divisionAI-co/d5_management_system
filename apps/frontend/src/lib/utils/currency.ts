/**
 * Safely format a number as currency, with fallback handling for invalid currency codes
 * @param amount The amount to format
 * @param currency The ISO 4217 currency code (e.g., 'USD', 'EUR')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency?: string | null): string {
  // Default to USD if no currency provided
  const currencyCode = currency || 'USD';
  
  // Validate currency code - must be 3 uppercase letters (ISO 4217 standard)
  const isValidCurrency = /^[A-Z]{3}$/.test(currencyCode);
  const safeCurrency = isValidCurrency ? currencyCode : 'USD';
  
  try {
    return amount.toLocaleString(undefined, {
      style: 'currency',
      currency: safeCurrency,
    });
  } catch (error) {
    // Fallback to simple number formatting if currency formatting fails
    console.warn(`Failed to format currency with code "${currencyCode}":`, error);
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
}

/**
 * Validate if a string is a valid ISO 4217 currency code
 * @param currency The currency code to validate
 * @returns True if valid, false otherwise
 */
export function isValidCurrencyCode(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

