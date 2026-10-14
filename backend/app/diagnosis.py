"""Versioned validation and direction rules for the shipped diagnosis form.

The five answer steps mirror frontend/src/diagnosis/model.ts. Step six is a result,
not a sixth answer. The direction rules deliberately mirror that frontend model so
the same saved answers cannot produce different advice on different clients. This
is not the client's full topic bank or an AI matching engine; new branching or
recommendation rules require an explicitly versioned update.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints

from app.errors import VALIDATION_ERROR, ApiError
from app.schemas import CamelModel

QUESTIONNAIRE_VERSION = "yoir-six-step-v1"
QuestionnaireVersion = Literal["yoir-six-step-v1"]
DIRECTION_RULE_VERSION = "yoir-direction-v1"
StepId = Literal["now", "goal", "tried", "stuck", "barriers"]
STEP_IDS: tuple[StepId, ...] = ("now", "goal", "tried", "stuck", "barriers")
OptionValue = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64)]
DirectionAreaTitle = Literal[
    "Career direction",
    "Job search strategy",
    "Resume and applications",
    "Interview skills",
    "Getting your experience recognised",
    "Networking and LinkedIn",
    "Study and upskilling pathway",
]
DirectionText = Annotated[str, StringConstraints(min_length=1)]
MatchingWeight = Annotated[int, Field(strict=True, ge=1, le=10)]


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


class DiagnosisDirectionOut(CamelModel):
    """US-12 result derived from one confirmed revision of the Job Seeker's answers."""

    diagnosis_id: str
    questionnaire_version: QuestionnaireVersion
    source_revision: int = Field(ge=5)
    rule_version: Literal["yoir-direction-v1"]
    area: DirectionAreaTitle
    summary: DirectionText
    suggested_steps: Annotated[list[DirectionText], Field(min_length=3, max_length=5)]
    matching_weights: dict[str, MatchingWeight]


@dataclass(frozen=True)
class _DirectionArea:
    title: str
    summary: str
    steps: tuple[str, ...]
    keywords: tuple[str, ...]
    tried: tuple[str, ...] = ()


_AREAS = {
    "direction": _DirectionArea(
        title="Career direction",
        summary=(
            "Get clear on the roles that fit your skills, interests and circumstances "
            "before you put more time into applications."
        ),
        steps=(
            "List the roles you have enjoyed and the skills you used in them.",
            "Shortlist two or three directions worth exploring.",
            "Talk them through with a Career Professional who can test the options with you.",
        ),
        keywords=("career", "strategy", "direction", "transition", "plan"),
    ),
    "search": _DirectionArea(
        title="Job search strategy",
        summary=(
            "Turn your job search into a focused plan so the effort you put in leads "
            "to interviews."
        ),
        steps=(
            "Choose a short list of target roles and employers.",
            "Set a weekly rhythm for applications, networking and follow-ups.",
            "Review what has and has not worked with a Career Professional.",
        ),
        keywords=("job search", "search", "plan", "applications", "networking", "follow"),
        tried=("applications",),
    ),
    "applications": _DirectionArea(
        title="Resume and applications",
        summary=(
            "Make your resume, cover letters and selection criteria responses show clearly "
            "why you fit the role."
        ),
        steps=(
            "Tailor your resume to one target role at a time.",
            "Show results, not just duties, for each role you have held.",
            "Get detailed feedback on a real application before you send the next one.",
        ),
        keywords=("resume", "cover letter", "application", "selection criteria", "recruiter"),
        tried=("resume", "applications"),
    ),
    "interview": _DirectionArea(
        title="Interview skills",
        summary=(
            "Build confidence and clear, structured answers so your interviews turn "
            "into offers."
        ),
        steps=(
            "Prepare five or six examples from your experience using the STAR method.",
            "Practise answering out loud, ideally in a mock interview.",
            "Ask for specific feedback on both what you say and how you say it.",
        ),
        keywords=("interview", "behavioural", "mock", "screening", "confidence"),
        tried=("interview",),
    ),
    "recognition": _DirectionArea(
        title="Getting your experience recognised",
        summary=(
            "Make sure employers understand, and value, the qualifications and experience "
            "you bring from elsewhere."
        ),
        steps=(
            "Check whether your occupation needs a skills assessment, registration or licence.",
            "Describe your experience in the role titles and terms local employers use.",
            "Get advice from a Career Professional who works with people moving "
            "countries or industries.",
        ),
        keywords=("migrant", "overseas", "qualification", "recognition", "licensing"),
        tried=("recognition",),
    ),
    "network": _DirectionArea(
        title="Networking and LinkedIn",
        summary=(
            "Grow the professional network and online presence that lead to opportunities."
        ),
        steps=(
            "Update your LinkedIn headline and About section for the roles you want.",
            "Reach out to two people a week who work in your target field.",
            "Have your profile reviewed for search and recruiter appeal.",
        ),
        keywords=("linkedin", "networking", "profile", "headline", "brand"),
        tried=("networking", "linkedin"),
    ),
    "study": _DirectionArea(
        title="Study and upskilling pathway",
        summary=(
            "Choose a course or pathway that leads to the work you want, not just to a "
            "qualification."
        ),
        steps=(
            "Note the skills employers ask for in the roles you are aiming for.",
            "Compare courses on outcomes, time and cost.",
            "Talk to a Career Professional before you enrol.",
        ),
        keywords=("study", "course", "upskill", "career", "plan"),
        tried=("study",),
    ),
}

