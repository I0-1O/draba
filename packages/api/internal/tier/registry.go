package tier

import "net/http"

// ModuleContext is the surface exposed to pro modules at registration time.
// Pro modules mount their routes on Mux and may inspect Tier for capability gating.
type ModuleContext struct {
	Mux  *http.ServeMux
	Tier Tier
}

// Module is implemented by each pro module package. Modules self-register
// via their init() function using Register, following the side-effect import pattern:
//
//	import _ "github.com/you/draba-pro/sso"
type Module interface {
	Name() string
	Register(*ModuleContext) error
}

var registered []Module

// Register adds a module to the registry. Call from init() in the pro module package.
func Register(m Module) {
	registered = append(registered, m)
}

// Registered returns all modules added via Register.
func Registered() []Module {
	return registered
}
