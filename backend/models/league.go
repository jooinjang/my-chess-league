package models

import "time"

type LeagueFormat string
type LeagueStatus string
type PairingStatus string

const (
	LeagueFormatSwiss      LeagueFormat = "swiss"
	LeagueFormatRoundRobin LeagueFormat = "round_robin"

	LeagueStatusDraft     LeagueStatus = "draft"
	LeagueStatusRunning   LeagueStatus = "running"
	LeagueStatusCompleted LeagueStatus = "completed"

	PairingStatusPending PairingStatus = "pending"
	PairingStatusDone    PairingStatus = "done"
)

type League struct {
	ID         uint         `gorm:"primaryKey" json:"id"`
	Name       string       `gorm:"not null" json:"name"`
	Format     LeagueFormat `gorm:"not null" json:"format"`
	Status     LeagueStatus `gorm:"not null;default:'draft'" json:"status"`
	RoundCount int          `gorm:"not null;default:0" json:"round_count"` // Swiss only
	CreatedAt  time.Time    `json:"created_at"`

	Participants []LeagueParticipant `json:"participants,omitempty"`
}

type LeagueParticipant struct {
	ID       uint `gorm:"primaryKey" json:"id"`
	LeagueID uint `gorm:"not null;index" json:"league_id"`
	UserID   uint `gorm:"not null;index" json:"user_id"`
	Seed     *int `json:"seed,omitempty"`
	Dropped  bool `gorm:"not null;default:false" json:"dropped"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type LeaguePairing struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	LeagueID      uint          `gorm:"not null;index" json:"league_id"`
	RoundNo       int           `gorm:"not null;index" json:"round_no"`
	Player1UserID uint          `gorm:"not null" json:"player1_user_id"`
	Player2UserID *uint         `json:"player2_user_id,omitempty"` // nil when bye
	IsBye         bool          `gorm:"not null;default:false" json:"is_bye"`
	Status        PairingStatus `gorm:"not null;default:'pending'" json:"status"`
	LinkedMatchID *uint         `json:"linked_match_id,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`

	Player1     User   `gorm:"foreignKey:Player1UserID" json:"player1,omitempty"`
	Player2     *User  `gorm:"foreignKey:Player2UserID" json:"player2,omitempty"`
	LinkedMatch *Match `gorm:"foreignKey:LinkedMatchID" json:"linked_match,omitempty"`
}

type CreateLeagueRequest struct {
	Name               string       `json:"name" binding:"required"`
	Format             LeagueFormat `json:"format" binding:"required,oneof=swiss round_robin"`
	RoundCount         int          `json:"round_count"` // required for swiss
	ParticipantUserIDs []uint       `json:"participant_user_ids" binding:"required,min=2"`
}

type LeagueReportChesscomResultRequest struct {
	Year   int    `json:"year" binding:"required"`
	Month  int    `json:"month" binding:"required"`
	GameID string `json:"game_id" binding:"required"`
}

type UpdateLeagueRequest struct {
	Name *string `json:"name"`
}
