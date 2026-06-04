package api_test

// Phase 12 — Communications Testing: integration tests for the outbound email
// flows, exercised end-to-end against the in-process capture SMTP server
// (see smtp_capture_test.go). These assert that mail is actually transmitted
// with the right recipient and content, which the no-op mailer used by other
// tests cannot verify.

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// smtpConfigBody builds the JSON body the /admin/smtp endpoints expect,
// pointing at the given capture server with the plain (no-TLS) transport.
func smtpConfigBody(srv *captureSMTPServer) map[string]any {
	return map[string]any{
		"host":       srv.host(),
		"port":       srv.port(),
		"fromName":   "draba",
		"fromEmail":  "no-reply@draba.test",
		"encryption": "none",
	}
}

// unusedTCPPort returns a port with nothing listening on it, for simulating an
// unreachable SMTP server.
func unusedTCPPort(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	_, p, _ := net.SplitHostPort(ln.Addr().String())
	require.NoError(t, ln.Close())
	n, _ := strconv.Atoi(p)
	return n
}

// TestSMTPTest_SendsToCallerWithoutPersisting covers POST /admin/smtp/test:
// a test email is sent to the caller and no config is saved.
func TestSMTPTest_SendsToCallerWithoutPersisting(t *testing.T) {
	smtp := newTestSMTPServer(t)
	srv := newTestServer(t)
	token, _ := seedUser(t, srv, "admin@phase12.test", "password1", "Admin")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/admin/smtp/test", smtpConfigBody(smtp), token))
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body)

	msgs := smtp.messages()
	require.Len(t, msgs, 1, "exactly one test email should be sent")
	assert.Equal(t, []string{"admin@phase12.test"}, msgs[0].To, "test email goes to the caller")
	assert.Contains(t, msgs[0].Body, "draba SMTP test", "subject line present in message")

	// No config persisted.
	gw := httptest.NewRecorder()
	srv.ServeHTTP(gw, authReq(http.MethodGet, "/admin/smtp", nil, token))
	require.Equal(t, http.StatusOK, gw.Code)
	var got map[string]any
	require.NoError(t, json.NewDecoder(gw.Body).Decode(&got))
	assert.Nil(t, got["smtp"], "smtp/test must not persist config")
}

// TestSMTPValidate_SendsTestEmailAndPersists covers PUT /admin/smtp:
// a validation email is sent before the config is persisted.
func TestSMTPValidate_SendsTestEmailAndPersists(t *testing.T) {
	smtp := newTestSMTPServer(t)
	srv := newTestServer(t)
	token, _ := seedUser(t, srv, "admin@phase12.test", "password1", "Admin")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/admin/smtp", smtpConfigBody(smtp), token))
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body)

	msgs := smtp.messages()
	require.Len(t, msgs, 1, "validation email should be sent")
	assert.Equal(t, []string{"admin@phase12.test"}, msgs[0].To)

	// Config is now persisted (and the password, if any, is masked on read).
	gw := httptest.NewRecorder()
	srv.ServeHTTP(gw, authReq(http.MethodGet, "/admin/smtp", nil, token))
	require.Equal(t, http.StatusOK, gw.Code)
	var got struct {
		SMTP *struct {
			Host string `json:"host"`
		} `json:"smtp"`
	}
	require.NoError(t, json.NewDecoder(gw.Body).Decode(&got))
	require.NotNil(t, got.SMTP, "config should be persisted after a successful PUT")
	assert.Equal(t, smtp.host(), got.SMTP.Host)
}

