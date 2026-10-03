package supabase

import (
	"fmt"
	"os"
	"github.com/supabase-community/supabase-go"
)

var Client *supabase.Client

func InitClient() error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		return fmt.Errorf("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
	}

	client, err := supabase.NewClient(supabaseURL, supabaseKey, &supabase.ClientOptions{})
	if err != nil {
		return err
	}

	Client = client
	return nil
}

func GetClient() *supabase.Client {
	return Client
}
