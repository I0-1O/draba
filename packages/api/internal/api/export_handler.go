package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/export"
	"github.com/I0-1O/draba/packages/api/internal/filters"
	"github.com/I0-1O/draba/packages/api/internal/ics"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// exportRequestBody is the body for POST /timelines/{id}/export.
type exportRequestBody struct {
	Format     string                `json:"format"`
	ViewConfig *exportViewConfigJSON `json:"viewConfig,omitempty"`
}

// exportViewConfigJSON is the frozen view state captured by the export dialog.
//
// ActivityIDs, when non-empty, takes precedence over Filter: only those
// activities are exported, in the given order. This lets the client send
// preset-filtered or list-view-sorted rows without requiring server-side
// awareness of client-only filter kinds or sort state.
//
// Columns, when non-empty, restricts CSV/XLSX output to the named columns
// (matching export.Columns entries) in canonical order.
type exportViewConfigJSON struct {
	Filter      *filters.FilterDefinition `json:"filter,omitempty"`
	ActivityIDs []string                  `json:"activityIds,omitempty"`
	Columns     []string                  `json:"columns,omitempty"`
}

func isValidExportFormat(format string) bool {
	switch format {
	case "csv", "xlsx", "ics":
		return true
	default:
		return false
	}
}

func exportContentType(format string) string {
	switch format {
	case "csv":
		return "text/csv; charset=utf-8"
	case "xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case "ics":
		return "text/calendar; charset=utf-8"
	default:
		return "application/octet-stream"
	}
}

// exportFilename builds the download filename, pattern
// <timeline-slug>-<yyyy-mm-dd>.<ext>.
func exportFilename(timelineName, format string) string {
	return slugify(timelineName) + "-" + time.Now().UTC().Format("2006-01-02") + "." + format
}

// handlePostTimelineExport handles POST /timelines/{id}/export. The frozen
// filter (if any) is evaluated server-side with the Phase 13 Go matchesFilter
// port; an omitted viewConfig exports the whole timeline. Sync for v1.
func (s *Server) handlePostTimelineExport(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("id")

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}
	if timeline.ArchivedAt != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
		return
	}
	if _, ok := s.requireTeamMember(w, r, timeline.TeamID); !ok {
		return
	}

	var req exportRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if !isValidExportFormat(req.Format) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "format must be 'csv', 'xlsx', or 'ics'")
		return
	}

	s.writeTimelineExport(w, timeline, req.Format, req.ViewConfig)
}

// handleGetTimelineExportCSV handles GET /teams/{id}/timelines/{timelineId}/export.csv.
func (s *Server) handleGetTimelineExportCSV(w http.ResponseWriter, r *http.Request) {
	s.handleGetTimelineExport(w, r, "csv")
}

// handleGetTimelineExportXLSX handles GET /teams/{id}/timelines/{timelineId}/export.xlsx.
func (s *Server) handleGetTimelineExportXLSX(w http.ResponseWriter, r *http.Request) {
	s.handleGetTimelineExport(w, r, "xlsx")
}

// handleGetTimelineExportICS handles GET /teams/{id}/timelines/{timelineId}/export.ics.
func (s *Server) handleGetTimelineExportICS(w http.ResponseWriter, r *http.Request) {
	s.handleGetTimelineExport(w, r, "ics")
}

// handleGetTimelineExport is the shared implementation for the convenience GET
// export endpoints. An optional `?filter=<savedFilterId>` resolves a saved
// filter server-side (the 10.4.6 forward-compat hook) — the saved filter must
// belong to the same team as the timeline.
func (s *Server) handleGetTimelineExport(w http.ResponseWriter, r *http.Request, format string) {
	teamID := r.PathValue("id")
	timelineID := r.PathValue("timelineId")

	// Auth check before timeline lookup so non-members cannot enumerate timeline
	// IDs by observing a 404 vs. 401/403 distinction.
	if _, ok := s.requireTeamMember(w, r, teamID); !ok {
		return
	}

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}
	if timeline.ArchivedAt != nil || timeline.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
		return
	}

	var viewCfg *exportViewConfigJSON
	if filterID := r.URL.Query().Get("filter"); filterID != "" {
		saved, err := s.savedFilters.GetByID(filterID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeError(w, http.StatusBadRequest, "BAD_REQUEST", "filter not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load filter")
			return
		}
		if saved.TeamID != teamID {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "filter not found")
			return
		}
		var def filters.FilterDefinition
		if err := json.Unmarshal([]byte(saved.Definition), &def); err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to parse filter")
			return
		}
		viewCfg = &exportViewConfigJSON{Filter: &def}
	}

	s.writeTimelineExport(w, timeline, format, viewCfg)
}

