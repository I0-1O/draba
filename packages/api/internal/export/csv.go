package export

import (
	"encoding/csv"
	"io"
)

// WriteCSV writes rows as CSV, with Columns as the header row.
func WriteCSV(w io.Writer, rows []Row) error {
	return WriteCSVColumns(w, rows, nil)
}

// WriteCSVColumns writes rows as CSV using the given column subset.
// If columns is nil or empty, all Columns are written.
func WriteCSVColumns(w io.Writer, rows []Row, columns []string) error {
	cols := SelectColumns(columns)
	cw := csv.NewWriter(w)
	if err := cw.Write(cols); err != nil {
		return err
	}
	for i := range rows {
		if err := cw.Write(rows[i].ValuesByColumns(cols)); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}
