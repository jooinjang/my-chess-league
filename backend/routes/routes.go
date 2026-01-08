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
		// Google Chat integration (outgoing webhook)
		googlechat := v1.Group("/googlechat")
		{
			googlechat.POST("/send", handlers.GoogleChatSend)
		}

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

		// Leagues
		leagues := v1.Group("/leagues")
		{
			leagues.GET("", handlers.GetLeagues)
			leagues.GET("/:id", handlers.GetLeague)
			leagues.POST("", handlers.CreateLeague)
			leagues.PUT("/:id", handlers.UpdateLeague)
			leagues.DELETE("/:id", handlers.DeleteLeague)
			leagues.GET("/:id/pairings", handlers.GetLeaguePairings)
			leagues.POST("/:id/rounds/next", handlers.GenerateNextLeagueRound)
			leagues.GET("/:id/rounds/:roundNo", handlers.GetLeagueRound)
			leagues.GET("/:id/standings", handlers.GetLeagueStandings)
			leagues.POST("/:id/pairings/:pairingId/result/chesscom", handlers.ReportLeaguePairingChesscom)
		}

		// Tournaments
		tournaments := v1.Group("/tournaments")
		{
			tournaments.GET("", handlers.GetTournaments)
			tournaments.GET("/:id", handlers.GetTournament)
			tournaments.POST("", handlers.CreateTournament)
			tournaments.DELETE("/:id", handlers.DeleteTournament)
			tournaments.GET("/:id/bracket", handlers.GetTournamentBracket)
			tournaments.POST("/:id/rounds/next", handlers.GenerateNextTournamentRound)
			tournaments.POST("/:id/matches/:matchId/result/chesscom", handlers.ReportTournamentMatchChesscom)
		}

		// Chess.com integration
		chesscom := v1.Group("/chesscom")
		{
			chesscom.GET("/validate/:username", handlers.ValidateChesscomUsername)
			chesscom.GET("/games", handlers.GetChesscomGames)
			chesscom.POST("/sync", handlers.SyncChesscomMonth)
		}

		// Rankings
		v1.GET("/rankings", handlers.GetRankings)
	}

	return router
}
