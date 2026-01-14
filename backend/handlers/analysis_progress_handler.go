package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

// GET /api/v1/matches/:id/analysis/stream
// Streams analysis progress as SSE while analysis is running.
func StreamMatchAnalysisProgress(c *gin.Context) {
	matchID64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid match ID"},
		})
		return
	}
	matchID := uint(matchID64)

	// find latest analysis row (to disambiguate multiple runs)
	var a models.MatchAnalysis
	if err := database.DB.Where("match_id = ?", matchID).Order("created_at DESC").First(&a).Error; err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_FOUND", Message: "Analysis not found"},
		})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	// CORS is handled by middleware; SSE still needs flush.

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "streaming unsupported"})
		return
	}

	send := func(v any) {
		b, _ := json.Marshal(v)
		_, _ = c.Writer.Write([]byte("data: " + string(b) + "\n\n"))
		flusher.Flush()
	}

	// initial ping
	send(gin.H{"matchId": matchID, "analysisId": a.ID, "status": a.Status})

	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			p := services.GetAnalysisProgress(matchID)
			status := string(a.Status)
			if p != nil && p.AnalysisID == a.ID {
				status = p.Status
				etaMs := int64(0)
				if p.AvgMs > 0 && p.Total > p.Current {
					etaMs = int64(p.Total-p.Current) * p.AvgMs
				}
				send(gin.H{
					"matchId":    matchID,
					"analysisId": a.ID,
					"status":     status,
					"current":    p.Current,
					"total":      p.Total,
					"percent":    func() int { if p.Total <= 0 { return 0 }; return int(float64(p.Current) * 100 / float64(p.Total)) }(),
					"avgMs":      p.AvgMs,
					"lastMs":     p.LastMs,
					"etaMs":      etaMs,
				})
				if status == "complete" || status == "error" {
					return
				}
				continue
			}

			// fallback: refresh status from DB occasionally (cheap)
			var latest models.MatchAnalysis
			if err := database.DB.Where("match_id = ?", matchID).Order("created_at DESC").First(&latest).Error; err == nil {
				a = latest
				status = string(a.Status)
				send(gin.H{"matchId": matchID, "analysisId": a.ID, "status": status})
				if status == string(models.MatchAnalysisComplete) || status == string(models.MatchAnalysisError) {
					return
				}
			} else {
				send(gin.H{"matchId": matchID, "analysisId": a.ID, "status": status, "note": fmt.Sprintf("db refresh error: %v", err)})
			}
		}
	}
}


