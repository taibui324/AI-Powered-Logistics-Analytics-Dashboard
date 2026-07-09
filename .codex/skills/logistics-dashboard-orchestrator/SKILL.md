---
name: logistics-dashboard-orchestrator
description: "Primary Codex harness skill for the AI-powered logistics analytics dashboard. Use for implementation, review, QA, plan updates, AI orchestration, forecasting, charting, deployment preparation, subagent delegation, reruns, updates, fixes, or follow-up work in this repo."
---

# Logistics Dashboard Orchestrator

Use this skill as the coordination entry point for meaningful work on the logistics analytics dashboard.

## Codex Tooling

- Use `multi_agent_v1.spawn_agent` for subagents only when the user explicitly asks for subagents, delegation, or parallel agent work.
- Spawn bounded sidecar tasks that can run while the main agent keeps moving.
- Keep immediate blockers local.
- For code edits, assign disjoint write scopes and tell subagents they are not alone in the codebase.
- Do not set a model override unless explicitly requested or clearly justified.

## Role Map

| Project profile | Preferred Codex role | Use for |
|-----------------|----------------------|---------|
| `.codex/agents/logistics-architect.md` | `architect-reviewer` | Requirement drift, system boundaries, deployment architecture |
| `.codex/agents/logistics-data-analytics-engineer.md` | `data-engineer`, `data-analyst`, `data-scientist` | Dataset handling, metrics, aggregations, forecasting |
| `.codex/agents/logistics-ai-tooling-engineer.md` | `ai-engineer`, `llm-architect` | Structured intent parsing, tool routing, chart specs, guardrails |
| `.codex/agents/logistics-ui-dashboard-engineer.md` | `frontend-developer`, `ui-designer`, `ui-ux-tester` | Dashboard UI, charts, responsiveness, UX checks |
| `.codex/agents/logistics-qa-verifier.md` | `qa-expert`, `test-automator` | Acceptance checks, regression tests, release verification |

## Workflow

1. **Context audit**
   - Read `AGENTS.md`, this skill, the current plan, `git status`, relevant source files, and any existing `_workspace/` artifacts if the user asks for a rerun.
   - Identify whether the request is implementation, review, QA, planning, deployment, or harness maintenance.

2. **Scope the work**
   - Choose the smallest set of skills and roles that cover the request.
   - Decide what the main Codex agent should do locally on the critical path.
   - Decide which independent tasks, if any, are useful to delegate.

3. **Delegate when appropriate**
   - Spawn independent subagents with `multi_agent_v1.spawn_agent`.
   - Include the relevant `.codex/agents/*` profile path, exact files to inspect or edit, acceptance criteria, and expected output format.
   - Avoid duplicate work between main and subagents.

4. **Integrate**
   - Review returned findings or patches.
   - Resolve conflicts, make minimal edits, and keep unrelated user changes intact.
   - Update the plan or README when implementation decisions change.

5. **Verify**
   - Run focused checks: lint, typecheck, tests, data sanity scripts, browser checks, or docs validation as appropriate.
   - If verification cannot run, state why and what risk remains.

## Default Analytical Architecture

- One unified dataset is the source of truth.
- AI interprets the question and chooses a tool.
- Query and forecasting tools compute results deterministically.
- Dynamic chart specs are generated from computed rows.
- Every answer includes direct result, filters, metrics, dimensions, interpretation or query plan, and underlying data access.

## Error Handling

- Retry a failed delegated task once only when the retry has a clear correction.
- If a subagent result is missing, continue with local work and call out the gap.
- If agents disagree, preserve both claims until the main agent verifies the source files or data.

## Test Scenarios

- **Normal flow:** User asks to implement a dashboard slice. Main agent reads the plan, delegates a metric review and UI review if useful, implements the critical path locally, integrates findings, and verifies.
- **Review flow:** User asks for architecture review. Spawn `architect-reviewer` only if delegation was explicitly requested; otherwise perform a review locally using the same profile.
- **Error flow:** A subagent cannot inspect a file or returns incomplete findings. Main agent verifies locally, records the limitation, and continues without blocking the whole task.
