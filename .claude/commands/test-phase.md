Run the automated test suite for the phase specified in $ARGUMENTS (e.g. "2" or "Phase 2").

1. Read `docs/TESTING.md` end-to-end. Identify the subagents whose "active from" phase is ≤ the target phase. Read each per-phase section from Phase 1 through the target phase (regression — earlier phases must still pass).

2. Resolve the live-smoke target URL in this priority order:
   - `DRABA_TEST_URL` env var
   - The `reference_test_docker.md` memory entry
   - If neither is available, mark live-smoke subagents as **skipped** for this run.

   Also resolve `DRABA_TEST_INVITE_TOKEN` (env or memory). If it is missing, the `api-smoke` subagent should skip the register-flow assertions and run only the auth-required flows that don't need fresh registration.

2a. **Reset the live test environment.** Before running live-smoke subagents:
   - Run `ssh draba-test` (the SSH alias is pinned to the reset wrapper via `authorized_keys command=`, so no command argument is needed). Confirm output ends with "Done."
   - If SSH fails or the alias is not configured, **stop and ask the user to run `scripts/reset-test-env.sh` on the docker host**, then resume when they confirm. Do not proceed with live smoke against a dirty DB.
   - The reset leaves the DB holding the **canonical sample dataset** (3 teams, 6 timelines, 58 activities, 6 shares) **plus** the bootstrap admin/team/invite — not an empty DB. `api-smoke` should target `bootstrap-team` for register/login flows and must **not** assume exact global team/user counts. (See docs/TESTING.md.)
   - Skip this entire step if no live-smoke subagents are active for the target phase.

3. Spawn the active subagents **in parallel** via the Agent tool (single message, multiple Agent calls). Each agent prompt must:
   - State which subagent role it is (`static-check`, `unit-test`, `schema-check`, `api-smoke`, `security-review`, etc.)
   - Quote the exact assertions from `docs/TESTING.md` for the target phase + all prior phases relevant to its role
   - Pass the resolved smoke URL when applicable
   - Request a concise pass/fail report (under 300 words) with file:line citations for any failure

4. Aggregate results into a single table — columns: subagent | status (pass / fail / skipped) | summary. Print blockers first, then failures, then skips, then passes.

5. If any subagent failed, stop here — do not append to the log. Surface the failures to the user with concrete next steps.

6. If all active subagents passed (or skipped cleanly), append a dated entry to `docs/log.md`:
   ```
   ## YYYY-MM-DD — /test-phase N
   - Subagents run: <list>
   - Result: all pass (or: N pass, M skip)
   - Smoke target: <url or "skipped">
   ```

7. Report the table back to the user. Do not modify any source code.