// TestSMTPValidate_SendFails_ConfigNotPersisted covers the validation gate:
// when the test send fails, PUT /admin/smtp returns 400 and persists nothing.
func TestSMTPValidate_SendFails_ConfigNotPersisted(t *testing.T) {
	srv := newTestServer(t)
	token, _ := seedUser(t, srv, "admin@phase12.test", "password1", "Admin")

	body := map[string]any{
		"host":       "127.0.0.1",
		"port":       unusedTCPPort(t), // nothing listening → connection refused
		"fromName":   "draba",
		"fromEmail":  "no-reply@draba.test",
		"encryption": "none",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/admin/smtp", body, token))
	require.Equal(t, http.StatusBadRequest, w.Code, "unreachable SMTP must fail validation")

	gw := httptest.NewRecorder()
	srv.ServeHTTP(gw, authReq(http.MethodGet, "/admin/smtp", nil, token))
	require.Equal(t, http.StatusOK, gw.Code)
	var got map[string]any
	require.NoError(t, json.NewDecoder(gw.Body).Decode(&got))
	assert.Nil(t, got["smtp"], "failed validation must not persist config")
}

// TestCreateInvite_DeliversInviteEmailWithLink confirms creating an invite with
// an email address sends the invitee a message containing the registration link.
func TestCreateInvite_DeliversInviteEmailWithLink(t *testing.T) {
	smtp := newTestSMTPServer(t)
	srv := newTestServer(t)
	token, _ := seedUser(t, srv, "admin@phase12.test", "password1", "Admin")

	// Configure SMTP, then discard the validation email.
	pw := httptest.NewRecorder()
	srv.ServeHTTP(pw, authReq(http.MethodPut, "/admin/smtp", smtpConfigBody(smtp), token))
	require.Equal(t, http.StatusOK, pw.Code, "body: %s", pw.Body)
	smtp.reset()

	// Create a team to invite into.
	tw := httptest.NewRecorder()
	srv.ServeHTTP(tw, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	require.Equal(t, http.StatusCreated, tw.Code, "body: %s", tw.Body)
	var team struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.NewDecoder(tw.Body).Decode(&team))

	// Invite a new member by email.
	iw := httptest.NewRecorder()
	srv.ServeHTTP(iw, authReq(http.MethodPost, "/teams/"+team.ID+"/invites",
		map[string]string{"email": "invitee@phase12.test", "role": "member"}, token))
	require.Equal(t, http.StatusCreated, iw.Code, "body: %s", iw.Body)
	var invite struct {
		Token string `json:"token"`
	}
	require.NoError(t, json.NewDecoder(iw.Body).Decode(&invite))
	require.NotEmpty(t, invite.Token)

	msgs := smtp.messages()
	require.Len(t, msgs, 1, "an invite email should be delivered")
	assert.Equal(t, []string{"invitee@phase12.test"}, msgs[0].To)
	assert.Contains(t, msgs[0].Body, "invited to", "invite subject present")
	assert.Contains(t, msgs[0].Body, "register?token="+invite.Token, "invite link with token present")
}

// TestCreateInvite_NoEmail_NoSend confirms a tokenless (link-only) invite does
// not attempt to send mail.
func TestCreateInvite_NoEmail_NoSend(t *testing.T) {
	smtp := newTestSMTPServer(t)
	srv := newTestServer(t)
	token, _ := seedUser(t, srv, "admin@phase12.test", "password1", "Admin")

	pw := httptest.NewRecorder()
	srv.ServeHTTP(pw, authReq(http.MethodPut, "/admin/smtp", smtpConfigBody(smtp), token))
	require.Equal(t, http.StatusOK, pw.Code)
	smtp.reset()

	tw := httptest.NewRecorder()
	srv.ServeHTTP(tw, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	require.Equal(t, http.StatusCreated, tw.Code)
	var team struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.NewDecoder(tw.Body).Decode(&team))

	iw := httptest.NewRecorder()
	srv.ServeHTTP(iw, authReq(http.MethodPost, "/teams/"+team.ID+"/invites",
		map[string]string{"role": "member"}, token))
	require.Equal(t, http.StatusCreated, iw.Code, "body: %s", iw.Body)

	assert.Empty(t, smtp.messages(), "an invite with no email address must not send mail")
}

// TestForgotPassword_DeliversResetEmailWithLink confirms the reset flow sends
// a real email containing the reset link once SMTP is configured.
func TestForgotPassword_DeliversResetEmailWithLink(t *testing.T) {
	smtp := newTestSMTPServer(t)
	srv := newTestServer(t)
	token, _ := seedUser(t, srv, "admin@phase12.test", "password1", "Admin")

	// Persist SMTP config pointing at the capture server.
	pw := httptest.NewRecorder()
	srv.ServeHTTP(pw, authReq(http.MethodPut, "/admin/smtp", smtpConfigBody(smtp), token))
	require.Equal(t, http.StatusOK, pw.Code, "body: %s", pw.Body)
	smtp.reset() // discard the validation email

	// Trigger a password reset for the known user.
	fw := postJSON(t, srv, "/auth/forgot-password", map[string]string{"email": "admin@phase12.test"})
	require.Equal(t, http.StatusOK, fw.Code)

	msgs := smtp.messages()
	require.Len(t, msgs, 1, "a reset email should be delivered")
	assert.Equal(t, []string{"admin@phase12.test"}, msgs[0].To)
	assert.Contains(t, msgs[0].Body, "Reset your draba password", "subject present")
	assert.Contains(t, msgs[0].Body, "reset-password?token=", "reset link present in email body")
}
