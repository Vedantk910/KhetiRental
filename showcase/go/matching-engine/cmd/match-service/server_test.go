package main

import (
	"net/http"
	"testing"
)

// REVIEW S-06: a server without timeouts can be held open by slow clients.
func TestHTTPServerHasTimeouts(t *testing.T) {
	s := newHTTPServer(":0", http.NewServeMux())
	if s.ReadHeaderTimeout <= 0 || s.ReadTimeout <= 0 || s.WriteTimeout <= 0 || s.IdleTimeout <= 0 {
		t.Fatalf("missing timeouts: %+v", s)
	}
}
