package importer

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// resolveRows turns parsed rows into validated RowResults: field parsing,
// name-to-ID resolution, parent linking, duplicate disclosure, and the
// per-row status roll-up.
func resolveRows(pf *parsedFile, m *columnMapping, opts Options, lk Lookups) *Result {
	res := &Result{Rows: make([]RowResult, 0, len(pf.rows))}
	unknown := &unknownAcc{}
	ctx := resolveDateOrder(pf.rows, m, opts.DateOrder)

	for _, row := range pf.rows {
		rr := resolveRow(row, m, opts, ctx, lk, unknown)
		res.Rows = append(res.Rows, rr)
	}

	resolveParents(res.Rows, m, lk)

	for i := range res.Rows {
		rr := &res.Rows[i]
		rr.Status = rollup(rr.Issues)
		if rr.Status == RowError {
			rr.Resolved = nil
		}
		switch rr.Status {
		case RowOK:
			res.Summary.OK++
		case RowWarning:
			res.Summary.Warnings++
		case RowError:
			res.Summary.Errors++
		}
	}
	res.Summary.Total = len(res.Rows)

	res.UnknownNames = UnknownNames{
		Statuses:  sortedUnique(unknown.statuses),
		Assignees: sortedUnique(unknown.assignees),
		Tags:      sortedUnique(unknown.tags),
	}
	return res
}

// unknownAcc accumulates unresolvable names across all rows.
type unknownAcc struct {
	statuses, assignees, tags []string
}

