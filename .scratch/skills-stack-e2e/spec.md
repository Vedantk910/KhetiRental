# Spec: Make the Claude Code skills stack verifiably working (E2E)

Status: ready-for-agent

## Problem Statement

ProjectKissanrental has a large Claude Code skills stack installed (60+ user skills, the Superpowers and Ponytail plugins, and the Graphify/Ponytail integrations), but there is no reliable way to prove any of it actually works. In practice the agent has repeatedly had to rediscover the stack, hit sandbox blocks, and hand-wave about whether skills are "installed" versus "usable." The user wants a single, repeatable way to know: which skills are discoverable, which of the few executable pieces actually run, and whether the spec→ticket workflow produces real artifacts — without re-auditing everything from scratch every time.

## Solution

A lightweight verification-and-publish flow that checks the stack at three seams and lands its output in the local issue tracker:

- The agent can assert, with evidence, that a skill is installed **and** discoverable (not just present on disk).
- The two executable helper scripts are confirmed to run (offline where possible).
- The `to-spec` / `to-tickets` workflow produces concrete, well-formed artifacts under `.scratch/`, closing the loop that was previously blocked only on tracker setup.

This turns "I think the skills work" into "here is the check and its result."

## User Stories

1. As the user, I want to know which of my installed skills are actually discoverable by a live session, so that I stop assuming "installed" means "usable."
2. As the user, I want a single check I can re-run, so that I don't repeat a full inventory audit every time I touch the stack.
3. As the user, I want the check to distinguish installed-on-disk from discoverable in-session, so that I can spot the two distinct failure modes.
4. As the user, I want the executable skills (the UI/UX search and webapp-testing helpers) confirmed to actually run, so that I know the non-markdown pieces of the stack are healthy.
5. As the user, I want the UI/UX search script verified to work offline with the corrected `$HOME` path, so that its documented command is no longer a latent bug.
6. As the user, I want `.scratch/` publishing to be the confirmed issue-tracker destination for specs and tickets, so that `to-spec`/`to-tickets` have a real home.
7. As the user, I want a spec to land as `.scratch/<feature>/spec.md` and its tickets as `.scratch/<feature>/issues/NN-<slug>.md`, so that the local-markdown tracker convention is actually exercised.
8. As the user, I want the check to report pass/fail per skill rather than a single opaque verdict, so that I can act on the specific gaps.
9. As the user, I want the check to be read-only with respect to the skills themselves, so that verifying the stack can never break the stack.
10. As the user, I want the verification report to name any sandbox or permission blocks it hit, so that I know when a result is "blocked" rather than "failed."
11. As the user, I want the check to be runnable by another agent from a fresh session using only `docs/agents/`, so that the workflow is self-documenting.
12. As the user, I want a clear status label (`ready-for-agent`) on published specs, so that the tracker can route work.
13. As the user, I want ticket files to carry a `Status:` line and `Blocked by:` edges, so that the local tracker supports ordering and claiming.
14. As the user, I want the check to skip skills that are intentionally model-invocation-disabled without flagging them as broken, so that the report doesn't cry wolf.
15. As the user, I want the report to separate "no target project" (N/A) from "verification failed," so that project-dependent skills aren't misjudged.
16. As the user, I want the check to confirm the two plugins (Superpowers, Ponytail) are still enabled after any install churn, so that integrations don't silently regress.
17. As the user, I want the check to confirm the Graphify hooks are registered, so that the graph workflow stays intact.
18. As the user, I want the check to be fast enough to run before I start real work in this project, so that it becomes a preflight habit.
19. As the user, I want the check output to be saveable to a file under `.scratch/`, so that I have an auditable record.
20. As the user, I want the check to respect the repo's domain vocabulary (from `GLOSSARY.md`/ADR) when it reports, so that findings read in the project's own terms.
21. As the user, I want the check to never modify credentials, provider settings, shell config, or installed skills, so that a verification run is always safe.
22. As the user, I want the check to flag a skill whose `SKILL.md` is missing or has invalid frontmatter, so that structural defects are caught.
23. As the user, I want the check to flag duplicate skill names that cause ambiguity, so that two same-named skills can't silently shadow each other.
24. As the user, I want the check to flag broken symlinks among skill directories, so that a dead link is treated as "undiscoverable."
25. As the user, I want the check to confirm `to-spec`/`to-tickets`/`setup-matt-pocock-skills` remain user-invocation-only, so that their restrictions are preserved.
26. As the user, I want the report to list each executable skill alongside its exact invocation command, so that "how do I run it" is answered.
27. As the user, I want the check to be idempotent — running it twice yields the same result — so that it's a stable gate.
28. As the user, I want the check to name the source repository for each skill group, so that provenance is auditable.
29. As the user, I want the check to stop and clearly say "needs a real project" when a skill requires a codebase it can't find, so that I'm not surprised by a blank result.
30. As the user, I want the check to be something I can hand to another reviewer, so that the evidence is self-contained.

