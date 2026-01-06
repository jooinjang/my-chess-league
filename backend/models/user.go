package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	Name             string         `gorm:"uniqueIndex;not null" json:"name"`
	Rating           float64        `gorm:"default:1500.0" json:"rating"`
	RatingDeviation  float64        `gorm:"default:350.0" json:"rating_deviation"`
	Memo             string         `json:"memo"`
	ChesscomUsername *string        `gorm:"uniqueIndex" json:"chesscom_username"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type CreateUserRequest struct {
	Name             string   `json:"name" binding:"required"`
	Rating           *float64 `json:"rating"`
	Memo             string   `json:"memo"`
	ChesscomUsername *string  `json:"chesscom_username"`
}

type UpdateUserRequest struct {
	Name             *string `json:"name"`
	Memo             *string `json:"memo"`
	ChesscomUsername *string `json:"chesscom_username"`
}
