"""Validate the checked-in HTTP mock payloads against the actual backend mapper.

Run from the repository root:
DATABASE_URL=sqlite:///:memory: SEED_ON_STARTUP=false backend/.venv/bin/python \
  artifacts/qa/sprint3-dev-refresh-20261017/authoring-auth/check_privacy_fixture.py

No database connection or external provider is used. Source input is a synthetic
User; the output shape and omission policy come from the production mapper and
GET /counsellors response-model serialization, not hand-added frontend defaults.
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path('backend').resolve()))
from app.models import User
from app.routers.counsellor import counsellor_profile_out

profile = User(
    id='privacy-fixture-professional', name='Privacy Fixture Professional',
    email='privacy-fixture@example.com', role='counsellor',
    password_hash='fixture-not-authenticated', verification_status='verified',
    overall_rating=4.8, review_count=3, introduction='Public career summary',
    default_modality='online', expertise=['Private coaching expertise'],
    languages=['Private language'],
)
responses = {}
for visibility in ('partial', 'restricted'):
    profile.profile_visibility = visibility
    responses[visibility] = counsellor_profile_out(
        profile, enforce_visibility=True,
    ).model_dump(by_alias=True, exclude_none=True, exclude_unset=True)
fixture = Path('frontend/__tests__/privacy-profile-fixtures.json')
assert json.loads(fixture.read_text()) == responses
print(json.dumps({
    'matchesActualMapper': True,
    'fixture': str(fixture),
    'fixtureSha256': hashlib.sha256(fixture.read_bytes()).hexdigest(),
    'responses': responses,
}, indent=2))
