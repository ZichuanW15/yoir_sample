"""PostgreSQL interleaving checks for US-53/54/55 review transactions.

Barriers pause real requests at transaction boundaries; no database result,
aggregate value or HTTP response is mocked. SQLite skips are not concurrency
evidence. Fixture bookings are completed explicitly, then the real review API is
used for every write.
"""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, BrokenBarrierError

import pytest
from qa_acceptance import KnownAcceptanceDefect
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from test_sprint3_api_journeys_qa import _completed_booking, _review

from app.db import SessionLocal, engine
from app.models import Review, Service, User
from app.routers import bookings as bookings_router


def _postgresql_only():
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL transaction interleaving requires an isolated PostgreSQL database")


def _meet(barrier):
    try:
        barrier.wait(timeout=5)
        return True
    except BrokenBarrierError:
        # A future fix may serialize requests before this boundary. Release the
        # first request so that correct locking can finish and produce strict XPASS,
        # rather than mistaking the new lock for a test-induced deadlock.
        return False


@pytest.mark.xfail(
    strict=True, raises=KnownAcceptanceDefect,
    reason=("S3-BE-REVIEW-DUPLICATE-RACE: US-53 / QA #213; concurrent duplicate "
            "submission leaks an internal error instead of returning a conflict"),
)
def test_simultaneous_duplicate_reviews_return_one_created_and_one_conflict(
    client, db_session, service, job_seeker_headers, monkeypatch,
):
    """US-53: a retried/double-clicked write must have a usable conflict response."""
    _postgresql_only()
    booking = _completed_booking(client, db_session, service, job_seeker_headers)
    barrier = Barrier(2)
    flush = Session.flush
    arrivals = []
    synchronization = []
    insert_errors = []
    booking_constraints = {
        constraint["name"] for constraint in inspect(engine).get_unique_constraints("reviews")
        if constraint["column_names"] == ["booking_id"]
    }
    assert booking_constraints, "The review fixture schema lacks the booking uniqueness constraint"

    def concurrent_insert(self, *args, **kwargs):
        inserts_review = any(isinstance(row, Review) for row in self.new)
        if inserts_review:
            arrivals.append(id(self))
            synchronization.append(_meet(barrier))
        try:
            return flush(self, *args, **kwargs)
        except IntegrityError as error:
            if inserts_review:
                diagnostic = getattr(error.orig, "diag", None)
                insert_errors.append({
                    "sqlstate": getattr(error.orig, "sqlstate", None)
                    or getattr(error.orig, "pgcode", None),
                    "table": getattr(diagnostic, "table_name", None),
                    "constraint": getattr(diagnostic, "constraint_name", None),
                })
            raise

    with monkeypatch.context() as patch:
        patch.setattr(Session, "flush", concurrent_insert)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(
                _review, client, job_seeker_headers, booking, rating, f"Attempt {rating}",
            ) for rating in (2, 5)]
            responses = [future.result(timeout=20) for future in futures]

    # Storage and the winning response are independent invariants. A fixture or
    # database-integrity failure must not be mistaken for the expected conflict.
    successes = [response.json() for response in responses if response.status_code == 201]
    assert len(successes) == 1
    with SessionLocal() as db:
        rows = list(db.scalars(select(Review)))
        assert len(rows) == 1 and rows[0].id == successes[0]["id"]
        assert db.get(Service, service.id).review_count == 1
        assert db.get(User, service.counsellor_id).review_count == 1
    statuses = sorted(response.status_code for response in responses)
    assert statuses in ([201, 409], [201, 500])
    losing_response = next(response for response in responses if response.status_code != 201)
    assert losing_response.json()["requestId"]
    if losing_response.status_code == 500:
        assert losing_response.json()["code"] == "INTERNAL_ERROR"
        assert len(arrivals) == len(set(arrivals)) == 2, arrivals
        # An unrelated new 500 must remain a real failure, not this known XFAIL.
        # Inspect the original PostgreSQL exception, never its generic HTTP envelope.
        assert len(insert_errors) == 1, insert_errors
        assert insert_errors[0]["sqlstate"] == "23505", insert_errors
        assert insert_errors[0]["table"] == "reviews", insert_errors
        assert insert_errors[0]["constraint"] in booking_constraints, insert_errors
        raise KnownAcceptanceDefect(
            "One review is stored and counted once, but the duplicate request "
            f"returns HTTP 500 instead of HTTP 409: statuses={statuses}; "
            f"insert_error={insert_errors[0]}; barrier_completed={synchronization}"
        )
    # A future lock can reject the second request before insertion. In that case
    # only one request reaches the barrier; the expected 201/409 becomes strict
    # XPASS for review, not a test-induced deadlock or an automatic repair claim.
    assert losing_response.json()["code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.parametrize("same_service", [True, False], ids=["same-service", "two-services"])
@pytest.mark.xfail(
    strict=True, raises=KnownAcceptanceDefect,
    reason=("S3-BE-REVIEW-AGGREGATE-RACE: US-54/55 / QA #216/#219; concurrent "
            "successful review writes overwrite cached service/counsellor totals"),
)
def test_simultaneous_distinct_reviews_keep_both_cached_aggregates_exact(
    client, db_session, service, job_seeker_headers, monkeypatch, same_service,
):
    """US-54/55: successful concurrent reviews cannot overwrite each other's totals."""
    _postgresql_only()
    second_service = service
    if not same_service:
        second_service = Service(
            counsellor_id=service.counsellor_id, title="Second offering", description="Feedback",
            price_minor=7000, currency="AUD", modalities=["online"], active=True,
        )
        db_session.add(second_service)
        db_session.commit()
    first = _completed_booking(client, db_session, service, job_seeker_headers, day=2)
    second = _completed_booking(client, db_session, second_service, job_seeker_headers, day=3)
    barrier = Barrier(2)
    recompute = bookings_router.recompute_counsellor_rating
    arrivals = []
    synchronization = []

    def concurrent_aggregates(db, counsellor_id):
        recompute(db, counsellor_id)
        # Both transactions have inserted their own review and calculated caches,
        # but neither has committed. Real commits then compete for the shared row.
        arrivals.append(id(db))
        synchronization.append(_meet(barrier))

    with monkeypatch.context() as patch:
        patch.setattr(bookings_router, "recompute_counsellor_rating", concurrent_aggregates)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(
                _review, client, job_seeker_headers, booking, rating, f"Score {rating}",
            ) for booking, rating in ((first, 1), (second, 5))]
            responses = [future.result(timeout=20) for future in futures]
    assert [response.status_code for response in responses] == [201, 201]
    assert len(arrivals) == len(set(arrivals)) == 2, arrivals
    with SessionLocal() as db:
        stored_reviews = list(db.scalars(select(Review)))
        assert len(stored_reviews) == 2
        assert sorted(row.rating for row in stored_reviews) == [1, 5]
        owner = db.get(User, service.counsellor_id)
        stored_service = db.get(Service, service.id)
        actual = {
            "counsellor": (owner.review_count, owner.overall_rating),
            "service": (stored_service.review_count, stored_service.average_rating),
        }
        if not same_service:
            other_service = db.get(Service, second_service.id)
            # A different service has no competing write to its own cache. Its
            # corruption would be a new invariant failure, not the shared-row race.
            assert (other_service.review_count, other_service.average_rating) == (1, 5.0)
    expected = {"counsellor": (2, 3.0), "service": (2, 3.0) if same_service else (1, 1.0)}
    if actual != expected:
        raise KnownAcceptanceDefect(
            "Both API writes returned 201 and both reviews are stored (ratings 1 and 5), "
            f"but cached totals disagree: expected={expected}, actual={actual}; "
            f"barrier_completed={synchronization}"
        )
