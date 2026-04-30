Run the diff review for the phase specified in $ARGUMENTS (e.g. "2" or "Phase 2").

1. Read `docs/REVIEW.md` and the phase's section in `docs/ROADMAP.md` so you know the scope you're reviewing against.

2. Identify the diff to review:
   - Default: `git diff main...HEAD` (everything on the current branch since main).
   - If the user passes a base ref (e.g. `/review-phase 2 v0.2.0`), diff against that instead.

3. Spawn these subagents **in parallel** via the Agent tool:
   - **scope-review** (`general-purpose`): given the phase's ROADMAP scope and the diff, list anything outside scope. Cite `file:line`.
   - **security-review** (`general-purpose`): apply the Security section of `docs/REVIEW.md` to the diff. Look for secrets, auth gaps, SQL concat, plaintext passwords, hardcoded JWT secrets.
   - **convention-review** (`Explore`): apply CONVENTIONS.md + the Conventions & docs section of `docs/REVIEW.md`. Flag style and doc-update misses.
   - **test-coverage-review** (`Explore`): for each new code path in the diff, check whether a test exercises it. Flag uncovered paths.

   Each agent must return findings as `severity | file:line | one-line rationale`, with severities `blocker / suggestion / nit`. Under 300 words per agent.

4. Merge findings into a single report grouped by severity (blockers first). Drop empty severity groups.

5. Print the report to the user. If there are blockers, recommend they be addressed before flipping the phase status to ✅. Do not modify source code, do not commit, do not flip ROADMAP status.