// resolveRow parses and resolves every mapped cell of one row. Parent linking
// happens in a later pass (resolveParents) because it needs all rows.
func resolveRow(row parsedRow, m *columnMapping, opts Options, ctx dateContext, lk Lookups, unknown *unknownAcc) RowResult {
	rr := RowResult{Line: row.line, Issues: append([]Issue{}, row.issues...)}
	get := func(field string) cell {
		if i := m.col(field); i >= 0 && i < len(row.cells) {
			return row.cells[i]
		}
		return cell{}
	}
	addIssue := func(field, level, msg string) {
		rr.Issues = append(rr.Issues, Issue{Level: level, Field: field, Message: msg})
	}

	preview := &PreviewActivity{}
	resolved := &Resolved{ParentRowIndex: -1}
	rr.Activity = preview
	rr.Resolved = resolved

	// Title — the one hard-required field.
	title := get(FieldTitle).display
	preview.Title = title
	resolved.Title = title
	if title == "" {
		addIssue(FieldTitle, LevelError, "title is required")
	}

	resolved.ParentRaw = get(FieldParent).display

	startCell, endCell := get(FieldStart), get(FieldEnd)

	startOK := false
	if startCell.display == "" && startCell.serial == nil {
		addIssue(FieldStart, LevelError, "a start date is required")
	} else if t, issues, ok := parseDate(startCell, ctx); ok {
		resolved.Start = t
		preview.Start = t.Format(isoDate)
		startOK = true
		scopeIssues(&rr, FieldStart, issues)
	} else {
		scopeIssues(&rr, FieldStart, issues)
	}

	switch {
	case endCell.display == "" && endCell.serial == nil:
		if startOK {
			resolved.End = resolved.Start
			preview.End = preview.Start
			addIssue(FieldEnd, LevelWarning, "no end date — set to the start date (single day)")
		}
	default:
		if t, issues, ok := parseDate(endCell, ctx); ok {
			scopeIssues(&rr, FieldEnd, issues)
			if startOK && t.Before(resolved.Start) {
				addIssue(FieldEnd, LevelError, fmt.Sprintf(
					"end date %s is before start date %s", t.Format(isoDate), resolved.Start.Format(isoDate)))
			} else {
				resolved.End = t
				preview.End = t.Format(isoDate)
			}
		} else {
			scopeIssues(&rr, FieldEnd, issues)
		}
	}

	if v := get(FieldDescription).display; v != "" {
		preview.Description = v
		resolved.Description = &v
	}
	if v := get(FieldLocation).display; v != "" {
		preview.Location = v
		resolved.Location = &v
	}
	if v := get(FieldURL).display; v != "" {
		preview.URL = v
		resolved.URL = &v
	}

	// Status: normalized exact match; unknown → warning, no status.
	if v := get(FieldStatus).display; v != "" {
		if id, ok := lk.Statuses[NormalizeName(v)]; ok {
			resolved.StatusID = &id
			preview.Status = v
		} else {
			addIssue(FieldStatus, LevelWarning, fmt.Sprintf(
				"%q doesn't match a status on this timeline — skipped", v))
			unknown.statuses = append(unknown.statuses, v)
		}
	}

	// Assignees: each token matched by display name or email; unknown or
	// ambiguous tokens are skipped individually, the rest are kept. seenIDs
	// dedupes repeated tokens (or name + email of the same member) so the
	// commit never inserts a duplicate assignment row.
	seenIDs := make(map[string]bool)
	addAssignee := func(id, token string) {
		if !seenIDs[id] {
			seenIDs[id] = true
			resolved.AssigneeIDs = append(resolved.AssigneeIDs, id)
			preview.Assignees = append(preview.Assignees, token)
		}
	}
	for _, token := range splitMulti(get(FieldAssignees).display) {
		norm := NormalizeName(token)
		if id, ok := lk.MembersByEmail[norm]; ok {
			addAssignee(id, token)
			continue
		}
		ids := lk.MembersByName[norm]
		switch len(ids) {
		case 1:
			addAssignee(ids[0], token)
		case 0:
			addIssue(FieldAssignees, LevelWarning, fmt.Sprintf(
				"%q doesn't match a team member — skipped", token))
			unknown.assignees = append(unknown.assignees, token)
		default:
			addIssue(FieldAssignees, LevelWarning, fmt.Sprintf(
				"%q matches more than one team member — skipped (use their email instead)", token))
		}
	}

	// Tags: unknown names are skipped, or queued for creation when opted in.
	// Repeated tokens are deduped for the same reason as assignees.
	seenTags := make(map[string]bool)
	for _, token := range splitMulti(get(FieldTags).display) {
		norm := NormalizeName(token)
		if seenTags[norm] {
			continue
		}
		seenTags[norm] = true
		if id, ok := lk.Tags[norm]; ok {
			resolved.TagIDs = append(resolved.TagIDs, id)
			preview.Tags = append(preview.Tags, token)
			continue
		}
		unknown.tags = append(unknown.tags, token)
		if opts.CreateMissingTags {
			resolved.MissingTags = append(resolved.MissingTags, token)
			preview.Tags = append(preview.Tags, token)
			addIssue(FieldTags, LevelWarning, fmt.Sprintf("tag %q will be created", token))
		} else {
			addIssue(FieldTags, LevelWarning, fmt.Sprintf(
				"tag %q doesn't exist — skipped (enable \"create missing tags\" to add it)", token))
		}
	}

	// Progress: integer 0–100, optional % suffix, decimals rounded.
	if c := get(FieldProgress); c.display != "" {
		v := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(c.display), "%"))
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			// A typed percentage cell in Excel stores 50% as 0.5.
			if c.serial != nil && n > 0 && n < 1 {
				n *= 100
			}
			p := int(math.Round(n))
			if p >= 0 && p <= 100 {
				if n != float64(p) {
					addIssue(FieldProgress, LevelWarning, fmt.Sprintf("%q rounded to %d", c.display, p))
				}
				resolved.Progress = &p
				preview.Progress = &p
			} else {
				addIssue(FieldProgress, LevelWarning, fmt.Sprintf(
					"%q is outside 0–100 — skipped", c.display))
			}
		} else {
			addIssue(FieldProgress, LevelWarning, fmt.Sprintf(
				"%q is not a number — progress skipped", c.display))
		}
	}

	// Possible-duplicate disclosure (import stays additive).
	if title != "" && startOK && preview.End != "" {
		if lk.ExistingKeys[DuplicateKey(title, preview.Start, preview.End)] {
			rr.Issues = append(rr.Issues, Issue{Level: LevelWarning, Message: fmt.Sprintf(
				"possible duplicate — %q with the same dates already exists on this timeline", title)})
		}
	}

	return rr
}

