package config

import "os"

type Config struct {
	Port   string
	DBPath string
}

func GetConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "chess_league.db"
	}

	return &Config{
		Port:   port,
		DBPath: dbPath,
	}
}
