"""US-09–12: private progress plus deterministic direction from completed answers."""
from copy import deepcopy
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.db import get_db
from app.diagnosis import (
    QUESTIONNAIRE,
    STEP_IDS,
    DiagnosisDirectionOut,
    DiagnosisError,
    DiagnosisOut,
    DiagnosisQuestionnaire,
    SaveDiagnosisStepRequest,
    StartDiagnosisRequest,
    StepId,
    completed_steps,
    direction_for,
    validate_answer,
)
from app.errors import NOT_FOUND, ApiError
from app.models import Diagnosis, User
from app.security import require_job_seeker

router = APIRouter(tags=["Diagnosis"], responses={
    "4XX": {"model": DiagnosisError, "description": "Validation returns 400, not 422."},
    400: {"model": DiagnosisError, "description": "Invalid questionnaire or step input."},
    401: {"model": DiagnosisError, "description": "Authentication required."},
    403: {"model": DiagnosisError, "description": "Job Seeker role required."},
    404: {"model": DiagnosisError, "description": "Diagnosis not found for this account."},
    409: {"model": DiagnosisError, "description": "Stale revision or step out of order."},
})


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def _out(record: Diagnosis) -> DiagnosisOut:
    done = completed_steps(record.answers)
    return DiagnosisOut(
        id=record.id, questionnaire_version=record.questionnaire_version,
        revision=record.revision, status="answers_complete" if len(done) == 5 else "in_progress",
        current_step=len(done) + 1, completed_steps=done, answers=record.answers,
        created_at=record.created_at, updated_at=record.updated_at,
    )


def _owned(db: Session, user: User, diagnosis_id: str) -> Diagnosis:
    record = db.scalar(select(Diagnosis).where(
        Diagnosis.id == diagnosis_id, Diagnosis.job_seeker_id == user.id,
    ))
    if record is None:
        # Same result for another person's UUID and one that does not exist.
        raise ApiError(404, NOT_FOUND, "Diagnosis not found.")
    return record


@router.get(
    "/me/diagnosis/questionnaire", response_model=DiagnosisQuestionnaire,
    operation_id="getDiagnosisQuestionnaire",
    openapi_extra={"x-requirement-ids": ["US-10", "US-11"]},
)
def get_questionnaire(
    response: Response, user: User = Depends(require_job_seeker),
) -> DiagnosisQuestionnaire:
    _private(response)
    return QUESTIONNAIRE


@router.post(
    "/me/diagnosis", response_model=DiagnosisOut, response_model_exclude_none=True,
    operation_id="startDiagnosis", openapi_extra={"x-requirement-ids": ["US-09"]},
)
def start_diagnosis(
    payload: StartDiagnosisRequest, response: Response,
    user: User = Depends(require_job_seeker), db: Session = Depends(get_db),
) -> DiagnosisOut:
    """Create once or resume: opening the entry must never reset confirmed answers."""
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        insert = pg_insert
    elif dialect == "sqlite":
        insert = sqlite_insert
    else:
        raise RuntimeError("Unsupported diagnosis database")
    now = datetime.now(UTC)
    try:
        db.execute(insert(Diagnosis).values(
            job_seeker_id=user.id, questionnaire_version=payload.questionnaire_version,
            answers={}, revision=0, created_at=now, updated_at=now,
        ).on_conflict_do_nothing(index_elements=[Diagnosis.job_seeker_id]))
        record = db.scalar(select(Diagnosis).where(Diagnosis.job_seeker_id == user.id))
        if record.questionnaire_version != payload.questionnaire_version:
            raise ApiError(409, "INVALID_STATE_TRANSITION", "Reload the saved questionnaire.")
        result = _out(record)
        db.commit()
    except Exception:
        db.rollback()
        raise
    _private(response)
    return result


@router.get(
    "/me/diagnosis", response_model=DiagnosisOut, response_model_exclude_none=True,
    operation_id="getOwnDiagnosis", openapi_extra={"x-requirement-ids": ["US-09", "US-11"]},
)
def get_own_diagnosis(
    response: Response, user: User = Depends(require_job_seeker), db: Session = Depends(get_db),
) -> DiagnosisOut:
    record = db.scalar(select(Diagnosis).where(Diagnosis.job_seeker_id == user.id))
    if record is None:
        raise ApiError(404, NOT_FOUND, "Diagnosis not found.")
    _private(response)
    return _out(record)


