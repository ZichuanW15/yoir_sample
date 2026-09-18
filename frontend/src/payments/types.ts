/** Shared by the native PaymentSheet and its web stand-in. */

export interface PaymentSheetRequest {
  clientSecret: string;
  customerName?: string;
}

export interface PaymentSheetOutcome {
  /**
   * `paid` means Stripe accepted the card — not that the booking is confirmed.
   * Confirmation comes from the backend webhook, which the screen then polls for.
   * `cancelled` is the person closing the sheet, and is never shown as an error.
   */
  outcome: 'paid' | 'cancelled' | 'failed' | 'unsupported';
  message?: string;
}
