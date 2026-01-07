package database

import (
	"log"
	"my-chess-league/backend/config"
	"my-chess-league/backend/models"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func resolveDBPath(cfgPath string) string {
	// 1) 절대경로면 그대로 사용
	if filepath.IsAbs(cfgPath) {
		return cfgPath
	}

	// 2) 현재 작업 디렉토리 기준으로 존재하면 그걸 사용
	if wd, err := os.Getwd(); err == nil {
		p := filepath.Join(wd, cfgPath)
		if _, err := os.Stat(p); err == nil {
			return p
		}

		// 3) 리포 루트에서 실행한 경우(./backend/chess_league.db)도 흔함
		p2 := filepath.Join(wd, "backend", cfgPath)
		if _, err := os.Stat(p2); err == nil {
			return p2
		}
	}

	// 4) 존재 여부와 상관없이(새로 생성 포함) 기본은 CWD 기준
	if wd, err := os.Getwd(); err == nil {
		return filepath.Join(wd, cfgPath)
	}
	return cfgPath
}

func InitDB() {
	cfg := config.GetConfig()

	var err error
	dbPath := resolveDBPath(cfg.DBPath)
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto migrate schemas
	err = DB.AutoMigrate(&models.User{}, &models.Match{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Printf("Database initialized successfully (db=%s)\n", dbPath)
}
