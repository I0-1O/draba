package backup

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/mailer"
)

// recordingSender captures every send on a channel so tests can wait for
// deliveries without sleeping.
type recordingSender struct {
	sent chan string // recipient addresses
}

func (r *recordingSender) Send(to, _, _ string) error {
	r.sent <- to
	return nil
}

// fixedAdmins is a SuperadminEmailLister returning a static list.
type fixedAdmins struct {
	emails []string
	err    error
}

func (f fixedAdmins) ListSuperadminEmails() ([]string, error) { return f.emails, f.err }

func waitForSend(t *testing.T, ch chan string) string {
	t.Helper()
	select {
	case to := <-ch:
		return to
	case <-time.After(5 * time.Second):
		t.Fatal("expected a notification email")
		return ""
	}
}

func assertNoSend(t *testing.T, ch chan string) {
	t.Helper()
	select {
	case to := <-ch:
		t.Fatalf("unexpected notification email to %s", to)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestNotifier_EmailsEachSuperadminOnFailure(t *testing.T) {
	bus := events.NewBus()
	sender := &recordingSender{sent: make(chan string, 8)}
	// NewNotifier subscribes synchronously, so an immediate publish lands in
	// the subscription buffer even before Run starts draining it.
	go NewNotifier(bus, sender, fixedAdmins{emails: []string{"a@example.com", "b@example.com"}}).Run()

	bus.Publish(events.Message{Type: events.BackupFailed, Payload: &Failure{
		Trigger: TriggerScheduled, Error: "disk full", At: time.Now().UTC(),
	}})

	got := []string{waitForSend(t, sender.sent), waitForSend(t, sender.sent)}
	assert.ElementsMatch(t, []string{"a@example.com", "b@example.com"}, got,
		"one email per superadmin")
	assertNoSend(t, sender.sent)
}

func TestNotifier_IgnoresOtherEventsAndListerErrors(t *testing.T) {
	bus := events.NewBus()
	sender := &recordingSender{sent: make(chan string, 8)}
	admins := fixedAdmins{err: errors.New("db down")}
	go NewNotifier(bus, sender, admins).Run()

	// A completed event is not a notification trigger.
	bus.Publish(events.Message{Type: events.BackupCompleted, Payload: &Entry{}})
	// A failed event whose recipient lookup fails is skipped, not fatal.
	bus.Publish(events.Message{Type: events.BackupFailed, Payload: &Failure{Error: "x"}})
	assertNoSend(t, sender.sent)
}

// countingMailer wraps the real *mailer.Mailer so the test can observe that
// Send was reached and returned without error despite no SMTP config.
type countingMailer struct {
	inner *mailer.Mailer
	calls chan error
}

func (c *countingMailer) Send(to, subject, htmlBody string) error {
	err := c.inner.Send(to, subject, htmlBody)
	c.calls <- err
	return err
}

func TestNotifier_NoSMTPIsASilentNoOp(t *testing.T) {
	bus := events.NewBus()
	// A real mailer with an empty settings store: SMTP unconfigured.
	m := &countingMailer{inner: mailer.New(&memStore{}, nil), calls: make(chan error, 1)}
	go NewNotifier(bus, m, fixedAdmins{emails: []string{"admin@example.com"}}).Run()

	bus.Publish(events.Message{Type: events.BackupFailed, Payload: &Failure{Error: "boom"}})

	select {
	case err := <-m.calls:
		require.NoError(t, err, "unconfigured SMTP must be a silent no-op, not an error")
	case <-time.After(5 * time.Second):
		t.Fatal("notifier never attempted the send")
	}
}
