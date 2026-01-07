package middleware

import (
	"my-chess-league/backend/config"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	cfg := config.GetConfig()

	c := cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// 환경변수로 제어:
	// - CORS_ALLOW_ALL=true  -> Origin 제한 없이 허용(개발/내부망용)
	// - CORS_ALLOW_ORIGINS="http://x:5173,http://y:5173" -> 허용 Origin 목록 추가
	if cfg.CORSAllowAll {
		c.AllowOriginFunc = func(origin string) bool { return true }
	} else if len(cfg.CORSAllowOrigins) > 0 {
		c.AllowOrigins = append(c.AllowOrigins, cfg.CORSAllowOrigins...)
	}

	return cors.New(c)
}
