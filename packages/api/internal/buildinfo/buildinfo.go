// Package buildinfo exposes the build's git commit and timestamp so they can be
// logged at startup and served at GET /version. Values are injected at link time
// via -ldflags "-X .../buildinfo.Commit=<sha> -X .../buildinfo.Built=<ts>"; when
// not injected (e.g. a local `go build`/`go run` from a checkout) they fall back
// to Go's embedded VCS stamp.
package buildinfo

import "runtime/debug"

// Injected via -ldflags. Leave as the zero value to fall back to the VCS stamp.
var (
	Commit string
	Built  string
)

var dirty bool

func init() {
	if Commit != "" && Built != "" {
		return
	}
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return
	}
	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision":
			if Commit == "" {
				Commit = s.Value
			}
		case "vcs.time":
			if Built == "" {
				Built = s.Value
			}
		case "vcs.modified":
			dirty = s.Value == "true"
		}
	}
}

// Short returns the commit shortened to 12 chars, suffixed with "-dirty" when
// the working tree had uncommitted changes at build time. Returns "unknown"
// when no commit is available.
func Short() string {
	c := Commit
	if c == "" {
		return "unknown"
	}
	if len(c) > 12 {
		c = c[:12]
	}
	if dirty {
		c += "-dirty"
	}
	return c
}
