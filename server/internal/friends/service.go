package friends

import (
	"encoding/json"
	"fmt"

	"chen/pkg/supabase"
)

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

func toString(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}
