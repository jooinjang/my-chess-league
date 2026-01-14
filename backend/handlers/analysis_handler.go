package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"my-chess-league/backend/config"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

var analysisService = services.NewAnalysisService(config.GetConfig())

// POST /api/v1/matches/:id/analyze
func AnalyzeMatch(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid match ID"},
		})
		return
	}

	var depthPtr *int
	if v := strings.TrimSpace(c.Query("depth")); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			depthPtr = &parsed
		}
	}
	var mpvPtr *int
	if v := strings.TrimSpace(c.Query("multipv")); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			mpvPtr = &parsed
		}
	}

	// Run asynchronously to avoid nginx 60s timeout cancelling the request context.
	a, err := analysisService.StartAnalyzeMatch(uint(id), depthPtr, mpvPtr)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "ANALYZE_ERROR", Message: err.Error()},
		})
		return
	}

	// 202 Accepted: analysis started, progress via SSE, results via GET /analysis
	c.JSON(http.StatusAccepted, Response{Success: true, Data: a})
}

// GET /api/v1/matches/:id/analysis
func GetMatchAnalysis(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid match ID"},
		})
		return
	}

	a, err := analysisService.GetLatestAnalysis(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_FOUND", Message: "Analysis not found"},
		})
		return
	}

	dto, err := services.BuildGameAnalysisDTO(a)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "MAPPING_ERROR", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: dto})
}


