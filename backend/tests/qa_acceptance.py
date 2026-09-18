"""Narrow failure type for executable, unresolved acceptance defects.

Only the final business expectation may raise this type. Fixture errors, unexpected
HTTP failures and ordinary assertions remain real test failures under xfail.
"""


class KnownAcceptanceDefect(AssertionError):
    """A reproduced product/contract defect, never a test setup failure."""
