package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port   string
	Host   string
	DBPath string

	// CORS
	CORSAllowAll     bool
	CORSAllowOrigins []string

	// Google Chat
	GoogleChatWebhookURL string
}

func GetConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	host := os.Getenv("HOST")
	if host == "" {
		// 외부에서 접속 가능한 형태로 띄우고 싶다면 HOST=0.0.0.0 설정
		host = ""
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "chess_league.db"
	}

	corsAllowAll := false
	if v := os.Getenv("CORS_ALLOW_ALL"); v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			corsAllowAll = parsed
		}
	}

	origins := []string{}
	if v := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS")); v != "" {
		parts := strings.Split(v, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				origins = append(origins, p)
			}
		}
	}

	googleChatWebhookURL := strings.TrimSpace(os.Getenv("GOOGLE_CHAT_WEBHOOK_URL"))

	return &Config{
		Port:             port,
		Host:             host,
		DBPath:           dbPath,
		CORSAllowAll:     corsAllowAll,
		CORSAllowOrigins: origins,
		GoogleChatWebhookURL: googleChatWebhookURL,
	}
}
