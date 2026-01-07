package main

import (
	"log"
	"my-chess-league/backend/config"
	"my-chess-league/backend/database"
	"my-chess-league/backend/routes"
)

func main() {
	cfg := config.GetConfig()

	// Initialize database
	database.InitDB()

	// Setup router
	router := routes.SetupRouter()

	// Start server
	addr := ":" + cfg.Port
	if cfg.Host != "" {
		addr = cfg.Host + addr
	}

	log.Printf("Server starting on %s\n", addr)
	if err := router.Run(addr); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
