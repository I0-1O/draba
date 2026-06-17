// Package ui holds the embedded React build artifacts served by the API in
// production. The static/ directory is populated by the Docker build process
// (web-builder stage copies packages/web/dist here); it is otherwise empty in
// development so the handler in server.go self-disables when index.html is absent.
package ui

import "embed"

// FS is the embedded filesystem containing the built React application.
//
//go:embed all:static
var FS embed.FS
