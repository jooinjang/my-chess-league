package main

import (
	"log"
	"my-chess-league/backend/database"
	"my-chess-league/backend/routes"
)

func main() {
	// Initialize database
	database.InitDB()

	// Setup router
	router := routes.SetupRouter()

	// Start server
	log.Println("Server starting on :8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