@router.get(
    "/diagnoses/{diagnosisId}", response_model=DiagnosisOut, response_model_exclude_none=True,
    operation_id="getDiagnosis", openapi_extra={"x-requirement-ids": ["US-09", "US-11"]},
)
def get_diagnosis(
    diagnosis_id: Annotated[str, Path(alias="diagnosisId", max_length=64)], response: Response,
    user: User = Depends(require_job_seeker), db: Session = Depends(get_db),
) -> DiagnosisOut:
    record = _owned(db, user, diagnosis_id)
    _private(response)
    return _out(record)


@router.get(
    "/diagnoses/{diagnosisId}/direction", response_model=DiagnosisDirectionOut,
    operation_id="getDiagnosisDirection", openapi_extra={"x-requirement-ids": ["US-12"]},
)
def get_diagnosis_direction(
    diagnosis_id: Annotated[str, Path(alias="diagnosisId", max_length=64)], response: Response,
    user: User = Depends(require_job_seeker), db: Session = Depends(get_db),
) -> DiagnosisDirectionOut:
    """Return only a confirmed result; incomplete progress never becomes advice."""
    record = _owned(db, user, diagnosis_id)
    missing = [step for step in STEP_IDS if step not in record.answers]
    if missing:
        raise ApiError(
            409,
            "INVALID_STATE_TRANSITION",
            "Complete the diagnosis before requesting your Yoir Direction.",
            {"missingSteps": ", ".join(missing)},
        )
    result = direction_for(
        record.answers,
        diagnosis_id=record.id,
        questionnaire_version=record.questionnaire_version,
        source_revision=record.revision,
    )
    _private(response)
    return result


@router.put(
    "/diagnoses/{diagnosisId}/steps/{stepId}", response_model=DiagnosisOut,
    response_model_exclude_none=True, operation_id="saveDiagnosisStep",
    openapi_extra={"x-requirement-ids": ["US-10", "US-11"]},
)
def save_step(
    diagnosis_id: Annotated[str, Path(alias="diagnosisId", max_length=64)],
    step_id: Annotated[StepId, Path(alias="stepId")],
    payload: SaveDiagnosisStepRequest, response: Response,
    user: User = Depends(require_job_seeker), db: Session = Depends(get_db),
) -> DiagnosisOut:
    record = _owned(db, user, diagnosis_id)
    if record.questionnaire_version != payload.questionnaire_version:
        raise ApiError(409, "INVALID_STATE_TRANSITION", "Reload the saved questionnaire.")
    if record.revision != payload.expected_revision:
        raise ApiError(409, "INVALID_STATE_TRANSITION",
                       "Your diagnosis has changed. Reload it before saving again.",
                       {"expectedRevision": "Use the latest saved revision."})
    validate_answer(step_id, payload)
    done = completed_steps(record.answers)
    question = next(item for item in QUESTIONNAIRE.steps if item.id == step_id)
    if question.step > len(done) + 1:
        raise ApiError(409, "INVALID_STATE_TRANSITION", "Save the earlier steps first.",
                       {"stepId": "Complete the steps in order."})

    answers = deepcopy(record.answers)
    answers[step_id] = payload.value
    other = dict(answers.get("other", {}))
    other.pop(step_id, None)
    if payload.other is not None:
        other[step_id] = payload.other
    answers["other"] = other
    now = datetime.now(UTC)
    try:
        # Compare-and-swap, not a Python-only check: a second device must not
        # replace answers written after our read. Works on SQLite and PostgreSQL.
        changed = db.execute(update(Diagnosis).where(
            Diagnosis.id == record.id, Diagnosis.job_seeker_id == user.id,
            Diagnosis.revision == payload.expected_revision,
        ).values(answers=answers, revision=payload.expected_revision + 1, updated_at=now)
          .execution_options(synchronize_session=False))
        if changed.rowcount != 1:
            raise ApiError(409, "INVALID_STATE_TRANSITION",
                           "Your diagnosis has changed. Reload it before saving again.",
                           {"expectedRevision": "Use the latest saved revision."})
        # Build before commit; no post-commit database read can misreport a save.
        result = _out(Diagnosis(
            id=record.id, questionnaire_version=record.questionnaire_version,
            answers=answers, revision=payload.expected_revision + 1,
            created_at=record.created_at, updated_at=now,
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    _private(response)
    return result