// writeTimelineExport loads the timeline's activities and lookup data,
// applies the optional view config (filter or explicit activity IDs), and
// streams the requested format.
func (s *Server) writeTimelineExport(w http.ResponseWriter, timeline *models.Timeline, format string, viewCfg *exportViewConfigJSON) {
	acts, err := s.activities.ListByTimeline(timeline.ID, nil, nil, false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load activities")
		return
	}
	statuses, err := s.statuses.ListStatuses(timeline.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load statuses")
		return
	}
	members, err := s.teams.ListMembers(timeline.TeamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load members")
		return
	}
	tags, err := s.tags.ListByTeam(timeline.TeamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load tags")
		return
	}

	// Parent titles are resolved from the full, unfiltered activity set so a
	// parent excluded by the active filter still renders a readable title.
	activityTitles := make(map[string]string, len(acts))
	for _, a := range acts {
		activityTitles[a.ID] = a.Title
	}

	filtered := acts
	if viewCfg != nil && len(viewCfg.ActivityIDs) > 0 {
		// Client-supplied ordered ID list (used for preset/member filters and
		// list-view sort order, which the server cannot evaluate independently).
		actByID := make(map[string]*models.Activity, len(acts))
		for _, a := range acts {
			actByID[a.ID] = a
		}
		filtered = make([]*models.Activity, 0, len(viewCfg.ActivityIDs))
		for _, id := range viewCfg.ActivityIDs {
			if a, ok := actByID[id]; ok {
				filtered = append(filtered, a)
			}
		}
	} else if viewCfg != nil && viewCfg.Filter != nil && len(viewCfg.Filter.Conditions) > 0 {
		statusesByTL := map[string][]models.Status{timeline.ID: make([]models.Status, 0, len(statuses))}
		for _, st := range statuses {
			statusesByTL[timeline.ID] = append(statusesByTL[timeline.ID], *st)
		}
		modelTags := make([]models.Tag, 0, len(tags))
		for _, t := range tags {
			modelTags = append(modelTags, *t)
		}
		ctx := &filters.FilterContext{StatusesByTimelineID: statusesByTL, Tags: modelTags}

		filtered = make([]*models.Activity, 0, len(acts))
		for _, a := range acts {
			if filters.MatchesFilter(a, viewCfg.Filter, ctx) {
				filtered = append(filtered, a)
			}
		}
	}

	var columns []string
	if viewCfg != nil {
		columns = viewCfg.Columns
	}

	filename := exportFilename(timeline.Name, format)
	w.Header().Set("Content-Type", exportContentType(format))
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)

	switch format {
	case "csv":
		statusNames, memberNames, tagNames := exportNameMaps(statuses, members, tags)
		rows := export.BuildRows(filtered, statusNames, memberNames, tagNames, activityTitles)
		if err := export.WriteCSVColumns(w, rows, columns); err != nil {
			slog.Error("export: failed to write csv", "err", err)
		}
	case "xlsx":
		statusNames, memberNames, tagNames := exportNameMaps(statuses, members, tags)
		rows := export.BuildRows(filtered, statusNames, memberNames, tagNames, activityTitles)
		if err := export.WriteXLSXColumns(w, rows, columns); err != nil {
			slog.Error("export: failed to write xlsx", "err", err)
		}
	case "ics":
		body := buildTimelineExportICS(timeline, filtered, members, tags, statuses)
		if _, err := w.Write([]byte(body)); err != nil {
			slog.Error("export: failed to write ics", "err", err)
		}
	}
}

// exportNameMaps builds ID-to-display-name lookups for export rows.
func exportNameMaps(statuses []*models.Status, members []*models.TeamMemberWithUser, tags []*models.Tag) (statusNames, memberNames, tagNames map[string]string) {
	statusNames = make(map[string]string, len(statuses))
	for _, st := range statuses {
		statusNames[st.ID] = st.Name
	}
	memberNames = make(map[string]string, len(members))
	for _, m := range members {
		memberNames[m.ID] = m.DisplayName
	}
	tagNames = make(map[string]string, len(tags))
	for _, t := range tags {
		tagNames[t.ID] = t.Name
	}
	return statusNames, memberNames, tagNames
}

// buildTimelineExportICS renders an iCalendar document for a whole-timeline
// (optionally filtered) export. Unlike share ICS feeds, there is no member
// scoping — every event includes assignee names in its summary.
func buildTimelineExportICS(timeline *models.Timeline, acts []*models.Activity, members []*models.TeamMemberWithUser, tags []*models.Tag, statuses []*models.Status) string {
	memberName := make(map[string]string, len(members))
	for _, m := range members {
		if m.DisplayName != "" {
			memberName[m.ID] = m.DisplayName
		}
	}
	tagName := make(map[string]string, len(tags))
	for _, tg := range tags {
		tagName[tg.ID] = tg.Name
	}
	statusName := make(map[string]string, len(statuses))
	for _, st := range statuses {
		statusName[st.ID] = st.Name
	}

	events := activitiesToICSEvents(acts, memberName, tagName, statusName, true)
	return ics.Calendar(timeline.Name, events)
}
