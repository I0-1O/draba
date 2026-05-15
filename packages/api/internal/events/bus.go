// Package events provides the in-process pub/sub bus. Every write operation
// publishes a typed Message; consumers such as the WebSocket hub and future
// calendar-sync workers subscribe and react without the publisher knowing
// about them.
package events

import "sync"

// Type is a dot-separated string identifying the category and action of a
// domain event (e.g. "event.created").
type Type string

const (
	// EventCreated is published after a new event is persisted.
	EventCreated Type = "event.created"
	// EventUpdated is published after an existing event is modified.
	EventUpdated Type = "event.updated"
	// EventDeleted is published after an event is removed.
	EventDeleted Type = "event.deleted"

	// TimelineCreated is published after a new timeline is persisted.
	TimelineCreated Type = "timeline.created"
)

// Message is a single domain event published on the Bus.
type Message struct {
	Type    Type   // identifies the action
	TeamID  string // routes the message to team-scoped subscribers
	Payload any    // the full model (e.g. *models.Event) or a deletion stub
}

// Bus is a lightweight in-process pub/sub broker. Subscribers receive all
// messages published after they subscribe. The bus never blocks the caller
// of Publish — messages are dropped when a subscriber's buffer is full.
type Bus struct {
	mu   sync.RWMutex
	subs []chan Message
}

// NewBus returns a ready-to-use Bus.
func NewBus() *Bus {
	return &Bus{}
}

// Subscribe returns a buffered channel that receives every Message published
// after this call. Call Unsubscribe when the subscription is no longer needed
// to release the channel.
func (b *Bus) Subscribe() chan Message {
	ch := make(chan Message, 64)
	b.mu.Lock()
	b.subs = append(b.subs, ch)
	b.mu.Unlock()
	return ch
}

// Unsubscribe removes a subscription created by Subscribe and closes the
// channel. Calling Unsubscribe with a channel not returned by Subscribe is
// a no-op.
func (b *Bus) Unsubscribe(ch chan Message) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i, s := range b.subs {
		if s == ch {
			b.subs = append(b.subs[:i], b.subs[i+1:]...)
			close(ch)
			return
		}
	}
}

// Publish delivers msg to every current subscriber. The send is non-blocking;
// messages are silently dropped for any subscriber whose buffer is full so
// that a slow consumer never stalls the caller.
func (b *Bus) Publish(msg Message) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subs {
		select {
		case ch <- msg:
		default:
			// Slow subscriber — drop rather than block the publisher.
		}
	}
}
