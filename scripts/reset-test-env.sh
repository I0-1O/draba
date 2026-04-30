#!/usr/bin/env bash
#
# Reset the draba test environment to a known clean state.
# Run on the docker host (epcot.lan) as the `draba-test` user
# (which must be in the `docker` group). No sudo required.
#
# What it does:
#   1. Stops the `draba` container
#   2. Wipes the SQLite DB files via a one-off `alpine` container
#      (so file permissions inside the bind mount don't matter)
#   3. Starts `draba` — its boot-time migration runner creates the
#      fresh schema
#   4. Waits up to 30s for `schema_migrations` to be queryable
#   5. Stops `draba` again, seeds a bootstrap team + a known invite
#      token via a one-off `sqlite3` container, then restarts
#
# Required env (sourced from $HOME/.draba-test.env at the top):
#   DRABA_TEST_INVITE_TOKEN  — known token the api-smoke subagent uses
#   DRABA_TEST_ADMIN_EMAIL   — bootstrap admin (invite issuer) email
#   DRABA_TEST_INVITE_EMAIL  — email the invite is issued to; the
#                              smoke test registers as this user
#                              (default: invitee@local)
#   DRABA_DB_DIR             — host bind-mount dir holding draba.db
#   DRABA_CONTAINER          — container name (default: draba)
#   DRABA_DB_FILENAME        — DB filename inside DRABA_DB_DIR
#                              (default: draba.db)

set -euo pipefail

ENV_FILE="${HOME}/.draba-test.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

: "${DRABA_TEST_INVITE_TOKEN:?must be set in ~/.draba-test.env}"
: "${DRABA_TEST_ADMIN_EMAIL:?must be set in ~/.draba-test.env}"
: "${DRABA_DB_DIR:?must be set in ~/.draba-test.env}"
DRABA_CONTAINER="${DRABA_CONTAINER:-draba}"
DRABA_DB_FILENAME="${DRABA_DB_FILENAME:-draba.db}"
DRABA_TEST_INVITE_EMAIL="${DRABA_TEST_INVITE_EMAIL:-invitee@local}"

SQLITE_IMG="keinos/sqlite3:latest"
ALPINE_IMG="alpine:latest"

echo "[1/6] Stopping container '$DRABA_CONTAINER'..."
docker stop "$DRABA_CONTAINER" >/dev/null

echo "[2/6] Wiping DB files in $DRABA_DB_DIR..."
docker run --rm -v "$DRABA_DB_DIR:/data" "$ALPINE_IMG" sh -c \
    "rm -f /data/${DRABA_DB_FILENAME} /data/${DRABA_DB_FILENAME}-shm /data/${DRABA_DB_FILENAME}-wal"

echo "[3/6] Starting container (migrations run on boot)..."
docker start "$DRABA_CONTAINER" >/dev/null

echo "[4/6] Waiting for migrations to complete..."
for i in $(seq 1 30); do
    if docker run --rm -v "$DRABA_DB_DIR:/data:ro" "$SQLITE_IMG" \
         sqlite3 "/data/${DRABA_DB_FILENAME}" \
         "SELECT 1 FROM schema_migrations LIMIT 1;" >/dev/null 2>&1; then
        break
    fi
    sleep 1
    if [[ "$i" -eq 30 ]]; then
        echo "ERROR: migrations did not complete within 30s" >&2
        exit 1
    fi
done

echo "[5/6] Stopping container to seed exclusively..."
docker stop "$DRABA_CONTAINER" >/dev/null

ADMIN_ID="bootstrap-admin"
TEAM_ID="bootstrap-team"
INVITE_ID="bootstrap-invite"
EXPIRES=$(date -u -d '+7 days' '+%Y-%m-%d %H:%M:%S')

docker run --rm -i --user 0:0 -v "$DRABA_DB_DIR:/data" "$SQLITE_IMG" \
    sqlite3 "/data/${DRABA_DB_FILENAME}" <<SQL
INSERT INTO users (id, email, password_hash, display_name)
VALUES ('${ADMIN_ID}', '${DRABA_TEST_ADMIN_EMAIL}', 'x-not-loginable', 'Test Bootstrap');

INSERT INTO teams (id, name, slug)
VALUES ('${TEAM_ID}', 'Test Team', 'test-team');

INSERT INTO team_members (team_id, user_id, role)
VALUES ('${TEAM_ID}', '${ADMIN_ID}', 'admin');

INSERT INTO invites (id, team_id, email, token, role, invited_by, expires_at)
VALUES ('${INVITE_ID}', '${TEAM_ID}', '${DRABA_TEST_INVITE_EMAIL}', '${DRABA_TEST_INVITE_TOKEN}', 'member', '${ADMIN_ID}', '${EXPIRES}');
SQL

echo "[6/6] Restarting container..."
docker start "$DRABA_CONTAINER" >/dev/null

echo "Done. Test invite token is ready. The api-smoke subagent can now register against it."
