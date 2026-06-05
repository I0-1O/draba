// Package sampledata embeds the SQL seed files in this directory so the server
// can optionally load them at startup (see db.SeedSampleDataIfEmpty), without
// depending on the repo being present on disk next to the binary.
//
// The same .sql files are still the source of truth for the manual
// `cat sample_data/*.sql | sqlite3 draba.db` flow and the TestSampleDataLoads
// test — this package just makes them reachable from the compiled binary.
package sampledata

import (
	"embed"
	"io/fs"
	"sort"
	"strings"
)

//go:embed *.sql
var files embed.FS

// SQL returns every embedded *.sql file concatenated in ascending filename
// order (00_flush, 01_users, …, 11_shares), matching the numeric prefixes that
// encode FK-safe insertion order.
func SQL() (string, error) {
	entries, err := fs.Glob(files, "*.sql")
	if err != nil {
		return "", err
	}
	sort.Strings(entries)

	var b strings.Builder
	for _, name := range entries {
		content, err := files.ReadFile(name)
		if err != nil {
			return "", err
		}
		b.Write(content)
		b.WriteString("\n")
	}
	return b.String(), nil
}
