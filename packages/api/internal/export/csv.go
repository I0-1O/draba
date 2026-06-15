package export

import (
	"encoding/csv"
	"io"
)

// WriteCSV writes rows as CSV, with Columns as the header row.
func WriteCSV(w io.Writer, rows []Row) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(Columns); err != nil {
		return err
	}
	for i := range rows {
		if err := cw.Write(rows[i].Values()); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}
