# Go Comment Conventions

Apply this whenever generating, editing, or reviewing Go code in `packages/api/`.
Run `golangci-lint run` (which includes `revive`'s comment rules) before committing.

## The rules

### 1. Package header — exactly one per package

Every package must have a package comment on **one** file (conventionally
the file matching the package name, or `doc.go` for very large packages).
Other files in the package start with a bare `package x` line, no comment.

The header begins with `Package x ` and explains what the package is *for*,
not how it works internally.

```go
// Package tier defines the deployment tiers (Unlimited, Team, Business,
// Enterprise) and the per-tier limits and capability gates the API enforces.
package tier
```

For `package main`, lead with `Command <name> ...`:

```go
// Command draba is the API server entry point. It wires repositories,
// the auth token service, and tier configuration into the HTTP server.
package main
```

### 2. Exported identifiers — doc comment required, starts with the name

Every exported (capitalized) func, type, var, const, and method gets a
doc comment that **starts with the identifier's name**. This is what `go doc`
and pkg.go.dev render.

```go
// HashPassword returns a bcrypt hash of password using bcryptCost.
func HashPassword(password string) (string, error) { ... }

// TokenService signs and validates JWTs with a shared HMAC secret.
type TokenService struct { ... }

// ErrUserLimitReached is returned when a tier's MaxUsers cap would be exceeded.
var ErrUserLimitReached = errors.New("user limit reached for current tier")
```

Method receivers can be omitted from the leading phrase:

```go
// Validate parses and verifies tokenStr, returning its claims when ...
func (s *TokenService) Validate(tokenStr, expectedType string) (*Claims, error)
```

A grouped `var (...)` or `const (...)` block can have a single comment
above the block when the group is cohesive; otherwise comment each entry.

### 3. Unexported identifiers — comment only when not obvious

Skip the doc comment when a well-named unexported func is self-evident
(`getenv`, `newID`). Add a one-line comment when the name doesn't fully
convey purpose, when there's a non-obvious constraint, or when the function
is the implementation half of an exported pair.

```go
// sign builds and serializes a Claims-bearing HS256 JWT.
func (s *TokenService) sign(...) (string, error) { ... }
```

### 4. Inline comments — only for the WHY

Inline comments explain *why*, not *what*. Reserve them for:

- Hidden constraints (`// SQLite performs better with a single writer connection.`)
- Non-obvious security choices (`// Reject any token not signed with HMAC — guards against alg=none.`)
- Workarounds for specific bugs or quirks
- Surprising invariants

Do not narrate the code, restate the function name, or reference the
current task/PR/ticket. If removing the comment wouldn't confuse a future
reader, don't write it.

### 5. Style mechanics

- Doc comments are `// line` style, immediately above the declaration, no blank line between.
- Wrap at ~80 cols. Use complete sentences with a period.
- Refer to other identifiers bare (`See Routes.`), not in backticks.
- Code samples in doc comments are indented one tab (godoc renders them as `<pre>`).
- Mark deprecations with a `Deprecated:` paragraph at the end of the doc comment.

```go
// OldThing does X.
//
// Deprecated: use NewThing instead.
func OldThing() {}
```

### 6. What NOT to comment

- `// Package foo` followed by nothing useful — drop it or write something real.
- Restating the signature (`// Foo takes a string and returns an int.`).
- Change-log style comments (`// Added in v2`, `// Fixed bug #123`) — that's git's job.
- TODOs without an owner and a concrete trigger condition.

## Checklist before committing Go code

- [ ] Each package has exactly one package comment, on one file, beginning `Package x ` (or `Command x ` for main).
- [ ] Every exported identifier has a doc comment that starts with its name.
- [ ] Unexported helpers either have a self-evident name or a one-line comment.
- [ ] Inline comments explain *why*, not *what*; none restate the code.
- [ ] No stale comments referring to removed code, prior implementations, or the task that produced the change.
- [ ] `golangci-lint run` passes.
