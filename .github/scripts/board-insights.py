#!/usr/bin/env python3
"""Generate the Project Board insights block for the repository Wiki.

The generator reads organisation ProjectV2 number 6 through GitHub's GraphQL
API. It can either print/write a standalone generated block or replace exactly
one existing marker-delimited block in a Wiki Markdown file.

No third-party Python packages are required.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import math
import os
import socket
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, MutableMapping, Optional, Sequence
from zoneinfo import ZoneInfo


ORG = "swen90014-2026-sm2"
PROJECT_NUMBER = 6
BOARD_URL = f"https://github.com/orgs/{ORG}/projects/{PROJECT_NUMBER}"

START_MARKER = "<!-- board-insights:start -->"
END_MARKER = "<!-- board-insights:end -->"

STATUS_FIELD = "Status"
STORY_POINTS_FIELD = "Story Points"
SPRINT_FIELD = "Sprint"
EPIC_FIELD = "Epic"
WORK_TYPE_FIELD = "Work Type"
PRIORITY_FIELD = "Priority"

BACKLOG_STATUS = "Product Backlog"
FLOW_STATUSES = ("Sprint Backlog", "In Progress", "Blocked", "Under Review")

ITEM_PAGE_SIZE = 100
FIELD_VALUE_PAGE_SIZE = 100
MAX_ITEM_PAGES = 1_000
GRAPHQL_TIMEOUT_SECONDS = 20
GRAPHQL_MAX_ATTEMPTS = 3
MAX_RETRY_DELAY_SECONDS = 10.0
TRANSIENT_HTTP_STATUSES = frozenset({429, 500, 502, 503, 504})
LOCAL_TIMEZONE_NAME = "Australia/Melbourne"
LOCAL_TIMEZONE = ZoneInfo(LOCAL_TIMEZONE_NAME)
MAX_TEXT_LENGTH = 160

GRAPHQL_QUERY = """
query($org: String!, $number: Int!, $cursor: String) {
  organization(login: $org) {
    projectV2(number: $number) {
      title updatedAt
      fields(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename
          ... on ProjectV2Field { name dataType }
          ... on ProjectV2SingleSelectField {
            name
            options { name }
          }
          ... on ProjectV2IterationField {
            name
            configuration {
              iterations { title startDate duration }
              completedIterations { title startDate duration }
            }
          }
        }
      }
      items(first: 100, after: $cursor) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content {
            __typename
            ... on Issue { id number title state createdAt updatedAt closedAt url parent { number } }
          }
          fieldValues(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes {
              __typename
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2FieldCommon { name } }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title startDate duration
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}
"""


class BoardInsightsError(RuntimeError):
    """A safe, user-facing failure while reading or rendering board data."""


GraphqlFn = Callable[[str, Mapping[str, Any], str], Mapping[str, Any]]


def _clean_text(value: Any, fallback: str = "Unnamed", limit: int = MAX_TEXT_LENGTH) -> str:
    """Return bounded single-line text with control/bidi characters removed."""

    raw = str(value or "")
    cleaned = "".join(
        " " if unicodedata.category(character).startswith("C") else character
        for character in raw
    )
    cleaned = " ".join(cleaned.split())
    if not cleaned:
        return fallback
    if len(cleaned) > limit:
        return cleaned[: max(limit - 1, 1)].rstrip() + "…"
    return cleaned


def _safe_diagnostic(value: Any, token: str = "") -> str:
    """Bound untrusted API/network text and remove the active credential."""

    text = _clean_text(value, fallback="unknown error", limit=300)
    if token:
        text = text.replace(token, "***")
    return text


def _date(value: Optional[str]) -> Optional[dt.date]:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value[:10])
    except (TypeError, ValueError) as exc:
        raise BoardInsightsError("GitHub returned an invalid date value.") from exc


def _timestamp(value: Optional[str]) -> Optional[dt.datetime]:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise BoardInsightsError("GitHub returned an invalid timestamp value.") from exc
    if parsed.tzinfo is None:
        raise BoardInsightsError("GitHub returned a timestamp without a timezone.")
    return parsed.astimezone(dt.timezone.utc)


def _duration(value: Any) -> Optional[int]:
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        raise BoardInsightsError("GitHub returned an invalid Sprint duration.")
    duration = value
    if duration <= 0:
        raise BoardInsightsError("GitHub returned a non-positive Sprint duration.")
    return duration


def _number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise BoardInsightsError("GitHub returned an invalid Story Points value.")
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise BoardInsightsError("GitHub returned an invalid Story Points value.")
    return number


def _read_response(response: Any) -> Mapping[str, Any]:
    with response as stream:
        payload = json.load(stream)
    if not isinstance(payload, Mapping):
        raise BoardInsightsError("GitHub GraphQL returned a non-object response.")
    return payload


def _connection_nodes(connection: Mapping[str, Any], context: str) -> Sequence[Any]:
    nodes = connection.get("nodes")
    if nodes is None:
        return []
    if not isinstance(nodes, Sequence) or isinstance(nodes, (str, bytes, bytearray)):
        raise BoardInsightsError(f"GitHub returned malformed {context} nodes.")
    return nodes


def _has_next_page(connection: Mapping[str, Any], context: str) -> bool:
    page_info = connection.get("pageInfo")
    if not isinstance(page_info, Mapping) or not isinstance(
        page_info.get("hasNextPage"), bool
    ):
        raise BoardInsightsError(f"GitHub returned malformed {context} pagination.")
    return page_info["hasNextPage"]


def graphql(
    query: str,
    variables: Mapping[str, Any],
    token: str,
    opener: Callable[..., Any] = urllib.request.urlopen,
    sleeper: Callable[[float], None] = time.sleep,
    timeout: int = GRAPHQL_TIMEOUT_SECONDS,
    max_attempts: int = GRAPHQL_MAX_ATTEMPTS,
) -> Mapping[str, Any]:
    """Run one bounded GraphQL request without exposing the credential."""

    if timeout <= 0 or max_attempts <= 0:
        raise ValueError("timeout and max_attempts must be positive")

    request = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode("utf-8"),
        headers={
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "csd-koala-board-insights",
        },
    )

    payload: Mapping[str, Any] | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            payload = _read_response(opener(request, timeout=timeout))
            break
        except urllib.error.HTTPError as exc:
            retryable = exc.code in TRANSIENT_HTTP_STATUSES
            if retryable and attempt < max_attempts:
                retry_after = None
                try:
                    retry_after = (exc.headers or {}).get("Retry-After")
                    delay = float(retry_after) if retry_after is not None else 2 ** (attempt - 1)
                except (TypeError, ValueError):
                    delay = 2 ** (attempt - 1)
                exc.close()
                sleeper(min(max(delay, 0.0), MAX_RETRY_DELAY_SECONDS))
                continue
            try:
                detail = exc.read().decode("utf-8", errors="replace")
            except Exception:  # pragma: no cover - defensive error reporting
                detail = ""
            finally:
                exc.close()
            suffix = f": {_safe_diagnostic(detail, token)}" if detail else ""
            raise BoardInsightsError(
                f"GitHub API returned HTTP {exc.code}{suffix}"
            ) from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            if attempt < max_attempts:
                sleeper(min(float(2 ** (attempt - 1)), MAX_RETRY_DELAY_SECONDS))
                continue
            reason = getattr(exc, "reason", exc)
            raise BoardInsightsError(
                f"Could not reach GitHub GraphQL after {max_attempts} attempts: "
                f"{_safe_diagnostic(reason, token)}"
            ) from exc
        except (json.JSONDecodeError, OSError) as exc:
            raise BoardInsightsError(
                "Could not decode the GitHub GraphQL response."
            ) from exc

    if payload is None:  # pragma: no cover - the loop either returns or raises
        raise BoardInsightsError("GitHub GraphQL did not return a response.")

    errors = payload.get("errors")
    if errors:
        messages = "; ".join(
            _safe_diagnostic(error.get("message", "unknown GraphQL error"), token)
            for error in errors
            if isinstance(error, Mapping)
        )
        raise BoardInsightsError(f"GitHub GraphQL error: {messages or 'unknown error'}")
    data = payload.get("data")
    if not isinstance(data, Mapping):
        raise BoardInsightsError("GitHub GraphQL response did not contain data.")
    return data


def _parse_fields(nodes: Sequence[Mapping[str, Any]]) -> dict[str, dict[str, Any]]:
    fields: dict[str, dict[str, Any]] = {}
    for node in nodes:
        if not isinstance(node, Mapping):
            raise BoardInsightsError("GitHub returned a malformed Project field.")
        name = node.get("name")
        if not name:
            continue
        name = _clean_text(name)
        if name in fields:
            raise BoardInsightsError(
                f"The Project contains duplicate fields named {name!r}; "
                "field values would be ambiguous."
            )
        field: dict[str, Any] = {"type": node.get("__typename")}
        options = node.get("options")
        if options is not None and (
            not isinstance(options, Sequence)
            or isinstance(options, (str, bytes, bytearray))
        ):
            raise BoardInsightsError("GitHub returned malformed Project field options.")
        if options:
            field["options"] = [
                _clean_text(option.get("name"))
                for option in options
                if isinstance(option, Mapping) and option.get("name")
            ]
        configuration = node.get("configuration") or {}
        if not isinstance(configuration, Mapping):
            raise BoardInsightsError("GitHub returned a malformed Sprint configuration.")
        completed_iterations = configuration.get("completedIterations") or []
        current_iterations = configuration.get("iterations") or []
        for values in (completed_iterations, current_iterations):
            if not isinstance(values, Sequence) or isinstance(
                values, (str, bytes, bytearray)
            ):
                raise BoardInsightsError(
                    "GitHub returned a malformed Sprint iteration list."
                )
        iterations = list(completed_iterations)
        iterations.extend(current_iterations)
        if iterations:
            parsed_iterations = []
            for value in iterations:
                if not isinstance(value, Mapping):
                    raise BoardInsightsError("GitHub returned a malformed Sprint iteration.")
                if value.get("title") and value.get("startDate"):
                    parsed_iterations.append(
                        {
                            "title": _clean_text(value.get("title")),
                            "start": _date(value.get("startDate")),
                            "duration": _duration(value.get("duration")),
                        }
                    )
            field["iterations"] = parsed_iterations
        fields[name] = field
    return fields


def _parse_issue(node: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    content = node.get("content") or {}
    if not isinstance(content, Mapping):
        raise BoardInsightsError("GitHub returned malformed Project item content.")
    if content.get("__typename") != "Issue" or not content.get("number"):
        return None

    try:
        issue_number = int(content["number"])
    except (TypeError, ValueError) as exc:
        raise BoardInsightsError("GitHub returned an invalid Issue number.") from exc
    if issue_number <= 0:
        raise BoardInsightsError("GitHub returned an invalid Issue number.")

    state = _clean_text(content.get("state"), fallback="OPEN", limit=20).upper()
    if state not in {"OPEN", "CLOSED"}:
        raise BoardInsightsError("GitHub returned an invalid Issue state.")

    item: dict[str, Any] = {
        "id": _clean_text(content.get("id"), fallback=""),
        "number": issue_number,
        "title": _clean_text(content.get("title"), fallback="Untitled issue"),
        "state": state,
        "created": _date(content.get("createdAt")),
        "updated": _timestamp(content.get("updatedAt")),
        "closed": _date(content.get("closedAt")),
        "url": _clean_text(content.get("url"), fallback="", limit=500),
        "points": None,
        # A sub-issue's points are a task estimate inside its parent story's points,
        # so totals count the parent only (see _sum_points).
        "subissue": isinstance(content.get("parent"), Mapping),
        "status": None,
        "epic": None,
        "work_type": None,
        "priority": None,
        "iteration": None,
    }

    field_values = node.get("fieldValues") or {}
    if not isinstance(field_values, Mapping):
        raise BoardInsightsError(
            f"GitHub returned malformed field values for Issue #{issue_number}."
        )
    if _has_next_page(field_values, f"field-value for Issue #{issue_number}"):
        raise BoardInsightsError(
            f"Issue #{issue_number} has more than {FIELD_VALUE_PAGE_SIZE} Project field values; "
            "refusing to publish a truncated snapshot."
        )

    for value in _connection_nodes(field_values, f"field values for Issue #{issue_number}"):
        if not isinstance(value, Mapping):
            raise BoardInsightsError(
                f"GitHub returned a malformed field value for Issue #{issue_number}."
            )
        field = value.get("field") or {}
        if not isinstance(field, Mapping):
            raise BoardInsightsError(
                f"GitHub returned a malformed field reference for Issue #{issue_number}."
            )
        field_name = field.get("name")
        if field_name == STORY_POINTS_FIELD:
            item["points"] = _number(value.get("number"))
        elif field_name == STATUS_FIELD:
            item["status"] = _clean_text(value.get("name"), fallback="") or None
        elif field_name == EPIC_FIELD:
            item["epic"] = _clean_text(value.get("name"), fallback="") or None
        elif field_name == WORK_TYPE_FIELD:
            item["work_type"] = _clean_text(value.get("name"), fallback="") or None
        elif field_name == PRIORITY_FIELD:
            item["priority"] = _clean_text(value.get("name"), fallback="") or None
        elif field_name == SPRINT_FIELD and value.get("title"):
            item["iteration"] = {
                "title": _clean_text(value["title"]),
                "start": _date(value.get("startDate")),
                "duration": _duration(value.get("duration")),
            }
    return item


def fetch_project(
    token: str,
    graphql_fn: GraphqlFn = graphql,
    *,
    max_pages: int = MAX_ITEM_PAGES,
) -> dict[str, Any]:
    """Fetch all issue items plus field configuration, following pagination."""

    if max_pages <= 0:
        raise ValueError("max_pages must be positive")

    cursor: Optional[str] = None
    seen_cursors: set[str] = set()
    seen_issue_ids: set[str] = set()
    seen_project_item_ids: set[str] = set()
    items: list[dict[str, Any]] = []
    fields: dict[str, dict[str, Any]] = {}
    fields_loaded = False
    title = f"Project {PROJECT_NUMBER}"
    project_title_loaded = False
    skipped_non_issues = 0
    page_count = 0
    raw_item_count = 0
    expected_total_count: Optional[int] = None
    project_updated_at: Optional[dt.datetime] = None
    project_update_loaded = False

    while True:
        page_count += 1
        if page_count > max_pages:
            raise BoardInsightsError(
                f"ProjectV2 item pagination exceeded the safety limit of {max_pages} pages."
            )
        data = graphql_fn(
            GRAPHQL_QUERY,
            {"org": ORG, "number": PROJECT_NUMBER, "cursor": cursor},
            token,
        )
        organization = data.get("organization")
        if not isinstance(organization, Mapping):
            raise BoardInsightsError(
                f"Organisation {ORG!r} was not found or is not accessible."
            )
        project = organization.get("projectV2")
        if not isinstance(project, Mapping):
            raise BoardInsightsError(
                f"ProjectV2 #{PROJECT_NUMBER} was not found or is not accessible in {ORG}."
            )
        observed_title = _clean_text(project.get("title"), fallback=title)
        if not project_title_loaded:
            title = observed_title
            project_title_loaded = True
        elif observed_title != title:
            raise BoardInsightsError(
                "The Project title changed while its paginated snapshot was being read; "
                "rerun the job."
            )
        observed_update = _timestamp(project.get("updatedAt"))
        if not project_update_loaded:
            project_updated_at = observed_update
            project_update_loaded = True
        elif observed_update != project_updated_at:
            raise BoardInsightsError(
                "The Project changed while its paginated snapshot was being read; rerun the job."
            )

        field_connection = project.get("fields") or {}
        if not isinstance(field_connection, Mapping):
            raise BoardInsightsError("GitHub returned malformed Project fields.")
        if _has_next_page(field_connection, "Project-field"):
            raise BoardInsightsError(
                "The Project has more than 100 fields; refusing to publish a truncated snapshot."
            )
        observed_fields = _parse_fields(
            _connection_nodes(field_connection, "Project field")
        )
        if not fields_loaded:
            fields = observed_fields
            fields_loaded = True
        elif observed_fields != fields:
            raise BoardInsightsError(
                "The Project fields changed while its paginated snapshot was being read; "
                "rerun the job."
            )

        page = project.get("items") or {}
        if not isinstance(page, Mapping):
            raise BoardInsightsError("GitHub returned malformed Project items.")
        total_count = page.get("totalCount")
        if not isinstance(total_count, int) or isinstance(total_count, bool):
            raise BoardInsightsError("GitHub returned an invalid Project item count.")
        if total_count < 0:
            raise BoardInsightsError("GitHub returned an invalid Project item count.")
        if expected_total_count is None:
            expected_total_count = total_count
        elif total_count != expected_total_count:
            raise BoardInsightsError(
                "The Project item count changed while its paginated snapshot was being read; "
                "rerun the job."
            )
        for node in _connection_nodes(page, "Project item"):
            if not isinstance(node, Mapping):
                raise BoardInsightsError("GitHub returned a malformed Project item.")
            project_item_id = node.get("id")
            if not isinstance(project_item_id, str) or not project_item_id:
                raise BoardInsightsError("GitHub returned a Project item without an ID.")
            if project_item_id in seen_project_item_ids:
                raise BoardInsightsError(
                    "GitHub returned a duplicate Project item while paginating."
                )
            seen_project_item_ids.add(project_item_id)
            raw_item_count += 1
            item = _parse_issue(node)
            if item is None:
                skipped_non_issues += 1
            else:
                issue_identity = item.get("id") or item.get("url")
                if issue_identity and issue_identity in seen_issue_ids:
                    raise BoardInsightsError(
                        "GitHub returned a duplicate Issue while paginating the Project."
                    )
                if issue_identity:
                    seen_issue_ids.add(str(issue_identity))
                items.append(item)

        if not _has_next_page(page, "Project item"):
            break
        page_info = page["pageInfo"]
        next_cursor = page_info.get("endCursor")
        if not next_cursor:
            raise BoardInsightsError(
                "GitHub returned an invalid ProjectV2 pagination cursor."
            )
        next_cursor = str(next_cursor)
        if next_cursor == cursor or next_cursor in seen_cursors:
            raise BoardInsightsError(
                "GitHub returned a repeated ProjectV2 pagination cursor."
            )
        seen_cursors.add(next_cursor)
        cursor = next_cursor

    if expected_total_count != raw_item_count:
        raise BoardInsightsError(
            "GitHub returned an incomplete Project item snapshot; refusing to publish it."
        )

    items.sort(
        key=lambda item: (
            str(item.get("url") or ""),
            int(item.get("number") or 0),
            str(item.get("id") or ""),
        )
    )
    updated_values = [
        value
        for value in [project_updated_at, *(item.get("updated") for item in items)]
        if isinstance(value, dt.datetime)
    ]

    return {
        "title": title,
        "fields": fields,
        "items": items,
        "skipped_non_issues": skipped_non_issues,
        "source_updated_at": max(updated_values) if updated_values else None,
    }


def _field_warnings(snapshot: Mapping[str, Any]) -> list[str]:
    fields = snapshot.get("fields") or {}
    warnings = []
    for required in (STATUS_FIELD, STORY_POINTS_FIELD, SPRINT_FIELD):
        if required not in fields:
            warnings.append(f"Project field `{required}` was not returned by GitHub.")
    for optional in (EPIC_FIELD, WORK_TYPE_FIELD, PRIORITY_FIELD):
        if optional not in fields:
            warnings.append(
                f"Optional project field `{optional}` was not returned by GitHub."
            )

    statuses = (fields.get(STATUS_FIELD) or {}).get("options") or []
    for expected in (BACKLOG_STATUS,) + FLOW_STATUSES:
        if statuses and expected not in statuses:
            warnings.append(
                f"Configured status `{expected}` is not an option in the board Status field."
            )
    return warnings


def active_sprint(
    snapshot: Mapping[str, Any], today: dt.date
) -> Optional[dict[str, Any]]:
    """Return today's iteration, otherwise the most recently started iteration.

    The returned ``is_active`` flag prevents a historical fallback from being
    presented as if it still spans the snapshot date.
    """

    candidates: dict[tuple[str, dt.date], dict[str, Any]] = {}
    field = (snapshot.get("fields") or {}).get(SPRINT_FIELD) or {}
    for iteration in field.get("iterations") or []:
        if iteration.get("title") and iteration.get("start"):
            key = (str(iteration["title"]), iteration["start"])
            candidates[key] = dict(iteration)
    for item in snapshot.get("items") or []:
        iteration = item.get("iteration")
        if iteration and iteration.get("title") and iteration.get("start"):
            key = (str(iteration["title"]), iteration["start"])
            existing = candidates.get(key, {})
            merged = dict(existing)
            merged.update(
                {
                    name: value
                    for name, value in iteration.items()
                    if value is not None or name not in merged
                }
            )
            candidates[key] = merged

    containing = []
    for iteration in candidates.values():
        duration = iteration.get("duration")
        if not duration:
            continue
        end = iteration["start"] + dt.timedelta(days=int(duration))
        if iteration["start"] <= today < end:
            containing.append(iteration)
    if containing:
        selected = dict(max(containing, key=lambda value: value["start"]))
        selected["is_active"] = True
        return selected

    started = [value for value in candidates.values() if value["start"] <= today]
    if not started:
        return None
    selected = dict(
        max(started, key=lambda value: (value["start"], str(value["title"])))
    )
    selected["is_active"] = False
    return selected


def _sum_points(items: Iterable[Mapping[str, Any]]) -> float:
    return math.fsum(
        float(item.get("points") or 0) for item in items if not item.get("subissue")
    )


def _fmt_number(value: float) -> str:
    number = float(value)
    if not math.isfinite(number):
        raise BoardInsightsError("Cannot render a non-finite numeric value.")
    if abs(number) < 0.00000000005:
        number = 0.0
    text = f"{number:.10f}".rstrip("0").rstrip(".")
    return text or "0"


def _percent(part: float, whole: float) -> str:
    return f"{round(100 * part / whole)}%" if whole else "0%"


def _axis_top(value: float, step: int = 10) -> int:
    return max(step, int(step * math.ceil(float(value) / step)))


def _markdown_text(value: Any) -> str:
    """Escape untrusted Project labels before placing them in Markdown."""

    escaped = html.escape(_clean_text(value), quote=False)
    return (
        escaped.replace("|", "&#124;")
        .replace("\\", "&#92;")
        .replace("`", "&#96;")
        .replace("*", "&#42;")
        .replace("_", "&#95;")
        .replace("~", "&#126;")
        .replace("[", "&#91;")
        .replace("]", "&#93;")
    )


def _mermaid_label(value: Any) -> str:
    """Conservatively reduce untrusted text to Mermaid-safe label content."""

    text = _clean_text(value, limit=100)
    safe_punctuation = frozenset(" .,:!?_@+-/()'")
    cleaned = "".join(
        character
        if character.isalnum() or character in safe_punctuation
        else " "
        for character in text
    )
    return " ".join(cleaned.split()) or "Unnamed"


def _status_order(snapshot: Mapping[str, Any], sprint_name: Optional[str]) -> list[str]:
    configured = list(
        ((snapshot.get("fields") or {}).get(STATUS_FIELD) or {}).get("options") or []
    )
    observed = [
        item.get("status") for item in snapshot.get("items") or [] if item.get("status")
    ]
    preferred = [BACKLOG_STATUS, *FLOW_STATUSES]
    if sprint_name:
        preferred.append(sprint_name)
    result = []
    for name in [*preferred, *configured, *observed]:
        if name and name not in result:
            result.append(str(name))
    return result


def _warning_lines(
    snapshot: Mapping[str, Any], sprint: Optional[Mapping[str, Any]]
) -> list[str]:
    items = list(snapshot.get("items") or [])
    warnings = _field_warnings(snapshot)
    skipped = int(snapshot.get("skipped_non_issues") or 0)
    if skipped:
        warnings.append(
            f"Skipped {skipped} non-Issue project item(s), such as draft items or pull requests."
        )
    no_status = sum(1 for item in items if not item.get("status"))
    if no_status:
        warnings.append(f"{no_status} Issue item(s) have no Status value.")
    no_points = sum(1 for item in items if item.get("points") is None)
    if no_points:
        warnings.append(f"{no_points} Issue item(s) have no Story Points value.")
    if sprint is None:
        warnings.append(
            "No current or previously started Sprint iteration could be identified."
        )
    else:
        if not sprint.get("is_active", False):
            warnings.append(
                "No Sprint iteration spans the snapshot date; the most recently started "
                "iteration is shown as a historical fallback."
            )
        flow_without_iteration = sum(
            1
            for item in items
            if item.get("status") in (*FLOW_STATUSES, sprint["title"])
            and not item.get("iteration")
        )
        if flow_without_iteration:
            warnings.append(
                f"{flow_without_iteration} sprint-flow item(s) have no Sprint iteration value."
            )
    return warnings


def _write_chart(
    out: list[str],
    title: str,
    labels: Sequence[str],
    values: Sequence[float],
    y_label: str = "Story points",
) -> None:
    if not labels or not any(values):
        out.extend(["_No pointed items are available for this chart._", ""])
        return
    top = _axis_top(max(values))
    out.extend(
        [
            "```mermaid",
            "xychart-beta",
            f'    title "{_mermaid_label(title)}"',
            "    x-axis ["
            + ", ".join(f'"{_mermaid_label(label)}"' for label in labels)
            + "]",
            f'    y-axis "{_mermaid_label(y_label)}" 0 --> {top}',
            "    bar [" + ", ".join(_fmt_number(value) for value in values) + "]",
            "```",
            "",
        ]
    )


def _build_status_section(
    out: list[str], snapshot: Mapping[str, Any], sprint: Optional[Mapping[str, Any]]
) -> None:
    items = list(snapshot.get("items") or [])
    sprint_name = str(sprint["title"]) if sprint else None
    order = _status_order(snapshot, sprint_name)
    groups: MutableMapping[str, list[Mapping[str, Any]]] = defaultdict(list)
    for item in items:
        groups[str(item.get("status") or "Unassigned")].append(item)
    shown = [name for name in order if groups[name]]
    if groups["Unassigned"]:
        shown.append("Unassigned")

    out.extend(["### 7.1 Where the work sits", ""])
    _write_chart(
        out,
        "Story points by board column",
        shown,
        [_sum_points(groups[name]) for name in shown],
    )
    out.extend(
        [
            "| Column | Issues | Story points | Share of pointed scope |",
            "|---|---:|---:|---:|",
        ]
    )
    total = _sum_points(items)
    if shown:
        for name in shown:
            points = _sum_points(groups[name])
            label = f"{name} (Done)" if sprint_name and name == sprint_name else name
            out.append(
                f"| {_markdown_text(label)} | {len(groups[name])} | "
                f"{_fmt_number(points)} | {_percent(points, total)} |"
            )
    else:
        out.append("| No status data | 0 | 0 | 0% |")
    out.extend(
        [
            "",
            "**Observed result.** This distribution is a snapshot of the current Status values. "
            "It describes where board items are now; it does not prove delivery, acceptance or carry-over.",
            "",
        ]
    )


def _build_epic_section(out: list[str], snapshot: Mapping[str, Any]) -> None:
    backlog = [
        item
        for item in snapshot.get("items") or []
        if item.get("status") == BACKLOG_STATUS
    ]
    groups: MutableMapping[str, list[Mapping[str, Any]]] = defaultdict(list)
    for item in backlog:
        groups[str(item.get("epic") or "Unassigned")].append(item)
    ranked = sorted(
        groups.items(),
        key=lambda pair: (-_sum_points(pair[1]), pair[0].casefold(), pair[0]),
    )

    out.extend(["### 7.2 What the product backlog is made of", ""])
    _write_chart(
        out,
        "Product backlog story points by epic",
        [name for name, _ in ranked],
        [_sum_points(group) for _, group in ranked],
    )
    out.extend(["| Epic | Stories | Story points |", "|---|---:|---:|"])
    if ranked:
        for name, group in ranked:
            out.append(
                f"| {_markdown_text(name)} | {len(group)} | "
                f"{_fmt_number(_sum_points(group))} |"
            )
    else:
        out.append("| No product-backlog epic data | 0 | 0 |")
    out.extend(
        [
            "",
            "**Observed result.** Epic totals include only items currently in the Product Backlog "
            "column. Unassigned values remain visible instead of being inferred.",
            "",
        ]
    )


def _build_sprint_section(
    out: list[str], snapshot: Mapping[str, Any], sprint: Optional[Mapping[str, Any]]
) -> list[Mapping[str, Any]]:
    out.extend(["### 7.3 Current sprint state", ""])
    if sprint is None:
        out.extend(
            [
                "_Sprint status is unavailable because no active or previously started iteration "
                "could be identified from the board._",
                "",
            ]
        )
        return []

    sprint_name = str(sprint["title"])
    safe_sprint_name = _markdown_text(sprint_name)
    items = [
        item
        for item in snapshot.get("items") or []
        if _is_sprint_item(item, sprint_name)
    ]
    groups: MutableMapping[str, list[Mapping[str, Any]]] = defaultdict(list)
    for item in items:
        groups[str(item.get("status") or "Unassigned")].append(item)
    order = []
    for name in [sprint_name, *reversed(FLOW_STATUSES), "Unassigned"]:
        if name not in order:
            order.append(name)
    for item in items:
        status = str(item.get("status") or "Unassigned")
        if status not in order:
            order.append(status)
    states = [
        ("Done" if name == sprint_name else name, _sum_points(groups[name]))
        for name in order
    ]

    if not sprint.get("is_active", False):
        out.extend(
            [
                f"_No iteration spans the snapshot date; showing the most recently started "
                f"iteration, **{safe_sprint_name}**, as a historical fallback._",
                "",
            ]
        )

    if any(value for _, value in states):
        out.extend(
            [
                "```mermaid",
                "pie showData",
                f"    title {_mermaid_label(sprint_name)} work by state",
            ]
        )
        for label, value in states:
            if value:
                out.append(f'    "{_mermaid_label(label)}" : {_fmt_number(value)}')
        out.extend(["```", ""])
    else:
        out.extend(["_No pointed sprint items are available for this chart._", ""])

    out.extend(["| State | Issues | Story points |", "|---|---:|---:|"])
    for name in order:
        if groups[name]:
            label = "Done" if name == sprint_name else name
            out.append(
                f"| {_markdown_text(label)} | {len(groups[name])} | "
                f"{_fmt_number(_sum_points(groups[name]))} |"
            )
    if not items:
        out.append("| No sprint-flow data | 0 | 0 |")

    total = _sum_points(items)
    done = _sum_points(groups[sprint_name])
    review = _sum_points(groups["Under Review"])
    out.extend(
        [
            "",
            f"**Observed result.** {_fmt_number(done)} of {_fmt_number(total)} pointed SP are in "
            f"the **{safe_sprint_name}** done column and {_fmt_number(review)} SP are under review. "
            "Board placement is not treated as proof that acceptance criteria passed.",
            "",
        ]
    )
    return items


def _is_sprint_item(item: Mapping[str, Any], sprint_name: str) -> bool:
    """Associate flow items with the detected sprint without crossing iterations."""

    status = item.get("status")
    iteration_title = (item.get("iteration") or {}).get("title")
    if iteration_title:
        return bool(iteration_title == sprint_name)
    return bool(status == sprint_name or status in FLOW_STATUSES)


def _build_estimate_section(
    out: list[str],
    snapshot: Mapping[str, Any],
    sprint_items: Sequence[Mapping[str, Any]],
) -> None:
    items = list(snapshot.get("items") or [])
    backlog = [item for item in items if item.get("status") == BACKLOG_STATUS]
    pointed = [item for item in items if item.get("points") is not None]
    backlog_sizes = Counter(
        float(item["points"]) for item in backlog if item.get("points") is not None
    )
    sprint_sizes = Counter(
        float(item["points"]) for item in sprint_items if item.get("points") is not None
    )
    all_sizes = sorted({float(item["points"]) for item in pointed})

    out.extend(["### 7.4 Estimate-size distribution", ""])
    _write_chart(
        out,
        f"Tracked items by estimate size ({len(pointed)} pointed issues)",
        [f"{_fmt_number(size)} SP" for size in all_sizes],
        [
            float(sum(1 for item in pointed if float(item["points"]) == size))
            for size in all_sizes
        ],
        y_label="Issues",
    )
    out.extend(
        [
            "| Size | Product backlog | Current sprint | All board Issues |",
            "|---|---:|---:|---:|",
        ]
    )
    if all_sizes:
        for size in all_sizes:
            total = sum(1 for item in pointed if float(item["points"]) == size)
            out.append(
                f"| {_fmt_number(size)} SP | {backlog_sizes[size]} | {sprint_sizes[size]} | {total} |"
            )
    else:
        out.append("| No estimate data | 0 | 0 | 0 |")
    unpointed = sum(1 for item in items if item.get("points") is None)
    out.extend(
        [
            "",
            f"**Observed result.** {len(pointed)} Issue item(s) are pointed and {unpointed} "
            f"{'is' if unpointed == 1 else 'are'} "
            "unpointed. This chart reports the distribution without deciding whether an estimate "
            "is appropriately sized.",
            "",
        ]
    )


def _build_burndown_section(
    out: list[str],
    sprint: Optional[Mapping[str, Any]],
    sprint_items: Sequence[Mapping[str, Any]],
    today: dt.date,
) -> None:
    out.extend(["### 7.5 Current sprint burndown", ""])
    if sprint is None or not sprint.get("start") or not sprint.get("duration"):
        out.extend(
            ["_Burndown is unavailable because the Sprint dates are incomplete._", ""]
        )
        return

    start = sprint["start"]
    end = start + dt.timedelta(days=int(sprint["duration"]) - 1)
    last = min(max(today, start), end)
    days = [
        start + dt.timedelta(days=offset) for offset in range((last - start).days + 1)
    ]
    total = _sum_points(sprint_items)
    span = max((end - start).days, 1)
    ideal = [round(total * (1 - ((day - start).days / span)), 10) for day in days]
    remaining = [
        _sum_points(
            item
            for item in sprint_items
            if (not item.get("created") or item["created"] <= day)
            and (not item.get("closed") or item["closed"] > day)
        )
        for day in days
    ]

    if days and total:
        out.extend(
            [
                "```mermaid",
                "xychart-beta",
                f'    title "{_mermaid_label(sprint["title"])} burndown - story points"',
                "    x-axis [" + ", ".join(f'"{day:%-d %b}"' for day in days) + "]",
                f'    y-axis "Story points" 0 --> {_axis_top(max(total, max(remaining, default=0)), step=5)}',
                "    line [" + ", ".join(_fmt_number(value) for value in ideal) + "]",
                "    line ["
                + ", ".join(_fmt_number(value) for value in remaining)
                + "]",
                "```",
                "",
            ]
        )
    else:
        out.extend(["_No pointed sprint items are available for this chart._", ""])

    out.extend(
        [
            "| Date | Remaining from Issue state (SP) | Ideal from current scope (SP) |",
            "|---|---:|---:|",
        ]
    )
    if days:
        selected = sorted({0, len(days) - 1})
        for index in selected:
            out.append(
                f"| {days[index]:%-d %b %Y} | {_fmt_number(remaining[index])} | "
                f"{_fmt_number(ideal[index])} |"
            )
        if end > days[-1]:
            out.append(f"| {end:%-d %b %Y}, sprint end | — | 0 |")
    else:
        out.append("| No sprint dates | 0 | 0 |")
    out.extend(
        [
            "",
            "**Method limitation.** Remaining work uses each Issue's open/closed state and "
            "`closedAt`; GitHub's standard ProjectV2 query does not provide historical Status or "
            "Story Points transitions. The ideal line uses today's recorded sprint scope. This is "
            "an indicative burndown, not a reconstruction of every past board movement.",
            "",
        ]
    )


def _build_consistency_section(
    out: list[str], snapshot: Mapping[str, Any], sprint: Optional[Mapping[str, Any]]
) -> None:
    out.extend(["### 7.6 Data-quality checks", ""])
    if sprint is None:
        out.extend(
            ["- Sprint/Issue state comparison unavailable: no Sprint identified.", ""]
        )
        return
    sprint_name = str(sprint["title"])
    safe_sprint_name = _markdown_text(sprint_name)
    flow_items = [
        item
        for item in snapshot.get("items") or []
        if _is_sprint_item(item, sprint_name)
    ]
    closed_not_done = [
        item
        for item in flow_items
        if item.get("state") == "CLOSED" and item.get("status") != sprint_name
    ]
    done_open = [
        item
        for item in flow_items
        if item.get("status") == sprint_name and item.get("state") != "CLOSED"
    ]
    no_iteration = [item for item in flow_items if not item.get("iteration")]
    out.extend(
        [
            f"- Closed Issues outside **{safe_sprint_name}** (Done): "
            f"**{len(closed_not_done)}**",
            f"- Open Issues inside **{safe_sprint_name}** (Done): **{len(done_open)}**",
            f"- Sprint-flow Issues without a Sprint iteration: **{len(no_iteration)}**",
            "",
            "These checks expose differences between Issue state and Project fields; they do not "
            "silently reconcile or average the two sources.",
            "",
        ]
    )


def build_section(
    snapshot: Mapping[str, Any],
    today: Optional[dt.date] = None,
    generated_at: Optional[dt.datetime] = None,
) -> str:
    """Build the complete marker-delimited Wiki section from one snapshot."""

    today = today or dt.datetime.now(LOCAL_TIMEZONE).date()
    source_updated_at = snapshot.get("source_updated_at")
    generated_at = generated_at or (
        source_updated_at if isinstance(source_updated_at, dt.datetime) else None
    )
    if generated_at is not None:
        if generated_at.tzinfo is None:
            raise BoardInsightsError("The generated-at timestamp must include a timezone.")
        generated_at = generated_at.astimezone(dt.timezone.utc)
    sprint = active_sprint(snapshot, today)
    items = list(snapshot.get("items") or [])
    total_points = _sum_points(items)
    warnings = _warning_lines(snapshot, sprint)

    out = [
        START_MARKER,
        "<!-- Generated by .github/workflows/board-insights.yml. Do not edit this block by hand. -->",
        "",
    ]
    if generated_at is not None:
        out.extend(
            [
                f"_Snapshot of [Project Board {PROJECT_NUMBER}]({BOARD_URL}); source data last "
                f"updated **{generated_at:%-d %b %Y, %H:%M} UTC**._",
                "",
            ]
        )
    else:
        out.extend(
            [
                f"_Snapshot of [Project Board {PROJECT_NUMBER}]({BOARD_URL})._",
                "",
            ]
        )
    out.extend(
        [
            f"**{len(items)} Issue item(s), {_fmt_number(total_points)} story points currently tracked.**",
            "",
        ]
    )
    if sprint:
        safe_sprint_title = _markdown_text(sprint["title"])
        duration = sprint.get("duration")
        active_label = "active iteration" if sprint.get("is_active") else "latest started iteration"
        if duration:
            sprint_end = sprint["start"] + dt.timedelta(days=int(duration) - 1)
            description = (
                f"Detected {active_label}: **{safe_sprint_title}** "
                f"({sprint['start']:%-d %b %Y} to {sprint_end:%-d %b %Y})."
            )
        else:
            description = (
                f"Detected {active_label}: **{safe_sprint_title}** "
                f"(starts {sprint['start']:%-d %b %Y}; duration unavailable)."
            )
        out.extend([description, ""])
    if warnings:
        out.extend(["> **Data-quality warnings**"])
        out.extend(f"> - {warning}" for warning in warnings)
        out.append("")

    _build_status_section(out, snapshot, sprint)
    _build_epic_section(out, snapshot)
    sprint_items = _build_sprint_section(out, snapshot, sprint)
    _build_estimate_section(out, snapshot, sprint_items)
    _build_burndown_section(out, sprint, sprint_items, today)
    _build_consistency_section(out, snapshot, sprint)
    out.append(END_MARKER)
    return "\n".join(out) + "\n"


def _marker_bounds(content: str, *, label: str) -> tuple[int, int]:
    if content.count(START_MARKER) != 1 or content.count(END_MARKER) != 1:
        raise BoardInsightsError(
            f"{label} must contain exactly one board-insights start marker and one end marker."
        )
    start = content.index(START_MARKER)
    end_start = content.index(END_MARKER)
    if end_start <= start:
        raise BoardInsightsError(f"{label} board-insights markers are in the wrong order.")
    for marker_start, marker in ((start, START_MARKER), (end_start, END_MARKER)):
        marker_end = marker_start + len(marker)
        if (
            (marker_start and content[marker_start - 1] not in "\r\n")
            or (marker_end < len(content) and content[marker_end] not in "\r\n")
        ):
            raise BoardInsightsError(
                f"{label} board-insights markers must each be on their own line."
            )
    return start, end_start + len(END_MARKER)


def splice_marked_section(page: str, section: str) -> str:
    """Replace exactly one existing marker block and preserve all other bytes."""

    start, end = _marker_bounds(page, label="Wiki page")
    section_start, section_end = _marker_bounds(section, label="Generated section")
    if section[:section_start].strip() or section[section_end:].strip():
        raise BoardInsightsError(
            "Generated section must not contain content outside its marker block."
        )
    replacement = section[section_start:section_end]
    return page[:start] + replacement + page[end:]


def _write_text(path: str, content: str) -> bool:
    """Atomically replace one text file, returning whether its bytes changed."""

    destination = Path(path)
    try:
        with destination.open("r", encoding="utf-8", newline="") as handle:
            existing = handle.read()
    except FileNotFoundError:
        existing = None
    if existing == content:
        return False

    parent = destination.parent
    if not parent.is_dir():
        raise BoardInsightsError(f"Output directory does not exist: {parent}")
    mode = destination.stat().st_mode & 0o777 if destination.exists() else 0o644
    descriptor, temporary_name = tempfile.mkstemp(
        dir=parent,
        prefix=f".{destination.name}.",
        suffix=".tmp",
        text=True,
    )
    temporary = Path(temporary_name)
    try:
        os.chmod(temporary, mode)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, destination)
    except Exception:
        try:
            os.close(descriptor)
        except OSError:
            pass
        temporary.unlink(missing_ok=True)
        raise
    return True


def token_from_environment(environment: Mapping[str, str] = os.environ) -> str:
    token = environment.get("GH_TOKEN") or environment.get("GITHUB_TOKEN")
    if not token or not token.strip():
        raise BoardInsightsError(
            "Set GH_TOKEN or GITHUB_TOKEN to a credential that can read the organisation ProjectV2."
        )
    return token.strip()


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument(
        "--out", help="write only the generated marker block to this file"
    )
    destination.add_argument(
        "--wiki", help="replace the existing marker block in this Wiki page"
    )
    parser.add_argument(
        "--date",
        type=dt.date.fromisoformat,
        help="snapshot date in YYYY-MM-DD form (defaults to today)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    try:
        token = token_from_environment()
        snapshot = fetch_project(token)
        snapshot_date = args.date or dt.datetime.now(LOCAL_TIMEZONE).date()
        section = build_section(snapshot, today=snapshot_date)
        print(
            f"Read {len(snapshot['items'])} Issue item(s); skipped "
            f"{snapshot['skipped_non_issues']} non-Issue item(s).",
            file=sys.stderr,
        )
        for warning in _warning_lines(
            snapshot, active_sprint(snapshot, snapshot_date)
        ):
            print(f"warning: {warning}", file=sys.stderr)

        if args.out:
            changed = _write_text(args.out, section)
        elif args.wiki:
            with open(args.wiki, encoding="utf-8", newline="") as handle:
                page = handle.read()
            changed = _write_text(args.wiki, splice_marked_section(page, section))
        else:
            sys.stdout.write(section)
            changed = True
        if (args.out or args.wiki) and not changed:
            print("Generated content is unchanged; no file was replaced.", file=sys.stderr)
        return 0
    except BoardInsightsError as exc:
        print(f"board-insights: {exc}", file=sys.stderr)
        return 1
    except (OSError, UnicodeError) as exc:
        print(
            f"board-insights: file operation failed: {_safe_diagnostic(exc)}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
