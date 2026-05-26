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

// newToken returns a 64-character hex token derived from 32 random bytes
// (256 bits). Use for invite tokens and other secrets; newID is for record IDs.
// The longer length makes tokens visually distinct from IDs and raises the
// brute-force bar.
func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
