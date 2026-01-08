package handlers

import (
	"net/http"
	"strconv"

	"my-chess-league/backend/models"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

var leagueService = services.NewLeagueService()

func CreateLeague(c *gin.Context) {
	var req models.CreateLeagueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	league, err := leagueService.CreateLeague(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "CREATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, Response{Success: true, Data: league})
}

func GetLeagues(c *gin.Context) {
	leagues, err := leagueService.GetLeagues()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: leagues})
}

func GetLeague(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	league, err := leagueService.GetLeagueByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_FOUND", Message: "League not found"},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: league})
}

func UpdateLeague(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	var req models.UpdateLeagueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}
	if req.Name == nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: "name is required"},
		})
		return
	}
	league, err := leagueService.UpdateLeagueName(uint(id), *req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "UPDATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: league})
}

func DeleteLeague(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	if err := leagueService.DeleteLeague(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DELETE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"message": "League deleted successfully"}})
}

func GenerateNextLeagueRound(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	pairings, err := leagueService.GenerateNextRound(uint(id))
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "GENERATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"pairings": pairings}})
}

func GetLeagueRound(c *gin.Context) {
	leagueID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	roundNo, err := strconv.Atoi(c.Param("roundNo"))
	if err != nil || roundNo <= 0 {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ROUND", Message: "Invalid round number"},
		})
		return
	}

	pairings, err := leagueService.GetRoundPairings(uint(leagueID), roundNo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"pairings": pairings}})
}

func GetLeaguePairings(c *gin.Context) {
	leagueID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	pairings, err := leagueService.GetAllPairings(uint(leagueID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"pairings": pairings}})
}

func GetLeagueStandings(c *gin.Context) {
	leagueID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	standings, err := leagueService.GetStandings(uint(leagueID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"standings": standings}})
}

func ReportLeaguePairingChesscom(c *gin.Context) {
	leagueID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid league ID"},
		})
		return
	}
	pairingID, err := strconv.ParseUint(c.Param("pairingId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid pairing ID"},
		})
		return
	}
	var req models.LeagueReportChesscomResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	pairing, err := leagueService.ReportPairingResultFromChesscom(uint(leagueID), uint(pairingID), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "REPORT_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: pairing})
}
