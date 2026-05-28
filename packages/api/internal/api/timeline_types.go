package api

// PatchTimelineJSONBody is the request body for PATCH /timelines/{id}.
type PatchTimelineJSONBody struct {
	Name      *string `json:"name,omitempty"`
	StartDate *string `json:"startDate,omitempty"`
	EndDate   *string `json:"endDate,omitempty"`
	Color     *string `json:"color,omitempty"`
	Icon      *string `json:"icon,omitempty"`
}

// CreateTimelineStatusJSONBody is the request body for POST /teams/{id}/timelines/{timelineId}/statuses.
type CreateTimelineStatusJSONBody struct {
	Name     string  `json:"name"`
	Color    *string `json:"color,omitempty"`
	Icon     *string `json:"icon,omitempty"`
	IsClosed *bool   `json:"isClosed,omitempty"`
}

// PatchStatusJSONBody is the request body for PATCH /statuses/{id}.
type PatchStatusJSONBody struct {
	Name     *string `json:"name,omitempty"`
	Color    *string `json:"color,omitempty"`
	Icon     *string `json:"icon,omitempty"`
	IsClosed *bool   `json:"isClosed,omitempty"`
	Position *int    `json:"position,omitempty"`
}

// DeleteStatusJSONBody is the optional request body for DELETE /statuses/{id}.
// When activities reference the status, replacementStatusId must be provided.
type DeleteStatusJSONBody struct {
	ReplacementStatusID *string `json:"replacementStatusId,omitempty"`
}

// GrantTimelineAccessJSONBody is the request body for PUT /teams/{id}/timelines/{timelineId}/access/{memberId}.
type GrantTimelineAccessJSONBody struct {
	Role string `json:"role"`
}
