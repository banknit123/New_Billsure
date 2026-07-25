"""
backend/reconciliation.py
===========================
Continuous verification that:

1. INTERNAL — the TRUST_BANK ledger balance equals the sum of every
   customer's ledger balance. This should be true *by construction* if
   ledger.py is the only thing that ever moves money (every journal moves
   TRUST_BANK and a customer account by equal, opposite amounts). A nonzero
   internal_variance therefore means a bug or an out-of-band DB edit, not
   ordinary bank drift — treat it as a stop-ship issue, which is why
   payment_runs.approve_payment_run() refuses to approve while one is open.

2. EXTERNAL — the TRUST_BANK ledger balance equals the actual balance of
   the real-world trust bank/payment-provider account. This is what
   actually proves customer funds are all present. Wire
   _fetch_external_trust_balance() to your bank's data feed (Open Banking
   CDR) or your payment/BaaS provider's account-balance API — it's a stub
   here because that integration is specific to whichever ADI or payments
   partner ends up holding the account. Until it's wired up, this function
   still runs the internal check (the more important one for catching bugs)
   and logs a warning rather than silently reporting "ok" for the external
   leg.

Run run_trust_reconciliation() on a schedule (hourly is a reasonable
starting point) and always immediately before a payment run is approved.
"""

import logging
from decimal import Decimal
from typing import Optional

import supabase_db as sdb
import ledger

logger = logging.getLogger(__name__)

# Any unresolved variance above this blocks new payment-run approvals.
VARIANCE_TOLERANCE = Decimal("0.01")


async def _fetch_external_trust_balance() -> Optional[Decimal]:
    """
    STUB. Replace with a real call to your bank's or payment provider's
    account-balance API for the physical trust account (e.g. an Open
    Banking CDR data feed, or your BaaS/payments provider's account API if
    the trust account is a provider-issued segregated/virtual account).
    Return None if not wired up yet.
    """
    logger.warning("_fetch_external_trust_balance() is a stub — external reconciliation is not active yet")
    return None


async def run_trust_reconciliation(triggered_by: Optional[str] = None) -> dict:
    trust_balance = await ledger.get_system_balance(ledger.TRUST_BANK)

    customer_rows = await sdb.find_many("customer_balances", limit=1000000)
    sum_customers = sum(Decimal(str(r["ledger_balance"])) for r in customer_rows) if customer_rows else Decimal("0")

    internal_variance = trust_balance - sum_customers

    external_balance = await _fetch_external_trust_balance()
    external_variance = (trust_balance - external_balance) if external_balance is not None else None

    status = "ok"
    if abs(internal_variance) > VARIANCE_TOLERANCE:
        status = "variance_detected"
    if external_variance is not None and abs(external_variance) > VARIANCE_TOLERANCE:
        status = "variance_detected"

    run = await sdb.insert_one("reconciliation_runs", {
        "trust_ledger_balance": str(trust_balance),
        "sum_customer_balances": str(sum_customers),
        "external_bank_balance": str(external_balance) if external_balance is not None else None,
        "internal_variance": str(internal_variance),
        "external_variance": str(external_variance) if external_variance is not None else None,
        "status": status,
    })

    if abs(internal_variance) > VARIANCE_TOLERANCE:
        await sdb.insert_one("reconciliation_exceptions", {
            "reconciliation_run_id": run["id"], "exception_type": "internal_variance",
            "amount": str(internal_variance),
        })
        logger.error(
            f"RECONCILIATION FAILURE (internal): trust_ledger={trust_balance} "
            f"sum_customers={sum_customers} variance={internal_variance}"
        )

    if external_variance is not None and abs(external_variance) > VARIANCE_TOLERANCE:
        await sdb.insert_one("reconciliation_exceptions", {
            "reconciliation_run_id": run["id"], "exception_type": "external_variance",
            "amount": str(external_variance),
        })
        logger.error(
            f"RECONCILIATION FAILURE (external): trust_ledger={trust_balance} "
            f"bank_balance={external_balance} variance={external_variance}"
        )

    return run


async def is_safe_to_process_payments() -> bool:
    """payment_runs.approve_payment_run() calls this and refuses to approve
    if False. 'Safe' = there is at least one reconciliation run on record,
    and no open, unresolved exceptions. Fails closed (False) if
    reconciliation has never been run at all."""
    recent = await sdb.find_many("reconciliation_runs", order_by="run_at", order_desc=True, limit=1)
    if not recent:
        return False
    open_exceptions = await sdb.find_many("reconciliation_exceptions", {"status": "open"})
    return len(open_exceptions) == 0
