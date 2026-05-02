package chen

import "testing"

func TestNormalizeStoredMessagesFromRowPrefersAvailableLegacyColumn(t *testing.T) {
	row := map[string]interface{}{
		"conversation": []interface{}{
			map[string]interface{}{"role": "user", "content": "hey"},
			map[string]interface{}{"role": "assistant", "content": "hi there"},
		},
	}

	messages := normalizeStoredMessagesFromRow(row)
	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}
	if messages[0].Role != "user" || messages[0].Content != "hey" {
		t.Fatalf("unexpected first message: %#v", messages[0])
	}
	if messages[1].Role != "assistant" || messages[1].Content != "hi there" {
		t.Fatalf("unexpected second message: %#v", messages[1])
	}
}

func TestNormalizeStoredMessagesFromRowFallsBackAcrossCandidates(t *testing.T) {
	row := map[string]interface{}{
		"messages": "[]",
		"history": []interface{}{
			map[string]interface{}{"role": "assistant", "content": "welcome back"},
		},
	}

	messages := normalizeStoredMessagesFromRow(row)
	if len(messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(messages))
	}
	if messages[0].Content != "welcome back" {
		t.Fatalf("expected history message to load, got %#v", messages[0])
	}
}

func TestIsMissingConversationColumnError(t *testing.T) {
	errText := "(42703) column chen_conversations.messages does not exist"
	if !isMissingConversationColumnError(assertErr(errText), "messages") {
		t.Fatalf("expected messages column error to be detected")
	}
	if isMissingConversationColumnError(assertErr(errText), "history") {
		t.Fatalf("did not expect history column to match messages error")
	}
}

type stringError string

func (e stringError) Error() string {
	return string(e)
}

func assertErr(message string) error {
	return stringError(message)
}
