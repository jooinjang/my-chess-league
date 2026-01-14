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

	// Engine / Stockfish
	StockfishPath   string
	AnalysisDepth   int
	AnalysisMultiPV int
	AnalysisTimeoutSeconds int

	// Analysis engine selection
	AnalysisEngine string // "chess_api" | "local"

	// Chess-API (remote Stockfish 17)
	ChessAPIURL           string
	ChessAPIWS            string
	ChessAPIMaxThinkingMs int

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

	stockfishPath := strings.TrimSpace(os.Getenv("STOCKFISH_PATH"))
	if stockfishPath == "" {
		stockfishPath = "stockfish"
	}

	analysisDepth := 16
	if v := strings.TrimSpace(os.Getenv("ANALYSIS_DEPTH")); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			analysisDepth = parsed
		}
	}

	analysisMultiPV := 3
	if v := strings.TrimSpace(os.Getenv("ANALYSIS_MULTIPV")); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed >= 2 && parsed <= 6 {
			analysisMultiPV = parsed
		}
	}

	// Default: use external chess-api.com (remote Stockfish 17).
	// Set ANALYSIS_ENGINE=local to use local Stockfish binary instead.
	analysisEngine := strings.TrimSpace(os.Getenv("ANALYSIS_ENGINE"))
	if analysisEngine == "" {
		analysisEngine = "chess_api" // Default: external API
	}
	switch analysisEngine {
	case "chess_api", "local":
		// ok
	default:
		analysisEngine = "chess_api" // Fallback to external API
	}

	analysisTimeoutSeconds := 20
	if analysisEngine == "chess_api" {
		// Remote engine can take longer per position; keep a safer default.
		analysisTimeoutSeconds = 60
	}
	if v := strings.TrimSpace(os.Getenv("ANALYSIS_TIMEOUT_SECONDS")); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			analysisTimeoutSeconds = parsed
		}
	}

	chessAPIURL := strings.TrimSpace(os.Getenv("CHESS_API_URL"))
	if chessAPIURL == "" {
		chessAPIURL = "https://chess-api.com/v1"
	}
	chessAPIWS := strings.TrimSpace(os.Getenv("CHESS_API_WS"))
	if chessAPIWS == "" {
		chessAPIWS = "wss://chess-api.com/v1"
	}
	chessAPIMaxThinkingMs := 50
	if v := strings.TrimSpace(os.Getenv("CHESS_API_MAX_THINKING_MS")); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			chessAPIMaxThinkingMs = parsed
		}
	}
	// Documented max is 100ms; clamp defensively.
	if chessAPIMaxThinkingMs > 100 {
		chessAPIMaxThinkingMs = 100
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
		StockfishPath:    stockfishPath,
		AnalysisDepth:    analysisDepth,
		AnalysisMultiPV:  analysisMultiPV,
		AnalysisTimeoutSeconds: analysisTimeoutSeconds,
		AnalysisEngine:   analysisEngine,
		ChessAPIURL:      chessAPIURL,
		ChessAPIWS:       chessAPIWS,
		ChessAPIMaxThinkingMs: chessAPIMaxThinkingMs,
		CORSAllowAll:     corsAllowAll,
		CORSAllowOrigins: origins,
		GoogleChatWebhookURL: googleChatWebhookURL,
	}
}
