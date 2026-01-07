package handlers

import (
	"net/http"
	"strconv"

	"my-chess-league/backend/models"

	"github.com/gin-gonic/gin"
)

func GetMatches(c *gin.Context) {
	matches, err := matchService.GetAllMatches()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: matches})
}

func GetMatch(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid match ID"},
		})
		return
	}

	match, err := matchService.GetMatchByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_FOUND", Message: "Match not found"},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: match})
}

func CreateMatch(c *gin.Context) {
	var req models.CreateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	match, err := matchService.CreateMatch(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "CREATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, Response{Success: true, Data: match})
}

func DeleteMatch(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid match ID"},
		})
		return
	}

	if err := matchService.DeleteMatch(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DELETE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"message": "Match deleted successfully"}})
}

func CreateMatchesBulk(c *gin.Context) {
	var req models.BulkCreateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	matches, err := matchService.CreateMatchBulk(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "CREATE_ERROR", Message: err.Error()},
			Data:    gin.H{"created_count": len(matches)},
		})
		return
	}
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data: gin.H{
			"matches":       matches,
			"created_count": len(matches),
		},
	})
}

func DeleteAllMatches(c *gin.Context) {
	count, err := matchService.DeleteAllMatches()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DELETE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    gin.H{"message": "All matches deleted successfully (ratings reset to initial values)", "deleted_count": count},
	})
}
