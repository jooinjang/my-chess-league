package models

import "time"

type TournamentStatus string
type TournamentBracket string

const (
	TournamentStatusDraft     TournamentStatus = "draft"
	TournamentStatusRunning   TournamentStatus = "running"
	TournamentStatusCompleted TournamentStatus = "completed"

	TournamentBracketWinners TournamentBracket = "W"
	TournamentBracketLosers  TournamentBracket = "L"
	TournamentBracketGF      TournamentBracket = "GF"
	TournamentBracketGFReset TournamentBracket = "GF_RESET"
)

type Tournament struct {
	ID        uint             `gorm:"primaryKey" json:"id"`
	Name      string           `gorm:"not null" json:"name"`
	Status    TournamentStatus `gorm:"not null;default:'draft'" json:"status"`
	CreatedAt time.Time        `json:"created_at"`

	Participants []TournamentParticipant `json:"participants,omitempty"`
}

type TournamentParticipant struct {
	ID           uint `gorm:"primaryKey" json:"id"`
	TournamentID uint `gorm:"not null;index" json:"tournament_id"`
	UserID       uint `gorm:"not null;index" json:"user_id"`
	Seed         int  `gorm:"not null" json:"seed"`
	Wins         int  `gorm:"not null;default:0" json:"wins"`
	Losses       int  `gorm:"not null;default:0" json:"losses"`
	Eliminated   bool `gorm:"not null;default:false" json:"eliminated"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type TournamentMatch struct {
	ID           uint              `gorm:"primaryKey" json:"id"`
	TournamentID uint              `gorm:"not null;index" json:"tournament_id"`
	Bracket      TournamentBracket `gorm:"not null" json:"bracket"`
	RoundNo      int               `gorm:"not null;index" json:"round_no"`
	MatchNo      int               `gorm:"not null" json:"match_no"`

	Player1UserID *uint `json:"player1_user_id,omitempty"`
	Player2UserID *uint `json:"player2_user_id,omitempty"`
	WinnerUserID  *uint `json:"winner_user_id,omitempty"`
	LoserUserID   *uint `json:"loser_user_id,omitempty"`

	Status             PairingStatus `gorm:"not null;default:'pending'" json:"status"`
	ArmageddonRequired bool          `gorm:"not null;default:false" json:"armageddon_required"`
	InitialMatchID     *uint         `json:"initial_match_id,omitempty"`  // main game (may be draw)
	TiebreakMatchID    *uint         `json:"tiebreak_match_id,omitempty"` // armageddon, if used
	LinkedMatchID      *uint         `json:"linked_match_id,omitempty"`   // decisive match (initial if decisive else tiebreak)
	CreatedAt          time.Time     `json:"created_at"`

	Player1       *User  `gorm:"foreignKey:Player1UserID" json:"player1,omitempty"`
	Player2       *User  `gorm:"foreignKey:Player2UserID" json:"player2,omitempty"`
	InitialMatch  *Match `gorm:"foreignKey:InitialMatchID" json:"initial_match,omitempty"`
	TiebreakMatch *Match `gorm:"foreignKey:TiebreakMatchID" json:"tiebreak_match,omitempty"`
	LinkedMatch   *Match `gorm:"foreignKey:LinkedMatchID" json:"linked_match,omitempty"`
}

type CreateTournamentRequest struct {
	Name               string `json:"name" binding:"required"`
	ParticipantUserIDs []uint `json:"participant_user_ids" binding:"required,min=2"`
}

type TournamentReportChesscomResultRequest struct {
	Year   int    `json:"year" binding:"required"`
	Month  int    `json:"month" binding:"required"`
	GameID string `json:"game_id" binding:"required"`
}