## Implementation Decisions

- **Module boundaries.** The check is a single prompt-driven flow (no new code service); it composes three read-only sub-checks and one publish step. No new runtime component is introduced.
- **Seam 1 — discovery boundary.** The primary proof of "works" is that a skill name appears in the live session's available-skills list **and** its `SKILL.md` frontmatter is parseable. A skill present on disk but absent from the in-session list is reported as *installed, not discoverable*; valid frontmatter plus in-session presence is *verified*.
- **Seam 2 — executable scripts.** Only two skills ship executables: the UI/UX search engine and the webapp-testing server helper. The search engine is tested offline (a query against its bundled data); the server helper is *not* tested because it requires a live web app — it is recorded as **N/A (needs a project)**, not as a failure.
- **Seam 3 — publish flow.** Specs and tickets are written to `.scratch/<feature-slug>/spec.md` and `.scratch/<feature-slug>/issues/NN-<slug>.md`, per the tracker convention. A spec carries `Status: ready-for-agent`. Tickets carry a `Status:` line and optional `Blocked by:` edges.
- **Report schema.** The check emits one result row per skill group: name, source repo, disk state, in-session state, verdict (`verified` / `installed-not-discoverable` / `n-a-needs-project` / `blocked` / `failed`), and the evidence line. Group-level rollup (all-pass vs. any-gap).
- **Read-only guarantee.** The check never writes to the skills, plugins, credentials, provider config, or shell config. Its only writes are the `.scratch/` report and any spec/ticket the user explicitly asks for.
- **Blockers are data, not failures.** A sandbox denial or "no target project" is captured as a first-class result value so the report is honest about what was and wasn't proven.
- **Integration regression check.** The run also confirms the two enabled plugins and the Graphify hook registration are still present — a cheap guard against install churn silently undoing them.

## Testing Decisions

- **What makes a good test.** Each sub-check asserts a *behavioral* outcome, not an implementation detail: "this skill is in the session's discoverable set," "this script returned non-empty, well-formed output," "this spec file exists at the expected path with the expected status line." Tests do not assert on internal file layout beyond the documented seams.
- **Modules under test.** The three seams above, plus the integration-regression assertions (plugins enabled, hook registered).
- **Prior art.** The previous full skills audit and the four-test diagnostic already produced the per-skill verdicts this spec formalizes; those runbooks are the reference for what "verified" looks like per skill type.
- **Executable-script test.** The UI/UX search is exercised with one offline query; a non-empty, correctly-shaped result is pass. The webapp-testing helper is not run (no app) and is asserted as skipped-with-reason.
- **Publish-flow test.** Running the spec/ticket flow must produce the expected `.scratch/` files; the test asserts file existence and the `Status:`/`Blocked by:` lines, not exact prose.

## Out of Scope

- Implementing the ProjectKissanrental application itself (there is no application code in the repo yet).
- Reinstalling, updating, or repairing any skill, plugin, or integration.
- Connecting the local tracker to GitHub/GitLab or any external system; this spec stays local-markdown.
- Testing the webapp-testing helper against a real running web app (requires a project that does not exist yet).
- Modifying credentials, provider/Base-URL settings, shell configuration, or Graphify/Ponytail internals.
- Running `to-spec`/`to-tickets` to completion on a feature *other* than this one in the same pass.

## Further Notes

- This spec is the first artifact actually published through the `.scratch/` tracker, so it doubles as the live demonstration that Seam 3 works: if this file is here and well-formed, the publish flow is proven.
- The `to-tickets` follow-up for this spec should slice it into tracer-bullet tickets (one per seam + the integration-regression check), each with a clear completion criterion, numbered from `01` under `.scratch/skills-stack-e2e/issues/`.
- Any skill whose group source cannot be reached by the sandbox should be reported as `blocked` with the denied host named, not retried in a loop.
