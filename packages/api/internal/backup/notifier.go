package backup

import (
	"fmt"
	"html"
	"log/slog"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/events"
)

// Failure is the payload of a backup.failed bus event.
type Failure struct {
	Trigger Trigger   `json:"trigger"`
	Error   string    `json:"error"`
	At      time.Time `json:"at"`
}

// MailSender is the subset of *mailer.Mailer the notifier uses. Send is
// already a silent no-op when SMTP is unconfigured, so the notifier needs
// no configuration awareness of its own.
type MailSender interface {
	Send(to, subject, htmlBody string) error
}

// SuperadminEmailLister supplies the failure-notification recipients.
// The concrete implementation is *db.UserRepo.
type SuperadminEmailLister interface {
	ListSuperadminEmails() ([]string, error)
}

// Notifier consumes backup.failed events and emails every superadmin.
// It is an event consumer, not scheduler code — the same shape as every
// other side effect in the app.
type Notifier struct {
	ch     chan events.Message
	mail   MailSender
	admins SuperadminEmailLister
}

// NewNotifier subscribes to bus immediately (so no event published after
// construction is missed) and returns a Notifier ready to Run.
func NewNotifier(bus *events.Bus, mail MailSender, admins SuperadminEmailLister) *Notifier {
	return &Notifier{ch: bus.Subscribe(), mail: mail, admins: admins}
}

// Run processes events until the bus subscription channel is closed; call
// it in its own goroutine.
func (n *Notifier) Run() {
	for msg := range n.ch {
		if msg.Type != events.BackupFailed {
			continue
		}
		failure, ok := msg.Payload.(*Failure)
		if !ok {
			continue
		}
		emails, err := n.admins.ListSuperadminEmails()
		if err != nil {
			slog.Warn("backup: failure notification skipped; could not list superadmins", "err", err)
			continue
		}
		subject := "draba backup failed"
		body := failureEmailBody(failure)
		for _, to := range emails {
			if err := n.mail.Send(to, subject, body); err != nil {
				slog.Warn("backup: failure notification email not sent", "to", to, "err", err)
			}
		}
	}
}

// failureEmailBody renders the notification email. The error string is
// HTML-escaped: it can contain arbitrary filesystem paths and driver text.
func failureEmailBody(f *Failure) string {
	return fmt.Sprintf(`<html><body>
<p>A <strong>%s</strong> backup of your draba instance failed at %s.</p>
<p><code>%s</code></p>
<p>Check the server logs and the Settings &rsaquo; Backup page. Common causes
are an unwritable backup directory or a full disk.</p>
</body></html>`,
		f.Trigger, f.At.UTC().Format(time.RFC3339), html.EscapeString(f.Error))
}
