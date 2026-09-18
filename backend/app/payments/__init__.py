"""Stripe Connect payments: pricing, the Stripe gateway, jobs and documents.

The spec this implements is docs/payment/stripe-payment-spec.md.
Its vocabulary maps onto the schema this project already has:

    spec "booking", status pending_payment   ->  Order  (holds the slot, owns the
                                                 PaymentIntent and the frozen
                                                 amount breakdown)
    spec "booking", status confirmed onward  ->  Booking (created when Stripe
                                                 confirms payment; owns the
                                                 Transfer and any refund)

Money is stored in minor units under the project's existing `_minor` naming rather
than the spec's `_cents`; for AUD the two are the same thing.
"""