// scopeIssues attaches parseDate's unscoped issues to a date field.
func scopeIssues(rr *RowResult, field string, issues []Issue) {
	for _, is := range issues {
		is.Field = field
		rr.Issues = append(rr.Issues, is)
	}
}

// resolveParents links Parent cells: rows in this file first (by normalized
// title), then existing activities on the target timeline. Ambiguity, errored
// parents, and in-file cycles all warn and skip the link — never error.
func resolveParents(rows []RowResult, m *columnMapping, lk Lookups) {
	parentCol := m.col(FieldParent)
	if parentCol < 0 {
		return
	}

	titleIndex := make(map[string][]int, len(rows))
	for i := range rows {
		if rows[i].Resolved != nil && rows[i].Resolved.Title != "" {
			titleIndex[NormalizeName(rows[i].Resolved.Title)] = append(
				titleIndex[NormalizeName(rows[i].Resolved.Title)], i)
		}
	}

	for i := range rows {
		rr := &rows[i]
		if rr.Resolved == nil {
			continue
		}
		v := rr.Resolved.ParentRaw
		if v == "" {
			continue
		}
		norm := NormalizeName(v)

		matches := make([]int, 0, 2)
		for _, j := range titleIndex[norm] {
			if j != i {
				matches = append(matches, j)
			}
		}
		switch {
		case len(matches) == 1:
			rr.Resolved.ParentRowIndex = matches[0]
		case len(matches) > 1:
			rr.warn(FieldParent, fmt.Sprintf(
				"%q matches more than one row in this file — parent link skipped", v))
		default:
			ids := lk.ActivitiesByTitle[norm]
			switch len(ids) {
			case 1:
				id := ids[0]
				rr.Resolved.ParentActivityID = &id
				rr.Activity.Parent = v
			case 0:
				rr.warn(FieldParent, fmt.Sprintf(
					"%q doesn't match a row in this file or an existing activity — parent link skipped", v))
			default:
				rr.warn(FieldParent, fmt.Sprintf(
					"%q matches more than one existing activity — parent link skipped", v))
			}
		}
	}

	// Break in-file cycles and drop links to rows that errored out.
	for i := range rows {
		rr := &rows[i]
		if rr.Resolved == nil || rr.Resolved.ParentRowIndex < 0 {
			continue
		}
		p := rr.Resolved.ParentRowIndex
		if rollup(rows[p].Issues) == RowError {
			rr.Resolved.ParentRowIndex = -1
			rr.warn(FieldParent, fmt.Sprintf(
				"parent row %d has errors and won't be imported — parent link skipped", rows[p].Line))
			continue
		}
		if hasParentCycle(rows, i) {
			rr.Resolved.ParentRowIndex = -1
			rr.warn(FieldParent, fmt.Sprintf(
				"%q creates a circular parent reference — parent link skipped", rr.Resolved.ParentRaw))
			continue
		}
		rr.Activity.Parent = rr.Resolved.ParentRaw
	}
}

// hasParentCycle walks the in-file parent chain from row i looking for a loop.
func hasParentCycle(rows []RowResult, i int) bool {
	seen := map[int]bool{i: true}
	for cur := rows[i].Resolved.ParentRowIndex; cur >= 0; {
		if seen[cur] {
			return true
		}
		seen[cur] = true
		if rows[cur].Resolved == nil {
			return false
		}
		cur = rows[cur].Resolved.ParentRowIndex
	}
	return false
}

// warn appends a field-scoped warning to the row.
func (rr *RowResult) warn(field, msg string) {
	rr.Issues = append(rr.Issues, Issue{Level: LevelWarning, Field: field, Message: msg})
}

// rollup collapses a row's issue levels into its status.
func rollup(issues []Issue) string {
	status := RowOK
	for _, is := range issues {
		if is.Level == LevelError {
			return RowError
		}
		status = RowWarning
	}
	return status
}

// splitMulti splits a multi-value cell on commas or semicolons, trimming and
// dropping empties.
func splitMulti(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.FieldsFunc(v, func(r rune) bool { return r == ',' || r == ';' })
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
