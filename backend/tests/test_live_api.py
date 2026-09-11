"""Black-box HTTP smoke for a separately running backend.

Set LIVE_API_BASE_URL to opt in.  The database engine used by that server must
be reported separately; this test alone is not PostgreSQL evidence.
"""

from __future__ import annotations

import os
import uuid

import httpx
import pytest

BASE_URL = os.getenv("LIVE_API_BASE_URL")
pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not BASE_URL, reason="LIVE_API_BASE_URL is not set"),
]


def test_live_register_login_marketplace_booking_and_payment() -> None:
    email = f"qa-live-{uuid.uuid4()}@example.com"
    with httpx.Client(base_url=BASE_URL, timeout=10) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {"status": "ok"}

        registration = client.post(
            "/auth/users",
            json={
                "name": "QA Live Test",
                "email": email,
                "password": "password123",
                "passwordConfirmation": "password123",
                "role": "job_seeker",
            },
        )
        assert registration.status_code == 201

        login = client.post("/auth/sessions", json={"email": email, "password": "password123"})
        assert login.status_code == 200
        access_token = login.json()["accessToken"]
        assert access_token
        headers = {"Authorization": f"Bearer {access_token}"}

        services = client.get("/services")
        assert services.status_code == 200
        assert services.json()

        detail = client.get(f"/services/{services.json()[0]['id']}")
        assert detail.status_code == 200
        assert detail.json()["id"] == services.json()[0]["id"]

        slots = client.get(f"/services/{detail.json()['id']}/slots")
        assert slots.status_code == 200
        assert slots.json()

        order = client.post(
            "/orders",
            headers=headers,
            json={
                "serviceId": detail.json()["id"],
                "slotId": slots.json()[0]["id"],
                "modality": detail.json()["modalities"][0],
                "timezone": "Australia/Melbourne",
            },
        )
        assert order.status_code == 201
        assert order.json()["status"] == "awaiting_payment"

        payment = client.post(
            f"/orders/{order.json()['id']}/payments/stub",
            headers=headers,
        )
        assert payment.status_code == 200
        assert payment.json()["paymentStatus"] == "paid"
        assert payment.json()["booking"]["status"] == "confirmed"


def test_live_login_errors_and_current_session_logout() -> None:
    email = f"qa-live-session-{uuid.uuid4()}@example.com"
    password = "live-session-password"
    with httpx.Client(base_url=BASE_URL, timeout=10) as client:
        registered = client.post("/auth/users", json={
            "name": "QA Live Session", "email": email, "password": password,
            "passwordConfirmation": password, "role": "job_seeker",
        })
        assert registered.status_code == 201
        failures = [
            client.post("/auth/sessions", json=credentials)
            for credentials in (
                {"email": email, "password": "wrong-password"},
                {"email": f"missing-{uuid.uuid4()}@example.com", "password": password},
            )
        ]
        for failed in failures:
            assert failed.status_code == 401
            assert failed.json()["code"] == "INVALID_CREDENTIALS"
            assert set(failed.json()) == {"code", "message", "requestId"}
        assert failures[0].json()["message"] == failures[1].json()["message"]

        sessions = [client.post("/auth/sessions", json={"email": email, "password": password})
                    for _ in range(2)]
        assert all(session.status_code == 200 for session in sessions)
        first, second = [session.json()["accessToken"] for session in sessions]
        assert first != second
        headers = {"Authorization": f"Bearer {first}"}
        probe = "/orders/missing-order/payments/stub"
        assert client.post(probe, headers=headers).status_code == 404
        for _ in range(2):
            logout = client.delete("/auth/sessions/current", headers=headers)
            assert logout.status_code == 204
            assert logout.content == b""
        for padding in ("", "=", "=="):
            replay = client.post(probe, headers={"Authorization": f"Bearer {first}{padding}"})
            assert replay.status_code == 401
            assert replay.json()["code"] == "AUTHENTICATION_REQUIRED"
        assert client.post(probe, headers={"Authorization": f"Bearer {second}"}).status_code == 404
        assert client.get("/services").status_code == 200
