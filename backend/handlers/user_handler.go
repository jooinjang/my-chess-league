package handlers

import (
	"net/http"
	"strconv"

	"my-chess-league/backend/models"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

var userService = services.NewUserService()
var matchService = services.NewMatchService()

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorInfo  `json:"error,omitempty"`
}

type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func GetUsers(c *gin.Context) {
	users, err := userService.GetAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: users})
}

func GetUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid user ID"},
		})
		return
	}

	user, err := userService.GetUserByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_FOUND", Message: "User not found"},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: user})
}

func CreateUser(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	user, err := userService.CreateUser(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "CREATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusCreated, Response{Success: true, Data: user})
}

func UpdateUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid user ID"},
		})
		return
	}

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "VALIDATION_ERROR", Message: err.Error()},
		})
		return
	}

	user, err := userService.UpdateUser(uint(id), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "UPDATE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: user})
}

func DeleteUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid user ID"},
		})
		return
	}

	if err := userService.DeleteUser(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DELETE_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"message": "User deleted successfully"}})
}

func GetUserMatches(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_ID", Message: "Invalid user ID"},
		})
		return
	}

	matches, err := matchService.GetMatchesByUserID(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: matches})
}

func GetRankings(c *gin.Context) {
	users, err := userService.GetRankings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, Response{Success: true, Data: users})
}
