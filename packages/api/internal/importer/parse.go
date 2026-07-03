package importer

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/xuri/excelize/v2"
)

// maxXLSXDecompressedBytes bounds what an uploaded workbook may decompress
// to — MaxFileBytes only caps the compressed zip.
const maxXLSXDecompressedBytes = 32 << 20 // 32 MB

// cell is one parsed cell. display is the user-visible value; serial is set
// for typed numeric xlsx cells carrying a number format (the raw value differs
// from the formatted one), which is how native Excel dates arrive.
type cell struct {
	display string
	serial  *float64
}

// parsedRow is one non-blank data row with its 1-based source line / sheet
// row number and any structural issues (e.g. extra cells).
type parsedRow struct {
	line   int
	cells  []cell
	issues []Issue
}

// parsedFile is the format-independent row model both parsers produce.
type parsedFile struct {
	headers []string
	rows    []parsedRow
	issues  []Issue // file-level warnings
}

// parseFile dispatches on the filename extension, falling back to content
// sniffing (xlsx files are zip archives, magic "PK").
func parseFile(data []byte, filename string) (*parsedFile, error) {
	lower := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(lower, ".xlsx"):
		return parseXLSX(data)
	case strings.HasSuffix(lower, ".csv"), strings.HasSuffix(lower, ".txt"):
		return parseCSV(data)
	case bytes.HasPrefix(data, []byte("PK")):
		return parseXLSX(data)
	default:
		return nil, &FileError{Message: "unsupported file type — upload a .csv or .xlsx file"}
	}
}

// parseCSV reads a delimited text file: UTF-8 (BOM tolerated) with a cp1252
// fallback, delimiter sniffed from the header line (comma, semicolon, tab).
func parseCSV(data []byte) (*parsedFile, error) {
	pf := &parsedFile{}

	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	if !utf8.Valid(data) {
		data = decodeCP1252(data)
		pf.issues = append(pf.issues, Issue{
			Level:   LevelWarning,
			Message: "file is not UTF-8 — read as Windows-1252",
		})
	}

	firstLine := data
	if i := bytes.IndexByte(data, '\n'); i >= 0 {
		firstLine = data[:i]
	}
	delim := sniffDelimiter(string(firstLine))

	r := csv.NewReader(bytes.NewReader(data))
	r.Comma = delim
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	first := true
	for {
		record, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, &FileError{Message: fmt.Sprintf("could not parse CSV: %v", err)}
		}
		line, _ := r.FieldPos(0)

		if first {
			for _, h := range record {
				pf.headers = append(pf.headers, strings.TrimSpace(h))
			}
			first = false
			continue
		}
		if row, ok := buildRow(line, record, len(pf.headers)); ok {
			pf.rows = append(pf.rows, row)
		}
	}
	if first {
		return nil, &FileError{Message: "file is empty"}
	}
	return pf, nil
}

// sniffDelimiter picks the delimiter with the highest raw count on the header
// line; comma wins ties (it is checked first).
func sniffDelimiter(header string) rune {
	best, bestCount := ',', strings.Count(header, ",")
	for _, cand := range []rune{';', '\t'} {
		if c := strings.Count(header, string(cand)); c > bestCount {
			best, bestCount = cand, c
		}
	}
	return best
}

// buildRow normalizes one record against the header width: fully blank rows
// are dropped (ok=false), short rows are padded with empties, extra non-empty
// cells produce a row warning.
func buildRow(line int, record []string, width int) (parsedRow, bool) {
	row := parsedRow{line: line}
	blank := true
	for _, v := range record {
		if strings.TrimSpace(v) != "" {
			blank = false
			break
		}
	}
	if blank {
		return row, false
	}

	for i := 0; i < width; i++ {
		v := ""
		if i < len(record) {
			v = strings.TrimSpace(record[i])
		}
		row.cells = append(row.cells, cell{display: v})
	}
	extra := 0
	for i := width; i < len(record); i++ {
		if strings.TrimSpace(record[i]) != "" {
			extra++
		}
	}
	if extra > 0 {
		row.issues = append(row.issues, Issue{
			Level:   LevelWarning,
			Message: fmt.Sprintf("row has %d more cells than there are headers — extras ignored", extra),
		})
	}
	return row, true
}

