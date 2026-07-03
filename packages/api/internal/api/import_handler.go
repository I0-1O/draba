package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/importer"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// importFormOverhead is the multipart framing + options-JSON allowance on top
// of the file cap when bounding the request body.
const importFormOverhead = 64 << 10

// handlePostTimelineImport handles POST /teams/{id}/timelines/{timelineId}/import.
// Stateless two-pass: the dry-run previews (provably read-only — no write
// transaction is ever opened) and the commit re-runs the identical parse on
// the re-uploaded bytes, then writes the accepted rows in one transaction.
func (s *Server) handlePostTimelineImport(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	timelineID := r.PathValue("timelineId")

	// Auth check before timeline lookup so non-members cannot enumerate
	// timeline IDs by observing a 404 vs. 401/403 distinction.
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

	r.Body = http.MaxBytesReader(w, r.Body, importer.MaxFileBytes+importFormOverhead)
	if err := r.ParseMultipartForm(importer.MaxFileBytes + importFormOverhead); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "expected multipart form data with a 'file' part under 2 MB")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "missing 'file' part")
		return
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, importer.MaxFileBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "failed to read uploaded file")
		return
	}
	if len(data) > importer.MaxFileBytes {
		writeError(w, http.StatusBadRequest, "IMPORT_FILE_INVALID", "file exceeds the 2 MB limit")
		return
	}

	// The options part is mandatory so a commit is always an explicit
	// dryRun:false — an accidental empty form can never write data.
	optsJSON := r.FormValue("options")
	if optsJSON == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "missing 'options' part")
		return
	}
	var opts importer.Options
	if err := json.Unmarshal([]byte(optsJSON), &opts); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid 'options' JSON")
		return
	}
	if opts.DateOrder != "" && opts.DateOrder != "mdy" && opts.DateOrder != "dmy" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "dateOrder must be 'mdy' or 'dmy'")
		return
	}

	lookups, ok := s.buildImportLookups(w, timeline)
	if !ok {
		return
	}

	result, err := importer.Run(data, header.Filename, opts, lookups)
	if err != nil {
		if importer.IsFileError(err) {
			writeError(w, http.StatusBadRequest, "IMPORT_FILE_INVALID", err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "import failed")
		return
	}

	if opts.DryRun {
		writeJSON(w, http.StatusOK, result)
		return
	}

	s.commitImport(w, r, timeline, opts, result)
}

// buildImportLookups loads the timeline/team records the resolver matches
// names against. Returns ok=false after writing an error response.
func (s *Server) buildImportLookups(w http.ResponseWriter, timeline *models.Timeline) (importer.Lookups, bool) {
	statuses, err := s.statuses.ListStatuses(timeline.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load statuses")
		return importer.Lookups{}, false
	}
	members, err := s.teams.ListMembers(timeline.TeamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load members")
		return importer.Lookups{}, false
	}
	tags, err := s.tags.ListByTeam(timeline.TeamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load tags")
		return importer.Lookups{}, false
	}
	acts, err := s.activities.ListByTimeline(timeline.ID, nil, nil, false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load activities")
		return importer.Lookups{}, false
	}
	return importer.BuildLookups(statuses, members, tags, acts), true
}

// commitImport writes the accepted rows of a validated Result in one
// transaction and publishes an ActivityCreated event per created activity.
func (s *Server) commitImport(w http.ResponseWriter, r *http.Request, timeline *models.Timeline, opts importer.Options, result *importer.Result) {
	claims := claimsFromContext(r.Context())
	now := time.Now()
	order := importer.AcceptedOrder(result.Rows)

	// Missing tags are created once per distinct name, before the activities
	// that reference them.
	var newTags []*models.Tag
	tagIDByName := make(map[string]string)
	if opts.CreateMissingTags {
		for _, i := range order {
			for _, name := range result.Rows[i].Resolved.MissingTags {
				norm := importer.NormalizeName(name)
				if _, exists := tagIDByName[norm]; exists {
					continue
				}
				tag := &models.Tag{
					ID: newID(), TeamID: timeline.TeamID, Name: name,
					CreatedBy: claims.UserID, CreatedAt: now,
				}
				tagIDByName[norm] = tag.ID
				newTags = append(newTags, tag)
			}
		}
	}

	// IDs are assigned up front so in-file parent references can be resolved
	// to real IDs before anything is written.
	ids := make([]string, len(result.Rows))
	for _, i := range order {
		ids[i] = newID()
	}

	items := make([]db.ImportItem, 0, len(order))
	created := make([]*models.Activity, 0, len(order))
	for _, i := range order {
		row := &result.Rows[i]
		rz := row.Resolved

		act := &models.Activity{
			ID:              ids[i],
			TimelineID:      timeline.ID,
			Title:           rz.Title,
			Description:     rz.Description,
			StartAt:         rz.Start,
			EndAt:           rz.End,
			AllDay:          true,
			StatusID:        rz.StatusID,
			PercentComplete: rz.Progress,
			Location:        rz.Location,
			URL:             rz.URL,
			CreatedBy:       claims.UserID,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if rz.ParentRowIndex >= 0 {
			parentID := ids[rz.ParentRowIndex]
			act.ParentActivityID = &parentID
		} else {
			act.ParentActivityID = rz.ParentActivityID
		}

		tagIDs := append([]string{}, rz.TagIDs...)
		for _, name := range rz.MissingTags {
			if id, ok := tagIDByName[importer.NormalizeName(name)]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		assigneeIDs := rz.AssigneeIDs
		if assigneeIDs == nil {
			assigneeIDs = []string{}
		}
		act.AssignedMemberIDs = assigneeIDs
		act.TagIDs = tagIDs

		items = append(items, db.ImportItem{Activity: act, AssigneeIDs: assigneeIDs, TagIDs: tagIDs})
		created = append(created, act)
		row.CreatedID = act.ID
	}

	if err := s.activities.CreateImportBatch(newTags, items); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "import failed — no rows were written")
		return
	}

	for _, act := range created {
		s.bus.Publish(events.Message{Type: events.ActivityCreated, TeamID: timeline.TeamID, Payload: act})
	}

	result.Summary.Created = len(created)
	writeJSON(w, http.StatusOK, result)
}

// handleGetImportTemplateCSV handles GET /import/template.csv.
func (s *Server) handleGetImportTemplateCSV(w http.ResponseWriter, _ *http.Request) {
	data, err := importer.TemplateCSV()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to build template")
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="draba-import-template.csv"`)
	_, _ = w.Write(data)
}

// handleGetImportTemplateXLSX handles GET /import/template.xlsx.
func (s *Server) handleGetImportTemplateXLSX(w http.ResponseWriter, _ *http.Request) {
	data, err := importer.TemplateXLSX()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to build template")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="draba-import-template.xlsx"`)
	_, _ = w.Write(data)
}
