// Package importer parses CSV/xlsx uploads into validated, resolved activity
// rows for the Phase 15 tabular import. The contract is "liberal parse, strict
// write, everything visible": messy-but-unambiguous input is accepted, every
// interpretation the parser makes surfaces as a per-cell warning, and rows
// that cannot be made valid are excluded (row-scoped errors, never
// file-scoped). The package is pure — it never touches the database; callers
// supply name-to-ID Lookups and write the Resolved payloads themselves.
package importer

import (
	"errors"
	"sort"
	"strings"
	"time"
)

// Size caps for uploaded files. Generous for the target market (small/medium
// teams); they exist to protect the synchronous request path.
const (
	MaxFileBytes = 2 << 20 // 2 MB
	MaxRows      = 2000    // data rows, excluding the header
)

// Issue levels. A cell parses ok (no issue recorded), with interpretation
// (warning — written as stated), or not at all (error — row excluded).
const (
	LevelWarning = "warning"
	LevelError   = "error"
)

// Row statuses, the roll-up of a row's issue levels.
const (
	RowOK      = "ok"
	RowWarning = "warning"
	RowError   = "error"
)

// Field names for the import mapping, matching the camelCase JSON field names
// used across the API.
const (
	FieldTitle       = "title"
	FieldStart       = "start"
	FieldEnd         = "end"
	FieldDescription = "description"
	FieldStatus      = "status"
	FieldAssignees   = "assignees"
	FieldTags        = "tags"
	FieldParent      = "parent"
	FieldProgress    = "progress"
	FieldLocation    = "location"
	FieldURL         = "url"
)

// validFields is the set of assignable mapping targets.
var validFields = map[string]bool{
	FieldTitle: true, FieldStart: true, FieldEnd: true, FieldDescription: true,
	FieldStatus: true, FieldAssignees: true, FieldTags: true, FieldParent: true,
	FieldProgress: true, FieldLocation: true, FieldURL: true,
}

// FileError is a structural, file-scoped failure (unsupported type, over the
// caps, no mappable Title column, …). Handlers translate it to a 400; row
// content problems never produce a FileError.
type FileError struct {
	Message string
}

func (e *FileError) Error() string { return e.Message }

// IsFileError reports whether err is a file-scoped import error.
func IsFileError(err error) bool {
	var fe *FileError
	return errors.As(err, &fe)
}

// Options are the caller's import settings, decoded from the request's
// `options` multipart part.
type Options struct {
	// DryRun selects the preview pass; false commits.
	DryRun bool `json:"dryRun"`
	// Mapping maps file column headers to field names. When nil the server
	// auto-maps; when set it is authoritative (columns absent from it are
	// ignored with a warning).
	Mapping map[string]string `json:"mapping,omitempty"`
	// DateOrder ("mdy" | "dmy") disambiguates numeric dates only when the
	// file itself stays ambiguous column-wide. Defaults to "mdy".
	DateOrder string `json:"dateOrder,omitempty"`
	// CreateMissingTags opts in to creating unknown tag names instead of
	// warn-and-skip.
	CreateMissingTags bool `json:"createMissingTags,omitempty"`
}

// Lookups carries the target timeline/team's name-to-ID resolution data.
// All keys are normalized with NormalizeName.
type Lookups struct {
	// Statuses maps a normalized status name to its ID on the target timeline.
	Statuses map[string]string
	// MembersByName maps a normalized display name to member IDs; more than
	// one ID means the name is ambiguous ("use email").
	MembersByName map[string][]string
	// MembersByEmail maps a normalized email to a member ID.
	MembersByEmail map[string]string
	// Tags maps a normalized tag name to its ID.
	Tags map[string]string
	// ActivitiesByTitle maps a normalized title to existing activity IDs on
	// the target timeline, for Parent resolution.
	ActivitiesByTitle map[string][]string
	// ExistingKeys holds DuplicateKey values for every existing activity, for
	// "possible duplicate" warnings.
	ExistingKeys map[string]bool
}

