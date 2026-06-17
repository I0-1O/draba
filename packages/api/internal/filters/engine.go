// Package filters provides the server-side activity filter evaluator.
//
// It is a Go port of the TypeScript matchesFilter function in
// packages/web/src/lib/filterEngine.ts. Both implementations must agree on
// every test case in packages/shared/testdata/filter-fixtures.json — that file
// is the single source of truth for expected behaviour.
package filters

import (
	"strings"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// FilterLogic controls how conditions in a FilterDefinition are combined.
type FilterLogic string

// LogicAnd and LogicOr are the two values for FilterLogic.
const (
	LogicAnd FilterLogic = "and"
	LogicOr  FilterLogic = "or"
)

// FilterDefinition is the top-level filter object, matching the TypeScript type
// of the same name. Conditions are evaluated with the specified Logic.
type FilterDefinition struct {
	Logic      FilterLogic `json:"logic"`
	Conditions []Condition `json:"conditions"`
}

// Condition is a single filter rule. Field determines which activity field is
// tested; Op and Value carry the operator and operand(s). The exact types mirror
// the TypeScript FilterCondition union.
type Condition struct {
	Field string `json:"field"`
	Op    string `json:"op"`
	// Value is the raw JSON value for the condition's operand. Its concrete Go
	// type depends on the field: string, []string, float64, or []string pair.
	// We unmarshal as interface{} and interpret per-field below.
	Value interface{} `json:"value,omitempty"`
}

// FilterContext carries the reference data needed to evaluate status-name and
// tag-name conditions without performing additional DB lookups.
type FilterContext struct {
	// StatusesByTimelineID maps timeline_id → that timeline's live statuses.
	StatusesByTimelineID map[string][]models.Status
	// Tags holds all team tags (for resolving tagIds → names).
	Tags []models.Tag
}

// MatchesFilter reports whether activity satisfies def given ctx.
// An empty conditions slice always matches (no filtering applied).
func MatchesFilter(activity *models.Activity, def *FilterDefinition, ctx *FilterContext) bool {
	if len(def.Conditions) == 0 {
		return true
	}

	results := make([]bool, len(def.Conditions))
	for i, c := range def.Conditions {
		results[i] = evalCondition(&c, activity, ctx)
	}

	if def.Logic == LogicOr {
		for _, r := range results {
			if r {
				return true
			}
		}
		return false
	}
	// default: "and"
	for _, r := range results {
		if !r {
			return false
		}
	}
	return true
}

// ── Condition evaluation ──────────────────────────────────────────────────────

func evalCondition(c *Condition, a *models.Activity, ctx *FilterContext) bool {
	switch c.Field {
	case "status":
		statuses := ctx.StatusesByTimelineID[a.TimelineID]
		statusName := ""
		if a.StatusID != nil {
			for i := range statuses {
				if statuses[i].ID == *a.StatusID {
					statusName = strings.ToLower(statuses[i].Name)
					break
				}
			}
		}
		var haystack []string
		if statusName != "" {
			haystack = []string{statusName}
		}
		needles := toLowerStrings(toStringSlice(c.Value))
		return evalSetOp(c.Op, haystack, needles)

	case "tag":
		tagMap := make(map[string]string, len(ctx.Tags))
		for _, t := range ctx.Tags {
			tagMap[t.ID] = strings.ToLower(t.Name)
		}
		actTagNames := make([]string, 0, len(a.TagIDs))
		for _, id := range a.TagIDs {
			if name, ok := tagMap[id]; ok {
				actTagNames = append(actTagNames, name)
			} else {
				actTagNames = append(actTagNames, strings.ToLower(id))
			}
		}
		needles := toLowerStrings(toStringSlice(c.Value))
		return evalSetOp(c.Op, actTagNames, needles)

	case "assignee":
		needles := toStringSlice(c.Value)
		return evalSetOp(c.Op, a.AssignedMemberIDs, needles)

	case "title":
		return evalStringOp(c.Op, a.Title, toString(c.Value))

	case "progress":
		var v *float64
		if a.PercentComplete != nil {
			f := float64(*a.PercentComplete)
			v = &f
		}
		return evalNumberOp(c.Op, v, toFloat(c.Value))

	case "hasParent":
		return evalBoolOp(c.Op, a.ParentActivityID != nil)

	case "startDate":
		return evalDateOp(c.Op, a.StartAt.Format(time.RFC3339), c.Value)

	case "endDate":
		return evalDateOp(c.Op, a.EndAt.Format(time.RFC3339), c.Value)
	}
	return false
}

// ── Operator helpers ──────────────────────────────────────────────────────────

func evalSetOp(op string, haystack, needles []string) bool {
	switch op {
	case "in":
		for _, n := range needles {
			for _, h := range haystack {
				if h == n {
					return true
				}
			}
		}
		return false
	case "not_in":
		for _, n := range needles {
			for _, h := range haystack {
				if h == n {
					return false
				}
			}
		}
		return true
	case "is_empty":
		return len(haystack) == 0
	case "is_not_empty":
		return len(haystack) > 0
	}
	return false
}

func evalStringOp(op, value, target string) bool {
	v := strings.ToLower(strings.TrimSpace(value))
	t := strings.ToLower(target)
	switch op {
	case "equals":
		return v == t
	case "not_equals":
		return v != t
	case "contains":
		return strings.Contains(v, t)
	case "not_contains":
		return !strings.Contains(v, t)
	case "is_empty":
		return strings.TrimSpace(v) == ""
	case "is_not_empty":
		return strings.TrimSpace(v) != ""
	}
	return false
}

func evalNumberOp(op string, value *float64, target float64) bool {
	if op == "is_empty" {
		return value == nil
	}
	if op == "is_not_empty" {
		return value != nil
	}
	if value == nil {
		return false
	}
	v := *value
	switch op {
	case "equals":
		return v == target
	case "not_equals":
		return v != target
	case "gt":
		return v > target
	case "gte":
		return v >= target
	case "lt":
		return v < target
	case "lte":
		return v <= target
	}
	return false
}

func evalBoolOp(op string, value bool) bool {
	return (op == "is_true") == value
}

func evalDateOp(op, dateStr string, target interface{}) bool {
	if op == "is_empty" {
		return dateStr == ""
	}
	if op == "is_not_empty" {
		return dateStr != ""
	}
	if dateStr == "" || target == nil {
		return false
	}

	date, err := parseDate(dateStr)
	if err != nil {
		return false
	}

	if op == "between" {
		pair, ok := toStringPair(target)
		if !ok {
			return false
		}
		from, err1 := parseDate(pair[0])
		to, err2 := parseDate(pair[1])
		if err1 != nil || err2 != nil {
			return false
		}
		return !date.Before(from) && !date.After(to)
	}

	targetDate, err := parseDate(toString(target))
	if err != nil {
		return false
	}
	switch op {
	case "before":
		return date.Before(targetDate)
	case "after":
		return date.After(targetDate)
	}
	return false
}

// ── Type coercion helpers ─────────────────────────────────────────────────────

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func toFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	}
	return 0
}

func toStringSlice(v interface{}) []string {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok {
		return []string{s}
	}
	if arr, ok := v.([]interface{}); ok {
		out := make([]string, 0, len(arr))
		for _, el := range arr {
			if s, ok := el.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	if ss, ok := v.([]string); ok {
		return ss
	}
	return nil
}

func toStringPair(v interface{}) ([2]string, bool) {
	arr, ok := v.([]interface{})
	if !ok || len(arr) != 2 {
		return [2]string{}, false
	}
	a, ok1 := arr[0].(string)
	b, ok2 := arr[1].(string)
	if !ok1 || !ok2 {
		return [2]string{}, false
	}
	return [2]string{a, b}, true
}

func toLowerStrings(ss []string) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = strings.ToLower(s)
	}
	return out
}

func parseDate(s string) (time.Time, error) {
	// Try RFC3339 first (e.g. "2026-05-01T00:00:00Z"), then date-only.
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}
