"""The in-process runner for the payment jobs.

The project has no Celery or cron to hang these off, and the work is three short
queries a minute, so an asyncio task inside the API process is the proportionate
answer rather than a new piece of infrastructure. The jobs themselves are pure
functions in jobs.py, so moving to APScheduler or a cron entry point later is a
change of caller, not of logic.

It runs only where payments are actually configured: a deployment on the stub has
no PaymentIntents to cancel and no transfers to make. Running more than one API
process means more than one ticker, which is safe — every job re-reads the row it
is about to change and Stripe's idempotency keys absorb a duplicated call.
"""

import asyncio
import contextlib
import logging

from app.config import get_settings
from app.db import SessionLocal
from app.payments.jobs import run_payment_jobs

log = logging.getLogger(__name__)


async def _ticker(interval_seconds: int) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            # Blocking DB and Stripe work belongs off the event loop, so the API
            # keeps serving requests while a tick is talking to Stripe.
            counts = await asyncio.to_thread(_tick)
        except Exception:
            log.exception("A payment job tick failed; the next tick will retry.")
            continue
        if any(counts.values()):
            log.info("Payment jobs: %s", counts)


def _tick() -> dict[str, int]:
    with SessionLocal() as db:
        return run_payment_jobs(db)


@contextlib.asynccontextmanager
async def payment_jobs():
    """Run the payment jobs for as long as the app is up."""
    settings = get_settings()
    if not (settings.payment_jobs_enabled and settings.payments_enabled):
        log.info("Payment jobs are not running (payments disabled or jobs switched off).")
        yield
        return

    task = asyncio.create_task(_ticker(settings.payment_jobs_interval_seconds))
    log.info("Payment jobs running every %ss.", settings.payment_jobs_interval_seconds)
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
