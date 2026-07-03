package importer

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/I0-1O/draba/packages/api/internal/export"
)

// Template example rows: one minimal (title/start/end only) and one full
// (every column, including a multi-assignee cell with an email and a Parent
// reference to the first row). Column order comes from export.Columns so the
// template is the export header row by construction.
var templateRows = [][]string{
	{"Kickoff meeting", "2026-03-02", "2026-03-02", "", "", "", "", "", "", "", ""},
	{
		"Launch website", "2026-03-09", "2026-03-20",
		"Ship the new marketing site", "In Progress",
		"Alex Chen, sam@example.com", "launch, q3", "Kickoff meeting",
		"50", "HQ", "https://example.com",
	},
}

// TemplateCSV renders the downloadable CSV import template.
func TemplateCSV() ([]byte, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	if err := w.Write(export.Columns); err != nil {
		return nil, err
	}
	for _, row := range templateRows {
		if err := w.Write(row); err != nil {
			return nil, err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// TemplateXLSX renders the downloadable xlsx import template. Start/End are
// written as native date cells so Excel users stay in typed dates.
func TemplateXLSX() ([]byte, error) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()

	const sheet = "Activities"
	if err := f.SetSheetName("Sheet1", sheet); err != nil {
		return nil, err
	}

	dateStyle, err := f.NewStyle(&excelize.Style{CustomNumFmt: strPtr("yyyy-mm-dd")})
	if err != nil {
		return nil, err
	}

	for col, name := range export.Columns {
		cell, err := excelize.CoordinatesToCellName(col+1, 1)
		if err != nil {
			return nil, err
		}
		if err := f.SetCellStr(sheet, cell, name); err != nil {
			return nil, err
		}
	}

	dateCols := map[int]bool{1: true, 2: true} // Start, End (0-based)
	for r, row := range templateRows {
		for c, val := range row {
			cell, err := excelize.CoordinatesToCellName(c+1, r+2)
			if err != nil {
				return nil, err
			}
			if dateCols[c] && val != "" {
				t, err := time.Parse(isoDate, val)
				if err != nil {
					return nil, fmt.Errorf("template date %q: %w", val, err)
				}
				if err := f.SetCellValue(sheet, cell, t); err != nil {
					return nil, err
				}
				if err := f.SetCellStyle(sheet, cell, cell, dateStyle); err != nil {
					return nil, err
				}
				continue
			}
			if err := f.SetCellStr(sheet, cell, val); err != nil {
				return nil, err
			}
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func strPtr(s string) *string { return &s }
