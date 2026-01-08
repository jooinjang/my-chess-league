package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"my-chess-league/backend/config"
)

type GoogleChatService struct {
	httpClient *http.Client
}

func NewGoogleChatService() *GoogleChatService {
	return &GoogleChatService{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *GoogleChatService) Send(text string) error {
	cfg := config.GetConfig()
	webhookURL := strings.TrimSpace(cfg.GoogleChatWebhookURL)
	if webhookURL == "" {
		return errors.New("GOOGLE_CHAT_WEBHOOK_URL is not set")
	}

	text = strings.TrimSpace(text)
	if text == "" {
		return errors.New("text is required")
	}

	payload, _ := json.Marshal(map[string]string{"text": text})
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errors.New("webhook returned non-2xx")
	}

	return nil
}
