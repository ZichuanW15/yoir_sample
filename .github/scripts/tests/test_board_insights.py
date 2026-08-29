#!/usr/bin/env python3
"""Deterministic tests for the Board Insights generator."""

from __future__ import annotations

import copy
import datetime as dt
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
import urllib.error


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "board-insights.py"
SPEC = importlib.util.spec_from_file_location("board_insights", SCRIPT)
assert SPEC and SPEC.loader
board = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(board)

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"
WORKFLOW = SCRIPT.parents[1] / "workflows" / "board-insights.yml"
PUPPETEER_CONFIG = SCRIPT.parents[1] / "mermaid" / "puppeteer.json"


def load_fixture(name: str):
    with (FIXTURES / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def fixture_snapshot():
    pages = [load_fixture("project-page-1.json"), load_fixture("project-page-2.json")]
    cursors = []

    def fake_graphql(query, variables, token):
        del query
        assert token == "fixture-token"
        cursors.append(variables["cursor"])
        return pages[len(cursors) - 1]["data"]

    snapshot = board.fetch_project("fixture-token", graphql_fn=fake_graphql)
    return snapshot, cursors


def fetch_with_pages(pages, *, max_pages=board.MAX_ITEM_PAGES):
    calls = []

    def fake_graphql(query, variables, token):
        del query
        assert token == "fixture-token"
        calls.append(variables["cursor"])
        return pages[len(calls) - 1]["data"]

    return (
        board.fetch_project(
            "fixture-token", graphql_fn=fake_graphql, max_pages=max_pages
        ),
        calls,
    )


class FakeResponse:
    def __init__(self, payload):
        self.body = io.BytesIO(json.dumps(payload).encode("utf-8"))

    def __enter__(self):
        return self.body

    def __exit__(self, exc_type, exc, traceback):
        self.body.close()


def http_error(code, body=b"error", headers=None):
    return urllib.error.HTTPError(
        "https://api.github.com/graphql",
        code,
        "request failed",
        headers or {},
        io.BytesIO(body),
    )


class BoardInsightsTests(unittest.TestCase):
    def test_normal_fixture_builds_all_sections(self):
        snapshot, _ = fixture_snapshot()
        section = board.build_section(
            snapshot,
            today=dt.date(2026, 8, 28),
            generated_at=dt.datetime(2026, 8, 28, 5, 15, tzinfo=dt.timezone.utc),
        )
        self.assertIn("4 Issue item(s), 16 story points", section)
        self.assertIn("### 7.1 Where the work sits", section)
        self.assertIn("### 7.2 What the product backlog is made of", section)
        self.assertIn("### 7.3 Current sprint state", section)
        self.assertIn("### 7.4 Estimate-size distribution", section)
        self.assertIn("### 7.5 Current sprint burndown", section)
        self.assertIn("### 7.6 Data-quality checks", section)
        self.assertIn('y-axis "Issues"', section)
        self.assertIn("Method limitation", section)
        self.assertNotIn("finishes on full scope", section)
        self.assertTrue(section.startswith(board.START_MARKER))
        self.assertTrue(section.rstrip().endswith(board.END_MARKER))

    def test_fetch_project_follows_pagination_and_skips_draft(self):
        snapshot, cursors = fixture_snapshot()
        self.assertEqual([None, "page-2"], cursors)
        self.assertEqual(4, len(snapshot["items"]))
        self.assertEqual(1, snapshot["skipped_non_issues"])
        self.assertIn("Status", snapshot["fields"])
        self.assertEqual(
            dt.datetime(2026, 8, 28, 5, tzinfo=dt.timezone.utc),
            snapshot["source_updated_at"],
        )

    def test_missing_organization_is_rejected(self):
        page = load_fixture("project-page-1.json")
        page["data"]["organization"] = None

        with self.assertRaisesRegex(board.BoardInsightsError, "Organisation"):
            fetch_with_pages([page])

    def test_missing_project_is_rejected(self):
        page = load_fixture("project-page-1.json")
        page["data"]["organization"]["projectV2"] = None

        with self.assertRaisesRegex(board.BoardInsightsError, "ProjectV2"):
            fetch_with_pages([page])

    def test_field_value_truncation_is_rejected(self):
        page = load_fixture("project-page-1.json")
        page["data"]["organization"]["projectV2"]["items"]["nodes"][0][
            "fieldValues"
        ]["pageInfo"] = {"hasNextPage": True, "endCursor": "more-fields"}

        with self.assertRaisesRegex(board.BoardInsightsError, "truncated snapshot"):
            fetch_with_pages([page])

    def test_missing_field_value_page_info_is_rejected(self):
        page = load_fixture("project-page-1.json")
        page["data"]["organization"]["projectV2"]["items"]["nodes"][0][
            "fieldValues"
        ].pop("pageInfo")

        with self.assertRaisesRegex(board.BoardInsightsError, "malformed field-value"):
            fetch_with_pages([page])

    def test_project_field_truncation_is_rejected(self):
        page = load_fixture("project-page-1.json")
        page["data"]["organization"]["projectV2"]["fields"]["pageInfo"] = {
            "hasNextPage": True,
            "endCursor": "more-fields",
        }

        with self.assertRaisesRegex(board.BoardInsightsError, "more than 100 fields"):
            fetch_with_pages([page])

    def test_missing_item_page_info_is_rejected(self):
        page = load_fixture("project-page-2.json")
        page["data"]["organization"]["projectV2"]["items"].pop("pageInfo")

        with self.assertRaisesRegex(board.BoardInsightsError, "malformed Project item"):
            fetch_with_pages([page])

    def test_missing_item_cursor_is_rejected(self):
        page = load_fixture("project-page-1.json")
        page["data"]["organization"]["projectV2"]["items"]["pageInfo"] = {
            "hasNextPage": True,
            "endCursor": None,
        }

        with self.assertRaisesRegex(board.BoardInsightsError, "invalid ProjectV2"):
            fetch_with_pages([page])

    def test_repeated_item_cursor_is_rejected(self):
        pages = [
            load_fixture("project-page-1.json"),
            load_fixture("project-page-2.json"),
        ]
        pages[1]["data"]["organization"]["projectV2"]["items"]["pageInfo"] = {
            "hasNextPage": True,
            "endCursor": "page-2",
        }

        with self.assertRaisesRegex(board.BoardInsightsError, "repeated ProjectV2"):
            fetch_with_pages(pages)

    def test_item_page_limit_is_enforced_before_an_extra_request(self):
        page = load_fixture("project-page-1.json")
        calls = []

        def fake_graphql(query, variables, token):
            del query, token
            calls.append(variables["cursor"])
            return page["data"]

        with self.assertRaisesRegex(board.BoardInsightsError, "safety limit"):
            board.fetch_project(
                "fixture-token", graphql_fn=fake_graphql, max_pages=1
            )
        self.assertEqual([None], calls)

    def test_incomplete_item_count_is_rejected(self):
        page = load_fixture("project-page-2.json")
        page["data"]["organization"]["projectV2"]["items"]["totalCount"] = 99

        with self.assertRaisesRegex(board.BoardInsightsError, "incomplete"):
            fetch_with_pages([page])

    def test_project_change_during_pagination_is_rejected(self):
        pages = [
            load_fixture("project-page-1.json"),
            load_fixture("project-page-2.json"),
        ]
        pages[1]["data"]["organization"]["projectV2"]["updatedAt"] = (
            "2026-08-28T04:01:00Z"
        )

        with self.assertRaisesRegex(board.BoardInsightsError, "changed while"):
            fetch_with_pages(pages)

    def test_project_title_or_fields_change_during_pagination_is_rejected(self):
        for mutation in ("title", "fields"):
            with self.subTest(mutation=mutation):
                pages = [
                    load_fixture("project-page-1.json"),
                    load_fixture("project-page-2.json"),
                ]
                project = pages[1]["data"]["organization"]["projectV2"]
                if mutation == "title":
                    project["title"] = "Changed title"
                else:
                    project["fields"]["nodes"][0]["options"].append(
                        {"name": "Changed status"}
                    )

                with self.assertRaisesRegex(board.BoardInsightsError, "changed while"):
                    fetch_with_pages(pages)

    def test_duplicate_project_item_or_field_is_rejected(self):
        pages = [
            load_fixture("project-page-1.json"),
            load_fixture("project-page-2.json"),
        ]
        pages[1]["data"]["organization"]["projectV2"]["items"]["nodes"][0][
            "id"
        ] = "project-item-1"
        with self.assertRaisesRegex(board.BoardInsightsError, "duplicate Project item"):
            fetch_with_pages(pages)

        page = load_fixture("project-page-1.json")
        fields = page["data"]["organization"]["projectV2"]["fields"]["nodes"]
        fields.append(copy.deepcopy(fields[0]))
        with self.assertRaisesRegex(board.BoardInsightsError, "duplicate fields"):
            fetch_with_pages([page])

    def test_missing_story_points_is_reported_not_crashed(self):
        snapshot, _ = fixture_snapshot()
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))
        self.assertIn("1 Issue item(s) have no Story Points value", section)
        self.assertIn("1 is unpointed", section)

    def test_fractional_story_points_are_not_rounded_to_one_decimal(self):
        snapshot, _ = fixture_snapshot()
        snapshot["items"][0]["points"] = 0.25
        snapshot["items"][1]["points"] = 1.5
        snapshot["items"][2]["points"] = 0.0
        snapshot["items"][3]["points"] = None
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))

        self.assertIn("1.75 story points", section)
        self.assertIn("0.25 SP", section)
        self.assertNotIn("0.2 SP", section)

    def test_invalid_story_point_values_fail_closed(self):
        for value in (True, -1, float("nan"), float("inf"), "3", "not-a-number"):
            with self.subTest(value=value):
                with self.assertRaises(board.BoardInsightsError):
                    board._number(value)

    def test_invalid_issue_state_fails_closed(self):
        page = load_fixture("project-page-2.json")
        page["data"]["organization"]["projectV2"]["items"]["nodes"][0][
            "content"
        ]["state"] = "unexpected"

        with self.assertRaisesRegex(board.BoardInsightsError, "invalid Issue state"):
            fetch_with_pages([page])

    def test_missing_sprint_on_flow_item_is_reported(self):
        snapshot, _ = fixture_snapshot()
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))
        self.assertIn("1 sprint-flow item(s) have no Sprint iteration value", section)

    def test_flow_item_from_another_iteration_is_not_counted_in_current_sprint(self):
        snapshot, _ = fixture_snapshot()
        other_sprint_item = dict(snapshot["items"][1])
        other_sprint_item.update(
            {
                "number": 99,
                "points": 13.0,
                "iteration": {
                    "title": "Sprint 2",
                    "start": dt.date(2026, 8, 31),
                    "duration": 17,
                },
            }
        )
        snapshot["items"].append(other_sprint_item)
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))
        self.assertIn("3 of 11 pointed SP", section)
        self.assertNotIn("3 of 24 pointed SP", section)

    def test_done_column_item_from_another_iteration_is_not_counted(self):
        snapshot, _ = fixture_snapshot()
        cross_iteration = copy.deepcopy(snapshot["items"][2])
        cross_iteration.update(
            {
                "id": "issue-100",
                "number": 100,
                "url": "https://github.example/issues/100",
                "status": "Sprint 1",
                "points": 21.0,
                "iteration": {
                    "title": "Sprint 2",
                    "start": dt.date(2026, 8, 31),
                    "duration": 17,
                },
            }
        )
        snapshot["items"].append(cross_iteration)
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))

        self.assertIn("3 of 11 pointed SP", section)
        self.assertNotIn("24 pointed SP", section)

    def test_iteration_end_is_exclusive_and_next_sprint_starts_on_boundary(self):
        snapshot, _ = fixture_snapshot()
        sprint = board.active_sprint(snapshot, dt.date(2026, 8, 31))

        self.assertIsNotNone(sprint)
        self.assertEqual("Sprint 2", sprint["title"])
        self.assertTrue(sprint["is_active"])

    def test_historical_sprint_fallback_is_not_labelled_active(self):
        snapshot, _ = fixture_snapshot()
        sprint = board.active_sprint(snapshot, dt.date(2026, 9, 30))
        section = board.build_section(snapshot, today=dt.date(2026, 9, 30))

        self.assertIsNotNone(sprint)
        self.assertFalse(sprint["is_active"])
        self.assertIn("latest started iteration", section)
        self.assertIn("historical fallback", section)

    def test_future_only_sprint_is_not_selected(self):
        snapshot, _ = fixture_snapshot()
        self.assertIsNone(board.active_sprint(snapshot, dt.date(2026, 1, 1)))

    def test_no_sprint_configuration_is_explicit(self):
        snapshot, _ = fixture_snapshot()
        snapshot["fields"].pop("Sprint")
        for item in snapshot["items"]:
            item["iteration"] = None
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))
        self.assertIn("No current or previously started Sprint iteration", section)
        self.assertIn("Sprint status is unavailable", section)
        self.assertIn("Burndown is unavailable", section)

    def test_empty_board_is_rendered_safely(self):
        snapshot, _ = fixture_snapshot()
        snapshot["items"] = []
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))
        self.assertIn("0 Issue item(s), 0 story points", section)
        self.assertIn("No status data", section)
        self.assertIn("No product-backlog epic data", section)

    def test_null_connections_and_empty_board_are_safe(self):
        page = load_fixture("project-page-2.json")
        project = page["data"]["organization"]["projectV2"]
        project["fields"]["nodes"] = None
        project["items"]["nodes"] = None
        project["items"]["totalCount"] = 0
        snapshot, _ = fetch_with_pages([page])
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))

        self.assertEqual([], snapshot["items"])
        self.assertIn("0 Issue item(s)", section)
        self.assertIn("Project field `Status` was not returned", section)

    def test_untrusted_project_labels_cannot_inject_markdown_or_mermaid(self):
        snapshot, _ = fixture_snapshot()
        hostile = 'Bad | `cell` <!-- board-insights:end -->\n```mermaid\nA-->B'
        snapshot["items"][0]["status"] = hostile
        snapshot["items"][0]["epic"] = hostile
        snapshot["fields"]["Status"]["options"].append(hostile)
        section = board.build_section(snapshot, today=dt.date(2026, 8, 28))

        self.assertEqual(1, section.count(board.START_MARKER))
        self.assertEqual(1, section.count(board.END_MARKER))
        self.assertIn("&#124;", section)
        self.assertIn("&lt;!-- board-insights:end --&gt;", section)
        self.assertNotIn("\n```mermaid\nA--&gt;B", section)

    def test_output_is_stable_for_the_same_snapshot_and_date(self):
        snapshot, _ = fixture_snapshot()
        first = board.build_section(snapshot, today=dt.date(2026, 8, 28))
        second = board.build_section(snapshot, today=dt.date(2026, 8, 28))

        self.assertEqual(first, second)
        self.assertIn("source data last updated", first)

    def test_splice_preserves_everything_outside_markers(self):
        original = (
            "# Before\n\n"
            + board.START_MARKER
            + "\nold\n"
            + board.END_MARKER
            + "\n\nAfter\n"
        )
        replacement = board.START_MARKER + "\nnew\n" + board.END_MARKER + "\n"
        updated = board.splice_marked_section(original, replacement)
        self.assertEqual("# Before\n\n", updated[: updated.index(board.START_MARKER)])
        self.assertTrue(updated.endswith("\n\nAfter\n"))
        self.assertIn("\nnew\n", updated)
        self.assertNotIn("\nold\n", updated)

    def test_splice_rejects_missing_markers(self):
        with self.assertRaises(board.BoardInsightsError):
            board.splice_marked_section("# No generated block\n", "generated")

    def test_splice_rejects_reversed_markers(self):
        page = board.END_MARKER + "\nwrong order\n" + board.START_MARKER
        with self.assertRaisesRegex(board.BoardInsightsError, "wrong order"):
            board.splice_marked_section(page, "generated")

    def test_splice_rejects_duplicate_markers(self):
        page = (
            board.START_MARKER
            + "\n"
            + board.START_MARKER
            + "\n"
            + board.END_MARKER
        )
        section = board.START_MARKER + "\nnew\n" + board.END_MARKER
        with self.assertRaisesRegex(board.BoardInsightsError, "exactly one"):
            board.splice_marked_section(page, section)

    def test_splice_requires_standalone_markers(self):
        page = "prefix " + board.START_MARKER + "\nold\n" + board.END_MARKER
        section = board.START_MARKER + "\nnew\n" + board.END_MARKER
        with self.assertRaisesRegex(board.BoardInsightsError, "own line"):
            board.splice_marked_section(page, section)

    def test_splice_rejects_invalid_generated_section(self):
        page = board.START_MARKER + "\nold\n" + board.END_MARKER
        with self.assertRaisesRegex(board.BoardInsightsError, "Generated section"):
            board.splice_marked_section(page, "generated without markers")

        extra = "prefix\n" + board.START_MARKER + "\nnew\n" + board.END_MARKER
        with self.assertRaisesRegex(board.BoardInsightsError, "outside"):
            board.splice_marked_section(page, extra)

    def test_atomic_writer_replaces_only_changed_content(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = pathlib.Path(directory) / "page.md"
            destination.write_text("old", encoding="utf-8")

            self.assertTrue(board._write_text(str(destination), "new"))
            self.assertEqual("new", destination.read_text(encoding="utf-8"))
            self.assertFalse(board._write_text(str(destination), "new"))
            self.assertEqual([], list(destination.parent.glob(".page.md.*.tmp")))

    def test_atomic_writer_does_not_normalise_crlf_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = pathlib.Path(directory) / "page.md"
            destination.write_bytes(b"outside\r\n")

            self.assertFalse(board._write_text(str(destination), "outside\r\n"))
            self.assertEqual(b"outside\r\n", destination.read_bytes())

    def test_missing_token_is_a_clear_error(self):
        with self.assertRaisesRegex(board.BoardInsightsError, "GH_TOKEN"):
            board.token_from_environment({})
        with self.assertRaisesRegex(board.BoardInsightsError, "GH_TOKEN"):
            board.token_from_environment({"GH_TOKEN": "   "})

    def test_graphql_errors_are_sanitised(self):
        def opener(request, timeout):
            self.assertEqual("https://api.github.com/graphql", request.full_url)
            self.assertEqual(board.GRAPHQL_TIMEOUT_SECONDS, timeout)
            return FakeResponse(
                {
                    "errors": [
                        {
                            "message": (
                                "Project is not accessible do-not-print\n"
                                "<!-- board-insights:end -->"
                            )
                        }
                    ]
                }
            )

        with self.assertRaises(board.BoardInsightsError) as raised:
            board.graphql(
                "query { viewer { login } }", {}, "do-not-print", opener=opener
            )
        self.assertIn("Project is not accessible", str(raised.exception))
        self.assertNotIn("do-not-print", str(raised.exception))
        self.assertNotIn("\n", str(raised.exception))

    def test_graphql_passes_timeout_and_returns_data(self):
        observed = []

        def opener(request, timeout):
            observed.append((request.full_url, timeout))
            return FakeResponse({"data": {"viewer": {"login": "koala"}}})

        data = board.graphql("query", {}, "token", opener=opener, timeout=7)

        self.assertEqual({"viewer": {"login": "koala"}}, data)
        self.assertEqual([("https://api.github.com/graphql", 7)], observed)

    def test_graphql_retries_transient_network_failures_with_bounded_backoff(self):
        attempts = []
        delays = []

        def opener(request, timeout):
            del request, timeout
            attempts.append(1)
            if len(attempts) < 3:
                raise urllib.error.URLError("temporary outage")
            return FakeResponse({"data": {"ok": True}})

        data = board.graphql(
            "query",
            {},
            "token",
            opener=opener,
            sleeper=delays.append,
        )

        self.assertEqual({"ok": True}, data)
        self.assertEqual(3, len(attempts))
        self.assertEqual([1.0, 2.0], delays)

    def test_graphql_retries_transient_http_status_and_honours_retry_after(self):
        attempts = []
        delays = []

        def opener(request, timeout):
            del request, timeout
            attempts.append(1)
            if len(attempts) == 1:
                raise http_error(503, headers={"Retry-After": "0"})
            return FakeResponse({"data": {"ok": True}})

        data = board.graphql(
            "query",
            {},
            "token",
            opener=opener,
            sleeper=delays.append,
        )

        self.assertEqual({"ok": True}, data)
        self.assertEqual([0.0], delays)

    def test_graphql_does_not_retry_authentication_error_or_leak_token(self):
        attempts = []

        def opener(request, timeout):
            del request, timeout
            attempts.append(1)
            raise http_error(401, body=b'credential secret-token rejected')

        with self.assertRaises(board.BoardInsightsError) as raised:
            board.graphql(
                "query",
                {},
                "secret-token",
                opener=opener,
                sleeper=lambda _: self.fail("401 must not be retried"),
            )

        self.assertEqual(1, len(attempts))
        self.assertNotIn("secret-token", str(raised.exception))
        self.assertIn("HTTP 401", str(raised.exception))


class WorkflowDefinitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")
        cls.validate_job, cls.publish_job = cls.workflow.split("\n  publish:", 1)

    def test_pull_requests_and_pushes_have_a_secret_free_validation_job(self):
        self.assertIn("  pull_request:", self.workflow)
        self.assertIn("  push:", self.workflow)
        self.assertIn(".github/mermaid/puppeteer.json", self.validate_job)
        self.assertIn("\n  validate:", self.validate_job)
        self.assertNotIn("secrets.", self.validate_job)
        self.assertIn("test_board_insights.py -v", self.validate_job)

    def test_publication_is_event_gated_and_serialised(self):
        self.assertIn("github.event_name == 'schedule'", self.publish_job)
        self.assertIn("github.event_name == 'issues'", self.publish_job)
        self.assertIn("github.event_name == 'workflow_dispatch'", self.publish_job)
        self.assertNotIn("github.event_name == 'push'", self.publish_job)
        self.assertNotIn("github.event_name == 'pull_request'", self.publish_job)
        self.assertIn("group: board-insights-publish", self.publish_job)
        self.assertIn("cancel-in-progress: false", self.publish_job)

    def test_wiki_authentication_target_and_push_are_safe(self):
        self.assertIn("GIT_ASKPASS", self.publish_job)
        self.assertIn("${GITHUB_REPOSITORY}.wiki.git", self.publish_job)
        self.assertIn("wiki/Process-Documentation-and-Insights.md", self.publish_job)
        self.assertIn("git push origin HEAD", self.publish_job)
        self.assertNotIn("git push origin master", self.publish_job)
        self.assertNotIn("x-access-token:${{", self.publish_job)

    def test_actions_are_sha_pinned_and_render_precedes_commit(self):
        action_lines = [
            line.strip() for line in self.workflow.splitlines() if "uses:" in line
        ]
        self.assertTrue(action_lines)
        for line in action_lines:
            with self.subTest(line=line):
                revision = line.rsplit("@", 1)[-1]
                self.assertEqual(40, len(revision))
                self.assertTrue(all(character in "0123456789abcdef" for character in revision))
        self.assertLess(
            self.publish_job.index("Check the generated diagrams render"),
            self.publish_job.index("Commit and push only when"),
        )
        self.assertIn("git diff --quiet", self.publish_job)

    def test_mermaid_configuration_exists_and_is_valid_json(self):
        self.assertTrue(PUPPETEER_CONFIG.is_file())
        config = json.loads(PUPPETEER_CONFIG.read_text(encoding="utf-8"))
        self.assertEqual(
            ["--no-sandbox", "--disable-setuid-sandbox"], config.get("args")
        )
        self.assertIn(
            ".github/mermaid/puppeteer.json",
            self.publish_job,
        )


if __name__ == "__main__":
    unittest.main()
