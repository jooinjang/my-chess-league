package routes

import (
	"my-chess-league/backend/handlers"
	"my-chess-league/backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	router := gin.Default()

	// CORS middleware
	router.Use(middleware.CORSMiddleware())

	// API v1 group
	v1 := router.Group("/api/v1")
	{
		// Users
		users := v1.Group("/users")
		{
			users.GET("", handlers.GetUsers)
			users.GET("/:id", handlers.GetUser)
			users.POST("", handlers.CreateUser)
			users.PUT("/:id", handlers.UpdateUser)
			users.DELETE("/:id", handlers.DeleteUser)
			users.GET("/:id/matches", handlers.GetUserMatches)
		}

		// Matches
		matches := v1.Group("/matches")
		{
			matches.GET("", handlers.GetMatches)
			matches.GET("/:id", handlers.GetMatch)
			matches.POST("", handlers.CreateMatch)
			matches.POST("/bulk", handlers.CreateMatchesBulk)
			matches.DELETE("", handlers.DeleteAllMatches)
			matches.DELETE("/:id", handlers.DeleteMatch)
		}

		// Chess.com integration
		chesscom := v1.Group("/chesscom")
		{
			chesscom.GET("/validate/:username", handlers.ValidateChesscomUsername)
			chesscom.GET("/games", handlers.GetChesscomGames)
		}

		// Rankings
		v1.GET("/rankings", handlers.GetRankings)
	}

	return router
}
