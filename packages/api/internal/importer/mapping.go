package importer

import (
	"fmt"
	"strings"
)

// canonicalHeaders maps the normalized template headers (the export column
// names) to their fields. Exact template matches take precedence over the
// synonym table.
var canonicalHeaders = map[string]string{
	"title": FieldTitle, "start": FieldStart, "end": FieldEnd,
	"description": FieldDescription, "status": FieldStatus,
	"assignees": FieldAssignees, "tags": FieldTags, "parent": FieldParent,
	"progress": FieldProgress, "location": FieldLocation, "url": FieldURL,
}

// headerSynonyms is the tolerance table for headers from other tools'
// spreadsheets, keyed by normalized header text. A bare "date" column maps
// to Start (End then defaults per the date rules).
var headerSynonyms = map[string]string{
	// Title
	"name": FieldTitle, "task": FieldTitle, "activity": FieldTitle,
	"event": FieldTitle, "summary": FieldTitle, "what": FieldTitle,
	// Start
	"startdate": FieldStart, "begin": FieldStart, "from": FieldStart,
	"date": FieldStart, "begindate": FieldStart,
	// End
	"enddate": FieldEnd, "finish": FieldEnd, "to": FieldEnd,
	"due": FieldEnd, "duedate": FieldEnd, "until": FieldEnd,
	"finishdate": FieldEnd,
	// Description
	"notes": FieldDescription, "details": FieldDescription, "desc": FieldDescription,
	// Status
	"state": FieldStatus, "stage": FieldStatus, "column": FieldStatus,
	// Assignees
	"assignee": FieldAssignees, "assignedto": FieldAssignees,
	"owner": FieldAssignees, "who": FieldAssignees,
	"members": FieldAssignees, "people": FieldAssignees,
	// Tags
	"labels": FieldTags, "categories": FieldTags, "label": FieldTags,
	"category": FieldTags,
	// Parent
	"parenttask": FieldParent, "parentactivity": FieldParent,
	// Progress
	"complete": FieldProgress, "percent": FieldProgress,
	"completion": FieldProgress, "percentcomplete": FieldProgress,
	// Location
	"where": FieldLocation, "place": FieldLocation,
	// URL
	"link": FieldURL, "website": FieldURL,
}

// normalizeHeader strips everything but letters and digits and casefolds, so
// "End Date", "end_date", and "% Complete" all match their tables.
func normalizeHeader(h string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(h) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// columnMapping is the resolved mapping: fields[i] is the field for column i,
// or "" when the column is ignored.
type columnMapping struct {
	fields  []string
	byField map[string]int // field → column index
}

func (m *columnMapping) col(field string) int {
	if i, ok := m.byField[field]; ok {
		return i
	}
	return -1
}

// buildMapping resolves file headers to fields, either from the caller's
// explicit mapping or by auto-mapping (template headers, then synonyms).
// Unmapped columns are disclosed as file-level warnings; a missing Title
// target or two columns claiming the same field is a file-scoped error.
func buildMapping(headers []string, explicit map[string]string) (*columnMapping, []Issue, error) {
	m := &columnMapping{
		fields:  make([]string, len(headers)),
		byField: make(map[string]int),
	}
	var issues []Issue

	if explicit != nil {
		matched := make(map[string]bool, len(explicit))
		for i, h := range headers {
			field, ok := explicit[h]
			if !ok || field == "" {
				continue
			}
			if !validFields[field] {
				return nil, nil, &FileError{Message: fmt.Sprintf("unknown field %q in mapping", field)}
			}
			if prev, dup := m.byField[field]; dup {
				return nil, nil, &FileError{Message: fmt.Sprintf(
					"columns %q and %q are both mapped to %s — map one of them elsewhere", headers[prev], h, field)}
			}
			m.fields[i] = field
			m.byField[field] = i
			matched[h] = true
		}
		for col := range explicit {
			if explicit[col] != "" && !matched[col] {
				return nil, nil, &FileError{Message: fmt.Sprintf("mapping refers to column %q, which is not in the file", col)}
			}
		}
	} else {
		for i, h := range headers {
			norm := normalizeHeader(h)
			if norm == "" {
				continue
			}
			field, ok := canonicalHeaders[norm]
			if !ok {
				field, ok = headerSynonyms[norm]
			}
			if !ok {
				continue
			}
			if prev, dup := m.byField[field]; dup {
				return nil, nil, &FileError{Message: fmt.Sprintf(
					"columns %q and %q both map to %s — upload again with an explicit mapping", headers[prev], h, field)}
			}
			m.fields[i] = field
			m.byField[field] = i
		}
	}

	if m.col(FieldTitle) < 0 {
		return nil, nil, &FileError{Message: "no column maps to Title — a title column is required"}
	}

	for i, h := range headers {
		if m.fields[i] != "" {
			continue
		}
		name := h
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("(column %d)", i+1)
		}
		issues = append(issues, Issue{
			Level:   LevelWarning,
			Message: fmt.Sprintf("column %q not imported", name),
		})
	}
	return m, issues, nil
}

// mappingByHeader projects the resolved mapping back into the response shape:
// every header mapped to its field, "" for ignored columns.
func mappingByHeader(headers []string, m *columnMapping) map[string]string {
	out := make(map[string]string, len(headers))
	for i, h := range headers {
		name := h
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("(column %d)", i+1)
		}
		out[name] = m.fields[i]
	}
	return out
}
