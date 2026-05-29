package db_test

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
)

func loadSampleDataSQL(t *testing.T) string {
	t.Helper()
	dir := filepath.Join("..", "..", "sample_data")
	entries, err := os.ReadDir(dir)
	require.NoError(t, err, "read sample_data directory")

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	var buf strings.Builder
	for _, f := range files {
		data, err := os.ReadFile(filepath.Join(dir, f))
		require.NoError(t, err, f)
		buf.Write(data)
		buf.WriteByte('\n')
	}
	return buf.String()
}

func TestSampleDataLoads(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	defer database.Close()

	require.NoError(t, db.Migrate(database))

	sql := loadSampleDataSQL(t)

	_, err = database.Exec(sql)
	require.NoError(t, err, "exec sample data")

	counts := map[string]int{
		"users":                 13,
		"teams":                 3,
		"team_members":          16,
		"timelines":             6,
		"activities":            58,
		"activity_assignments":  69,
		"statuses":              27,
		"status_templates":      5,
		"status_template_items": 21,
		"timeline_access":       32,
	}

	for table, want := range counts {
		var got int
		err := database.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&got)
		require.NoError(t, err, table)
		if got != want {
			t.Errorf("%s: got %d, want %d", table, got, want)
		}
	}

	// Re-run to verify idempotency (flush + reload)
	_, err = database.Exec(sql)
	require.NoError(t, err, "re-run sample data (idempotency)")

	for table, want := range counts {
		var got int
		database.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&got)
		if got != want {
			t.Errorf("idempotency: %s: got %d, want %d", table, got, want)
		}
	}
}