// parseXLSX reads the first non-empty sheet of a workbook. Cells are read
// twice — raw and formatted — so typed numeric cells (where the two differ)
// can be recognized; that is how native Excel date serials are detected
// without any string guessing.
func parseXLSX(data []byte) (*parsedFile, error) {
	// The 2 MB cap bounds the compressed zip only; these bound what it may
	// decompress to, so a crafted workbook (zip bomb) cannot exhaust memory
	// in GetRows. 32 MB is far above any legitimate 2,000-row sheet.
	f, err := excelize.OpenReader(bytes.NewReader(data), excelize.Options{
		UnzipSizeLimit:    maxXLSXDecompressedBytes,
		UnzipXMLSizeLimit: maxXLSXDecompressedBytes,
	})
	if err != nil {
		return nil, &FileError{Message: "could not open xlsx file"}
	}
	defer func() { _ = f.Close() }()

	pf := &parsedFile{}
	var sheet string
	var formatted, raw [][]string
	var skipped []string
	for _, name := range f.GetSheetList() {
		if sheet != "" {
			skipped = append(skipped, name)
			continue
		}
		rows, err := f.GetRows(name)
		if err != nil {
			return nil, &FileError{Message: fmt.Sprintf("could not read sheet %q", name)}
		}
		if !sheetHasContent(rows) {
			continue
		}
		rawRows, err := f.GetRows(name, excelize.Options{RawCellValue: true})
		if err != nil {
			return nil, &FileError{Message: fmt.Sprintf("could not read sheet %q", name)}
		}
		sheet, formatted, raw = name, rows, rawRows
	}
	if sheet == "" {
		return nil, &FileError{Message: "workbook has no non-empty sheet"}
	}
	if len(skipped) > 0 {
		pf.issues = append(pf.issues, Issue{
			Level:   LevelWarning,
			Message: fmt.Sprintf("only sheet %q was imported — ignored: %s", sheet, strings.Join(skipped, ", ")),
		})
	}

	for _, h := range formatted[0] {
		pf.headers = append(pf.headers, strings.TrimSpace(h))
	}
	for i := 1; i < len(formatted); i++ {
		row, ok := buildRow(i+1, formatted[i], len(pf.headers))
		if !ok {
			continue
		}
		// Mark typed numeric cells: raw parses as a number and differs from
		// the formatted value, meaning the cell carries a number format
		// (dates, percentages) rather than literal text.
		for c := range row.cells {
			rawVal := ""
			if i < len(raw) && c < len(raw[i]) {
				rawVal = strings.TrimSpace(raw[i][c])
			}
			if rawVal == "" || rawVal == row.cells[c].display {
				continue
			}
			if n, err := strconv.ParseFloat(rawVal, 64); err == nil {
				v := n
				row.cells[c].serial = &v
			}
		}
		pf.rows = append(pf.rows, row)
	}
	return pf, nil
}

func sheetHasContent(rows [][]string) bool {
	for _, r := range rows {
		for _, v := range r {
			if strings.TrimSpace(v) != "" {
				return true
			}
		}
	}
	return false
}

// cp1252High maps bytes 0x80–0x9F, the only range where Windows-1252 differs
// from Latin-1. Unmapped control bytes fall back to U+FFFD.
var cp1252High = [32]rune{
	0x20AC, 0xFFFD, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
	0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0xFFFD, 0x017D, 0xFFFD,
	0xFFFD, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
	0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0xFFFD, 0x017E, 0x0178,
}

// decodeCP1252 transcodes Windows-1252 bytes to UTF-8. Every byte maps, so
// this never fails — the caller has already attached the encoding warning.
func decodeCP1252(data []byte) []byte {
	var b strings.Builder
	b.Grow(len(data) * 2)
	for _, c := range data {
		switch {
		case c < 0x80:
			b.WriteByte(c)
		case c < 0xA0:
			b.WriteRune(cp1252High[c-0x80])
		default:
			b.WriteRune(rune(c))
		}
	}
	return []byte(b.String())
}
