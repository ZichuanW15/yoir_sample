"""Versioned validation for the currently shipped, non-branching diagnosis form.

The five answer steps mirror frontend/src/diagnosis/model.ts. Step six is a result,
not a sixth answer. This is not the client's full topic bank or a matching engine;
new branching rules require an explicitly versioned questionnaire update.
"""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints

from app.errors import VALIDATION_ERROR, ApiError
from app.schemas import CamelModel

QUESTIONNAIRE_VERSION = "yoir-six-step-v1"
QuestionnaireVersion = Literal["yoir-six-step-v1"]
StepId = Literal["now", "goal", "tried", "stuck", "barriers"]
STEP_IDS: tuple[StepId, ...] = ("now", "goal", "tried", "stuck", "barriers")
OptionValue = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64)]


class DiagnosisOption(CamelModel):
    id: str
    label: str


class DiagnosisQuestion(CamelModel):
    id: StepId
    step: int
    title: str
    multiple: bool
    options: list[DiagnosisOption]
    other_allowed: bool


class DiagnosisResultStep(CamelModel):
    step: Literal[6] = 6
    title: Literal["Your Yoir Direction"] = "Your Yoir Direction"
    requires_answers: Literal[True] = True


class DiagnosisQuestionnaire(CamelModel):
    version: QuestionnaireVersion = QUESTIONNAIRE_VERSION
    total_steps: Literal[6] = 6
    steps: list[DiagnosisQuestion]
    result_step: DiagnosisResultStep = Field(default_factory=DiagnosisResultStep)


def _question(step_id: StepId, title: str, choices: list[tuple[str, str]],
              *, multiple: bool = False) -> DiagnosisQuestion:
    return DiagnosisQuestion(
        id=step_id, step=STEP_IDS.index(step_id) + 1, title=title, multiple=multiple,
        options=[DiagnosisOption(id=value, label=label) for value, label in choices],
        other_allowed=any(value == "other" for value, _ in choices),
    )


QUESTIONNAIRE = DiagnosisQuestionnaire(steps=[
    _question("now", "Where are you now?", [
        ("job", "Looking for a job"),
        ("change", "Thinking about changing careers"),
        ("study", "Looking to upskill or study"),
        ("returning", "Returning to work"),
        ("direction", "Not sure what career direction to take"),
        ("other", "Something else"),
    ]),
    _question("goal", "What are you trying to achieve?", [
        ("find_job", "Find a job"),
        ("more_interviews", "Get more interviews"),
        ("resume", "Improve my resume/application"),
        ("interview", "Prepare for interviews"),
        ("options", "Understand my career options"),
        ("course", "Find the right course or study pathway"),
        ("recognition", "Get overseas qualifications/skills recognised"),
        ("network", "Build my professional network"),
        ("linkedin", "Improve my LinkedIn"),
        ("other", "Something else"),
    ]),
    _question("tried", "What have you tried so far?", [
        ("applications", "Job applications"),
        ("resume", "Resume/application changes"),
        ("interview", "Interview preparation"),
        ("study", "Study/course research"),
        ("networking", "Networking"),
        ("linkedin", "LinkedIn"),
        ("recognition", "Skills/qualification recognition"),
        ("other", "Other"),
    ], multiple=True),
    _question("stuck", "Where are you getting stuck?", [
        ("direction", "Career direction"),
        ("search", "Job search"),
        ("resume", "Resume"),
        ("cover_letter", "Cover letter/application"),
        ("ksc", "Key Selection Criteria"),
        ("interview", "Interview"),
        ("market", "Australian job market"),
        ("recognition", "Overseas experience/qualification recognition"),
        ("networking", "Networking"),
        ("linkedin", "LinkedIn"),
        ("study", "Course/study choice"),
        ("not_sure", "Not sure"),
    ]),
    _question("barriers", "Are there any barriers affecting your next step?", [
        ("work_rights", "Work rights"),
        ("recognition", "Qualification recognition"),
        ("licensing", "Registration/licensing"),
        ("market", "Understanding the Australian job market"),
        ("local_network", "Australian experience/network"),
        ("other", "Other"),
        ("not_sure", "Not sure"),
    ], multiple=True),
])


class StartDiagnosisRequest(CamelModel):
    model_config = ConfigDict(extra="forbid")

    questionnaire_version: QuestionnaireVersion


class SaveDiagnosisStepRequest(StartDiagnosisRequest):
    expected_revision: int = Field(strict=True, ge=0)
    value: OptionValue | Annotated[list[OptionValue], Field(max_length=12)] = Field(repr=False)
    other: str | None = Field(default=None, strict=True, max_length=200, repr=False)


class DiagnosisAnswers(CamelModel):
    model_config = ConfigDict(extra="forbid")

    now: str | None = None
    goal: str | None = None
    tried: list[str] | None = None
    stuck: str | None = None
    barriers: list[str] | None = None
    other: dict[StepId, str] = Field(default_factory=dict)


class DiagnosisOut(CamelModel):
    id: str
    questionnaire_version: str
    revision: int
    status: Literal["in_progress", "answers_complete"]
    current_step: int
    total_steps: Literal[6] = 6
    completed_steps: list[StepId]
    answers: DiagnosisAnswers = Field(repr=False)
    created_at: datetime
    updated_at: datetime


class DiagnosisError(CamelModel):
    code: str
    message: str
    field_errors: dict[str, str] | None = None
    request_id: str


def completed_steps(answers: dict) -> list[StepId]:
    """Only explicitly saved, consecutive answers count as completed steps."""
    completed: list[StepId] = []
    for step in STEP_IDS:
        if step not in answers:
            break
        completed.append(step)
    return completed


def validate_answer(step_id: StepId, payload: SaveDiagnosisStepRequest) -> None:
    question = QUESTIONNAIRE.steps[STEP_IDS.index(step_id)]
    value = payload.value
    choices = {option.id for option in question.options}
    if question.multiple:
        valid = (
            isinstance(value, list) and len(value) == len(set(value))
            and all(item in choices for item in value)
        )
    else:
        valid = isinstance(value, str) and value in choices
    if not valid:
        raise ApiError(400, VALIDATION_ERROR, "Choose valid answers for this step.",
                       {"value": "Use the listed options and the correct answer type."})
    selected = value if isinstance(value, list) else [value]
    if payload.other is not None and "other" not in selected:
        raise ApiError(400, VALIDATION_ERROR, "Additional text needs the Other option.",
                       {"other": "Select Other before submitting additional text."})
