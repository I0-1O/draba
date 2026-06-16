package export

import (
	"io"

	"github.com/xuri/excelize/v2"
)

const sheetName = "Activities"

// WriteXLSX writes rows to a single-sheet workbook, with Columns as the
// header row.
func WriteXLSX(w io.Writer, rows []Row) error {
	return WriteXLSXColumns(w, rows, nil)
}

// WriteXLSXColumns writes rows to a single-sheet workbook using the given
// column subset. If columns is nil or empty, all Columns are written.
func WriteXLSXColumns(w io.Writer, rows []Row, columns []string) error {
	cols := SelectColumns(columns)
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()

	if err := f.SetSheetName("Sheet1", sheetName); err != nil {
		return err
	}

	for col, name := range cols {
		cell, err := excelize.CoordinatesToCellName(col+1, 1)
		if err != nil {
			return err
		}
		if err := f.SetCellStr(sheetName, cell, name); err != nil {
			return err
		}
	}

	for i := range rows {
		for col, val := range rows[i].ValuesByColumns(cols) {
			cell, err := excelize.CoordinatesToCellName(col+1, i+2)
			if err != nil {
				return err
			}
			if err := f.SetCellStr(sheetName, cell, val); err != nil {
				return err
			}
		}
	}

	return f.Write(w)
}