_AREA_FOR_STUCK = {
    "direction": "direction", "search": "search", "resume": "applications",
    "cover_letter": "applications", "ksc": "applications", "interview": "interview",
    "market": "search", "recognition": "recognition", "networking": "network",
    "linkedin": "network", "study": "study",
}
_AREA_FOR_GOAL = {
    "find_job": "search", "more_interviews": "applications", "resume": "applications",
    "interview": "interview", "options": "direction", "course": "study",
    "recognition": "recognition", "network": "network", "linkedin": "network",
}
_AREA_FOR_NOW = {
    "job": "search", "change": "direction", "study": "study", "returning": "search",
    "direction": "direction",
}
_BARRIER_STEPS = {
    "work_rights": (
        "Confirm the work conditions of your visa, so you target roles you are eligible for."
    ),
    "recognition": (
        "Find out which body assesses qualifications in your field and start early, "
        "as it can take time."
    ),
    "licensing": (
        "Check whether your occupation needs registration or a licence where you want to work."
    ),
    "market": "Learn how hiring works in your target industry and location.",
    "local_network": (
        "Build local experience and contacts through volunteering, industry events "
        "or short contracts."
    ),
}
_AREA_FOR_BARRIER = {
    "work_rights": "recognition", "recognition": "recognition",
    "licensing": "recognition", "market": "search", "local_network": "network",
}
_MAIN_WEIGHT = 10


def direction_for(
    answers: dict, *, diagnosis_id: str, questionnaire_version: str, source_revision: int,
) -> DiagnosisDirectionOut:
    """Apply the versioned, deterministic frontend rules to confirmed saved answers."""
    main = (
        _AREA_FOR_STUCK.get(answers["stuck"])
        or _AREA_FOR_GOAL.get(answers["goal"])
        or _AREA_FOR_NOW.get(answers["now"])
        or "direction"
    )
    area = _AREAS[main]
    weights: dict[str, int] = {}

    def add(area_id: str | None, weight: int) -> None:
        if area_id is None:
            return
        for keyword in _AREAS[area_id].keywords:
            weights[keyword] = max(weights.get(keyword, 0), weight)

    add(_AREA_FOR_GOAL.get(answers["goal"]), 1)
    barriers = answers["barriers"]
    for barrier in barriers:
        add(_AREA_FOR_BARRIER.get(barrier), 1)
    add(main, _MAIN_WEIGHT)

    already_tried = any(item in answers["tried"] for item in area.tried)
    summary = area.summary
    if already_tried:
        summary += (
            " You have already put work into this, so expert feedback is the fastest way forward."
        )
    barrier_steps = [_BARRIER_STEPS[item] for item in barriers if item in _BARRIER_STEPS][:2]
    return DiagnosisDirectionOut(
        diagnosis_id=diagnosis_id,
        questionnaire_version=questionnaire_version,
        source_revision=source_revision,
        rule_version=DIRECTION_RULE_VERSION,
        area=area.title,
        summary=summary,
        suggested_steps=[*area.steps, *barrier_steps],
        matching_weights=weights,
    )


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
