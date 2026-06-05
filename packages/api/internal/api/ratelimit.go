package api

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// rateLimiter is a fixed-window, in-memory request counter keyed by an
// arbitrary string (here, client IP). It is deliberately dependency-free: the
// product ships as a single self-hosted binary, so an in-process limiter is
// preferred over an external store. State is lost on restart, which is
// acceptable for an anti-brute-force guard.
type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rlEntry
	limit   int
	window  time.Duration
}

type rlEntry struct {
	count   int
	resetAt time.Time
}

// newRateLimiter returns a limiter that permits limit events per key within
// each rolling window.
func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		entries: make(map[string]*rlEntry),
		limit:   limit,
		window:  window,
	}
}

// allow records an attempt for key and reports whether it is within the limit.
// Expired entries are reset on access; the whole map is pruned opportunistically
// when it grows large so distinct keys cannot leak memory unboundedly.
func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	if len(l.entries) > 10000 {
		for k, e := range l.entries {
			if now.After(e.resetAt) {
				delete(l.entries, k)
			}
		}
	}

	e, ok := l.entries[key]
	if !ok || now.After(e.resetAt) {
		l.entries[key] = &rlEntry{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if e.count >= l.limit {
		return false
	}
	e.count++
	return true
}

// clientIP extracts the caller's IP for rate-limiting purposes. It uses the
// transport-level RemoteAddr rather than X-Forwarded-For: a self-hosted caller
// can forge XFF to evade the limit, whereas RemoteAddr is set by the kernel.
// Behind a reverse proxy every request shares the proxy's IP, which fails
// closed (stricter) — the safe direction for an abuse guard.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
