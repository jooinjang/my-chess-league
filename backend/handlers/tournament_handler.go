package handlers

import (
	"net/http"
	"strconv"

	"my-chess-league/backend/models"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

var tournamentService = services.NewTournamentService()

func CreateTournament(c *gin.Context) {
	var req models.CreateTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	t, err := tournamentService.CreateTournament(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "CREATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, Response{Success: true, Data: t})
}

func GetTournaments(c *gin.Context) {
	ts, err := tournamentService.GetTournaments()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: ts})
}

func GetTournament(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid tournament ID"},
		})
		return
	}
	t, err := tournamentService.GetTournamentByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_FOUND", Message: "Tournament not found"},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: t})
}

func DeleteTournament(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid tournament ID"},
		})
		return
	}
	if err := tournamentService.DeleteTournament(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DELETE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"message": "Tournament deleted successfully"}})
}

func GetTournamentBracket(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid tournament ID"},
		})
		return
	}
	matches, err := tournamentService.GetBracket(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"matches": matches}})
}

func GenerateNextTournamentRound(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid tournament ID"},
		})
		return
	}
	matches, err := tournamentService.GenerateNextRound(uint(id))
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "GENERATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"matches": matches}})
}

func ReportTournamentMatchChesscom(c *gin.Context) {
	tournamentID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid tournament ID"},
		})
		return
	}
	matchID, err := strconv.ParseUint(c.Param("matchId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid match ID"},
		})
		return
	}
	var req models.TournamentReportChesscomResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	m, err := tournamentService.ReportMatchResultFromChesscom(uint(tournamentID), uint(matchID), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "REPORT_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: m})
}