// NormalizeName canonicalizes a name for matching: trim, collapse internal
// whitespace, casefold.
func NormalizeName(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

// DuplicateKey builds the identity key used for possible-duplicate detection:
// normalized title + start + end (ISO dates).
func DuplicateKey(title, startISO, endISO string) string {
	return NormalizeName(title) + "\x00" + startISO + "\x00" + endISO
}

// Issue is one disclosed parser decision or failure, scoped to a field when
// Field is non-empty.
type Issue struct {
	Level   string `json:"level"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

// PreviewActivity is the resolved, display-oriented projection of a row for
// the preview table. Names are shown (not IDs) because the preview's job is
// to let a human ratify the parser's interpretations.
type PreviewActivity struct {
	Title       string   `json:"title"`
	Start       string   `json:"start,omitempty"`
	End         string   `json:"end,omitempty"`
	Description string   `json:"description,omitempty"`
	Status      string   `json:"status,omitempty"`
	Assignees   []string `json:"assignees,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Parent      string   `json:"parent,omitempty"`
	Progress    *int     `json:"progress,omitempty"`
	Location    string   `json:"location,omitempty"`
	URL         string   `json:"url,omitempty"`
}

// Resolved is the validated write payload for one accepted row. It is never
// serialized; the commit pass in the handler turns it into repository writes.
type Resolved struct {
	Title            string
	Start            time.Time
	End              time.Time
	Description      *string
	StatusID         *string
	AssigneeIDs      []string
	TagIDs           []string
	MissingTags      []string // tag names to create when CreateMissingTags
	ParentRowIndex   int      // index into Result.Rows; -1 = none or existing
	ParentActivityID *string  // existing activity, when ParentRowIndex is -1
	ParentRaw        string   // the Parent cell text, for the resolution pass
	Progress         *int
	Location         *string
	URL              *string
}

// RowResult is the outcome for one source row.
type RowResult struct {
	// Line is the 1-based source line / sheet row, for spreadsheet
	// cross-reference.
	Line     int              `json:"line"`
	Status   string           `json:"status"`
	Activity *PreviewActivity `json:"activity,omitempty"`
	Issues   []Issue          `json:"issues"`
	// CreatedID is filled on the commit pass for written rows.
	CreatedID string    `json:"createdId,omitempty"`
	Resolved  *Resolved `json:"-"`
}

// Summary is the roll-up shown in the preview strip. Created is zero on the
// dry-run pass.
type Summary struct {
	Total    int `json:"total"`
	OK       int `json:"ok"`
	Warnings int `json:"warnings"`
	Errors   int `json:"errors"`
	Created  int `json:"created"`
}

// UnknownNames lists the distinct unresolvable names encountered, in first-seen
// spelling. Tags drives the "Create N missing tags" checkbox label.
type UnknownNames struct {
	Statuses  []string `json:"statuses"`
	Assignees []string `json:"assignees"`
	Tags      []string `json:"tags"`
}

// Result is the full outcome of one parse+validate pass — the response body
// for both the dry-run and (with CreatedID/Created filled) the commit pass.
type Result struct {
	// Mapping is the mapping actually used: every file column header mapped
	// to a field name, or "" when the column was ignored.
	Mapping      map[string]string `json:"mapping"`
	Summary      Summary           `json:"summary"`
	UnknownNames UnknownNames      `json:"unknownNames"`
	// FileIssues are file-level warnings (encoding fallback, ignored sheets,
	// ignored columns) that belong to no single row.
	FileIssues []Issue     `json:"fileIssues"`
	Rows       []RowResult `json:"rows"`
}

// Run parses, maps, and validates an uploaded file against the target
// timeline's lookups. It returns a *FileError for structural failures and a
// complete Result otherwise. Run never writes anything — the commit pass
// re-runs it on byte-identical input and writes the Resolved payloads.
func Run(data []byte, filename string, opts Options, lk Lookups) (*Result, error) {
	if len(data) == 0 {
		return nil, &FileError{Message: "file is empty"}
	}
	if len(data) > MaxFileBytes {
		return nil, &FileError{Message: "file exceeds the 2 MB limit"}
	}

	pf, err := parseFile(data, filename)
	if err != nil {
		return nil, err
	}
	if len(pf.rows) > MaxRows {
		return nil, &FileError{Message: "file exceeds the 2,000 row limit"}
	}

	mapping, fileIssues, err := buildMapping(pf.headers, opts.Mapping)
	if err != nil {
		return nil, err
	}
	fileIssues = append(pf.issues, fileIssues...)

	res := resolveRows(pf, mapping, opts, lk)
	res.Mapping = mappingByHeader(pf.headers, mapping)
	res.FileIssues = fileIssues

	// The OpenAPI contract declares fileIssues and per-row issues as required
	// arrays; nil slices would marshal as JSON null and break clients that
	// index into them.
	if res.FileIssues == nil {
		res.FileIssues = []Issue{}
	}
	for i := range res.Rows {
		if res.Rows[i].Issues == nil {
			res.Rows[i].Issues = []Issue{}
		}
	}
	return res, nil
}

// AcceptedOrder returns the indices of importable rows (ok and warning —
// error rows are excluded) ordered so every in-file parent precedes its
// children, satisfying the parent_activity_id foreign key during the commit
// transaction. Cycles were already broken by the resolver, so the walk
// terminates.
func AcceptedOrder(rows []RowResult) []int {
	order := make([]int, 0, len(rows))
	visited := make(map[int]bool, len(rows))
	var visit func(i int)
	visit = func(i int) {
		if visited[i] || rows[i].Resolved == nil || rows[i].Status == RowError {
			return
		}
		visited[i] = true
		if p := rows[i].Resolved.ParentRowIndex; p >= 0 {
			visit(p)
		}
		order = append(order, i)
	}
	for i := range rows {
		visit(i)
	}
	return order
}

// sortedUnique returns the distinct values in sorted order, so preview
// output is deterministic across runs.
func sortedUnique(values []string) []string {
	seen := make(map[string]bool, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	sort.Strings(out)
	return out
}
