package api_test

// Test infrastructure for Phase 12: an in-process SMTP server that captures
// outbound mail so comms flows can be asserted without a real mail server.
// It speaks just enough of the SMTP conversation for Go's net/smtp client and
// advertises no extensions, so the client uses the plain (no-STARTTLS, no-auth)
// path — keeping the fake server small.

import (
	"bufio"
	"net"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

// capturedMessage is one email received by the test SMTP server.
type capturedMessage struct {
	From string
	To   []string
	Body string // raw DATA payload (headers + body), dot-unstuffed
}

// captureSMTPServer is a minimal SMTP server that records every message it
// receives. Use newTestSMTPServer to construct one; it is closed via t.Cleanup.
type captureSMTPServer struct {
	listener net.Listener
	mu       sync.Mutex
	received []capturedMessage
}

// newTestSMTPServer starts a capture SMTP server on a random loopback port and
// registers cleanup. host() and port() feed an mailer.SMTPConfig.
func newTestSMTPServer(t *testing.T) *captureSMTPServer {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	s := &captureSMTPServer{listener: ln}
	go s.serve()
	t.Cleanup(func() { _ = ln.Close() })
	return s
}

func (s *captureSMTPServer) host() string {
	h, _, _ := net.SplitHostPort(s.listener.Addr().String())
	return h
}

func (s *captureSMTPServer) port() int {
	_, p, _ := net.SplitHostPort(s.listener.Addr().String())
	n, _ := strconv.Atoi(p)
	return n
}

// messages returns a copy of all captured messages.
func (s *captureSMTPServer) messages() []capturedMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]capturedMessage, len(s.received))
	copy(out, s.received)
	return out
}

// reset discards captured messages so a later assertion starts clean.
func (s *captureSMTPServer) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.received = nil
}

func (s *captureSMTPServer) serve() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			return // listener closed by cleanup
		}
		go s.handleConn(conn)
	}
}

func (s *captureSMTPServer) handleConn(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	w := bufio.NewWriter(conn)
	write := func(line string) {
		_, _ = w.WriteString(line + "\r\n")
		_ = w.Flush()
	}

	write("220 mock.test ESMTP ready")

	var msg capturedMessage
	var dataLines []string
	inData := false

	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		line = strings.TrimRight(line, "\r\n")

		if inData {
			if line == "." {
				msg.Body = strings.Join(dataLines, "\n")
				s.mu.Lock()
				s.received = append(s.received, msg)
				s.mu.Unlock()
				msg, dataLines, inData = capturedMessage{}, nil, false
				write("250 OK queued")
				continue
			}
			// Reverse the client's dot-stuffing of leading-dot lines.
			if strings.HasPrefix(line, "..") {
				line = line[1:]
			}
			dataLines = append(dataLines, line)
			continue
		}

		cmd := strings.ToUpper(line)
		switch {
		case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
			// Single-line reply advertises no extensions, so the client skips
			// STARTTLS and AUTH.
			write("250 mock.test")
		case strings.HasPrefix(cmd, "MAIL FROM:"):
			msg.From = extractAddr(line[len("MAIL FROM:"):])
			write("250 OK")
		case strings.HasPrefix(cmd, "RCPT TO:"):
			msg.To = append(msg.To, extractAddr(line[len("RCPT TO:"):]))
			write("250 OK")
		case cmd == "DATA":
			write("354 End data with <CR><LF>.<CR><LF>")
			inData = true
		case cmd == "RSET":
			msg, dataLines = capturedMessage{}, nil
			write("250 OK")
		case cmd == "QUIT":
			write("221 Bye")
			return
		default:
			write("250 OK")
		}
	}
}

// extractAddr pulls the bare address out of an SMTP "<addr>" path argument.
func extractAddr(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "<")
	if i := strings.IndexByte(s, '>'); i >= 0 {
		s = s[:i]
	}
	return s
}
