# SWEN90014-2026-CSD-Koala — Yoir

**SWEN90014 Masters Software Engineering Project — Semester 2, 2026 · Team CSD-Koala**

Yoir is a two-sided career advisory marketplace connecting job seekers — graduates,
career changers, students and skilled migrants — with career counsellors who sell
services such as CV review, mock interviews and career planning. A platform owner
moderates content, reviews counsellor verification, and oversees orders and disputes.

Requirements were defined by the Semester 1 SWEN90009 CSD-Koala team. This phase builds
the product they specified: 51 baselined stories, 179 SP, tracked as `[US-nn]` issues on
the project board.

## Links

| | |
|---|---|
| Wiki | https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki |
| Project board | https://github.com/orgs/swen90014-2026-sm2/projects/6 |
| Background and scope | [Project Background and Scope](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Project-Background-and-Scope) |
| Requirements | [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) |
| How we work | [Process Documentation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation) |
| Team and roles | [Team Details](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Team-Details) |
| Client meeting minutes | [Client meeting minutes](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes) |

The wiki is the source of truth for project documentation. This repository holds the
code, the CI, and documents exported from the wiki for assessment.

## Repository layout

| Path | Contents |
|---|---|
| [docs/sprint1/](docs/sprint1/) | Sprint 1 documentation and diagrams |
| [docs/sprint1/meeting-minutes/](docs/sprint1/meeting-minutes/) | Client meeting minutes exported from the wiki |
| [.github/workflows/](.github/workflows/) | CI workflows |
| [.github/scripts/](.github/scripts/) | Scripts the CI runs, also runnable locally |

Application code is not in the repository yet. Sprint 1 covers requirements artefacts,
the design concept, the executable architecture, process documentation and a loaded
backlog; feature delivery starts in Sprint 2.

## Team

| Member | Role |
|---|---|
| Manu | Scrum Master |
| Jared | Product Owner |
| Ariz | Frontend Developer |
| James | Frontend Developer |
| Evelyn | Backend Developer |
| Jashan | Backend Developer |
| Zhenyang | QA Lead |

Full names, contacts and responsibilities are on the [Team Details](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Team-Details)
wiki page. Tutor: Erfan Farabi. Client: Saumil Macwan.

## Branching and code workflow

Three levels: `main` → `dev` → feature branches.

| Branch | Purpose | Rule |
|---|---|---|
| `main` | Stable, always runnable. Milestone tags live here. | Never push directly. Only `dev` merges in, via PR, at the end of a sprint or milestone. |
| `dev` | Integration — where the current sprint's work comes together. | Never push directly. Only feature branches merge in, via reviewed PR. |
| `feat/<id>-<name>` | One branch per board item, cut from `dev`, e.g. `feat/S1-04-slot-reservation`. Use `fix/`, `docs/`, `chore/` for non-feature work. | Deleted after merge. |

```
git checkout dev && git pull
git checkout -b feat/S1-04-slot-reservation
git push -u origin feat/S1-04-slot-reservation
```

Open the PR **into `dev`** with `Closes #nn` in the description so the board item closes
on merge. The other member of your sub-team approves; QA checks the acceptance criteria
before the item moves to Done. Full detail is on the
[Process Documentation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation) wiki page.

## Continuous integration

**Mermaid Diagrams** ([.github/workflows/mermaid.yml](.github/workflows/mermaid.yml)) runs
on branch creation, on every push to any branch, and on every pull request. It renders
every `.mmd`/`.mermaid` file and every fenced `mermaid` block in Markdown to SVG and PNG,
so a diagram that no longer parses fails the check instead of reaching review broken.

Each run publishes the diagrams inline in the job summary, uploads the SVG/PNG as a
build artifact, and posts them as a single updating comment on the pull request.

To run the same check locally:

```
npm install -g @mermaid-js/mermaid-cli@11.16.0
.github/scripts/render-mermaid.sh build/diagrams
```
