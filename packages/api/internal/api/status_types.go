package api

// CreateStatusTemplateJSONBody is the request body for POST /teams/{id}/status-templates.
type CreateStatusTemplateJSONBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// PatchStatusTemplateJSONBody is the request body for PATCH /status-templates/{id}.
type PatchStatusTemplateJSONBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Position    *int    `json:"position,omitempty"`
}

// CreateStatusTemplateItemJSONBody is the request body for POST /status-templates/{id}/items.
type CreateStatusTemplateItemJSONBody struct {
	Name     string  `json:"name"`
	Color    *string `json:"color,omitempty"`
	Icon     *string `json:"icon,omitempty"`
	IsClosed *bool   `json:"isClosed,omitempty"`
}

// PatchStatusTemplateItemJSONBody is the request body for PATCH /status-template-items/{id}.
type PatchStatusTemplateItemJSONBody struct {
	Name     *string `json:"name,omitempty"`
	Color    *string `json:"color,omitempty"`
	Icon     *string `json:"icon,omitempty"`
	IsClosed *bool   `json:"isClosed,omitempty"`
	Position *int    `json:"position,omitempty"`
}
