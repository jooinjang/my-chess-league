package handlers

import (
	"net/http"
	"strings"

	"my-chess-league/backend/config"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

type googleChatSendRequest struct {
	Text string `json:"text"`
}

var googleChatService = services.NewGoogleChatService()

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

	if err := googleChatService.Send(req.Text); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to send webhook", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
