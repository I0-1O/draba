package events

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBus_PublishDelivered(t *testing.T) {
	b := NewBus()
	ch := b.Subscribe()
	defer b.Unsubscribe(ch)

	msg := Message{Type: ActivityCreated, TeamID: "team1", Payload: "test"}
	b.Publish(msg)

	select {
	case got := <-ch:
		assert.Equal(t, msg, got)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected message not received within timeout")
	}
}

func TestBus_MultipleSubscribers(t *testing.T) {
	b := NewBus()
	ch1 := b.Subscribe()
	ch2 := b.Subscribe()
	defer b.Unsubscribe(ch1)
	defer b.Unsubscribe(ch2)

	b.Publish(Message{Type: ActivityUpdated, TeamID: "team1"})

	for _, ch := range []chan Message{ch1, ch2} {
		select {
		case got := <-ch:
			assert.Equal(t, ActivityUpdated, got.Type)
		case <-time.After(100 * time.Millisecond):
			t.Fatal("subscriber did not receive message")
		}
	}
}

func TestBus_Unsubscribe_StopsDelivery(t *testing.T) {
	b := NewBus()
	ch := b.Subscribe()
	b.Unsubscribe(ch)

	// Channel is closed after unsubscribe; a second subscriber still works.
	ch2 := b.Subscribe()
	defer b.Unsubscribe(ch2)

	b.Publish(Message{Type: ActivityDeleted, TeamID: "team1"})

	select {
	case got := <-ch2:
		assert.Equal(t, ActivityDeleted, got.Type)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("ch2 did not receive message after ch was unsubscribed")
	}
}

func TestBus_NoSubscribers_DoesNotPanic(t *testing.T) {
	b := NewBus()
	require.NotPanics(t, func() {
		b.Publish(Message{Type: ActivityCreated, TeamID: "team1"})
	})
}
