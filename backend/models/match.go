package models

import (
	"time"
)

type MatchResult string

const (
	WhiteWin MatchResult = "white_win"
	BlackWin MatchResult = "black_win"
	Draw     MatchResult = "draw"
)

type Match struct {
	ID                uint        `gorm:"primaryKey" json:"id"`
	WhitePlayerID     uint        `gorm:"not null" json:"white_player_id"`
	BlackPlayerID     uint        `gorm:"not null" json:"black_player_id"`
	Result            MatchResult `gorm:"not null" json:"result"`
	PlayedAt          time.Time   `gorm:"not null" json:"played_at"`
	Rated             bool        `gorm:"default:true" json:"rated"`
	WhiteRatingBefore float64     `json:"white_rating_before"`
	BlackRatingBefore float64     `json:"black_rating_before"`
	WhiteRatingAfter  float64     `json:"white_rating_after"`
	BlackRatingAfter  float64     `json:"black_rating_after"`
	ChesscomGameID    *string     `gorm:"uniqueIndex" json:"chesscom_game_id"`
	CreatedAt         time.Time   `json:"created_at"`

	// Relations
	WhitePlayer User `gorm:"foreignKey:WhitePlayerID" json:"white_player,omitempty"`
	BlackPlayer User `gorm:"foreignKey:BlackPlayerID" json:"black_player,omitempty"`
}

type CreateMatchRequest struct {
	WhitePlayerID  uint        `json:"white_player_id" binding:"required"`
	BlackPlayerID  uint        `json:"black_player_id" binding:"required"`
	Result         MatchResult `json:"result" binding:"required,oneof=white_win black_win draw"`
	PlayedAt       time.Time   `json:"played_at" binding:"required"`
	Rated          *bool       `json:"rated"`
	ChesscomGameID *string     `json:"chesscom_game_id"`
}

type BulkCreateMatchRequest struct {
	Matches []CreateMatchRequest `json:"matches" binding:"required,dive"`
}
