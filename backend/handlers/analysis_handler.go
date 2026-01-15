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

// POST /api/v1/analyze/position
// Body: { "fen": "...", "depth": 16 }
func AnalyzePosition(c *gin.Context) {
	var req struct {
		FEN   string `json:"fen"`
		Depth int    `json:"depth"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_REQUEST", Message: "Invalid request body"},
		})
		return
	}

	fen := strings.TrimSpace(req.FEN)
	if fen == "" {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "MISSING_FEN", Message: "FEN is required"},
		})
		return
	}

	depth := req.Depth
	if depth <= 0 {
		depth = 16
	}
	if depth > 24 {
		depth = 24
	}

	eval, err := analysisService.EvaluatePosition(fen, depth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "ANALYSIS_ERROR", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: eval})
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


