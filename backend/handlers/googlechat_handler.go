package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"

	"my-chess-league/backend/config"

	"github.com/gin-gonic/gin"
)

type googleChatSendRequest struct {
	Text string `json:"text"`
}

// GoogleChatSend sends a message to a Google Chat space using an Incoming Webhook URL.
// Route: POST /api/v1/googlechat/send
//
// Requires env:
// - GOOGLE_CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=..."
func GoogleChatSend(c *gin.Context) {
	cfg := config.GetConfig()
	if strings.TrimSpace(cfg.GoogleChatWebhookURL) == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "GOOGLE_CHAT_WEBHOOK_URL is not set"})
		return
	}

	var req googleChatSendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "text is required"})
		return
	}

	payload, _ := json.Marshal(gin.H{"text": req.Text})
	httpReq, err := http.NewRequest(http.MethodPost, cfg.GoogleChatWebhookURL, bytes.NewReader(payload))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json; charset=UTF-8")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to send webhook"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Webhook returned non-2xx", "status": resp.StatusCode})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}


