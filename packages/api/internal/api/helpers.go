package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

// writeJSON sends v as a JSON response with the given status. Encoder
// errors are ignored: the headers are already on the wire by the time
// encoding happens, so there is nothing useful to do with the error.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes the standard {error: {code, message}} envelope used
// across the API. code is a stable machine identifier; message is a
// human-readable explanation safe to surface to end users.
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

// newID returns a 32-character hex ID derived from 16 random bytes
// (128 bits — enough entropy that collisions are not a concern).
func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
