package friends

import (
	"encoding/json"
	"fmt"
	"strings"
    "chen/pkg/supabase"
)

const (
	RelationshipStatusNone            = "none"
	RelationshipStatusSelf            = "self"
	RelationshipStatusFriends         = "friends"
	RelationshipStatusOutgoingPending = "outgoing_pending"
	RelationshipStatusIncomingPending = "incoming_pending"
)

type Relationship struct {
	FriendshipID string `json:"friendshipId,omitempty"`
	Status       string `json:"status"`
}

func GetAcceptedFriendIDs(userID string) ([]string, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("friendships").
		Select("requester_id,addressee_id", "", false).
		Or(
			fmt.Sprintf(
				"and(requester_id.eq.%s,status.eq.accepted),and(addressee_id.eq.%s,status.eq.accepted)",
				userID,
				userID,
			),
			"",
		).
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	friendIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		requesterID := toString(row["requester_id"])
		addresseeID := toString(row["addressee_id"])

		switch {
		case requesterID == userID && addresseeID != "":
			friendIDs = append(friendIDs, addresseeID)
		case addresseeID == userID && requesterID != "":
			friendIDs = append(friendIDs, requesterID)
		}
	}

	return friendIDs, nil
}

func GetRelationship(userID string, targetUserID string) (Relationship, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(targetUserID) == "" {
		return Relationship{Status: RelationshipStatusNone}, nil
	}

	if userID == targetUserID {
		return Relationship{Status: RelationshipStatusSelf}, nil
	}

	client := supabase.GetClient()
	if client == nil {
		return Relationship{}, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("friendships").
		Select("id,requester_id,addressee_id,status", "", false).
		Or(
			fmt.Sprintf(
				"and(requester_id.eq.%s,addressee_id.eq.%s),and(requester_id.eq.%s,addressee_id.eq.%s)",
				userID,
				targetUserID,
				targetUserID,
				userID,
			),
			"",
		).
		Limit(1, "").
		Execute()
	if err != nil {
		return Relationship{}, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return Relationship{}, err
	}

	if len(rows) == 0 {
		return Relationship{Status: RelationshipStatusNone}, nil
	}

	status := strings.ToLower(strings.TrimSpace(toString(rows[0]["status"])))
	requesterID := toString(rows[0]["requester_id"])
	addresseeID := toString(rows[0]["addressee_id"])
	relationship := Relationship{
		FriendshipID: toString(rows[0]["id"]),
		Status:       RelationshipStatusNone,
	}

	switch status {
	case "accepted":
		relationship.Status = RelationshipStatusFriends
	case "pending":
		if requesterID == userID && addresseeID == targetUserID {
			relationship.Status = RelationshipStatusOutgoingPending
		} else if requesterID == targetUserID && addresseeID == userID {
			relationship.Status = RelationshipStatusIncomingPending
		}
	}

	return relationship, nil
}

func toString(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}
