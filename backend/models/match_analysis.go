package models

import "time"

type MatchAnalysisStatus string

const (
	MatchAnalysisRunning  MatchAnalysisStatus = "running"
	MatchAnalysisComplete MatchAnalysisStatus = "complete"
	MatchAnalysisError    MatchAnalysisStatus = "error"
)

// MatchAnalysis stores one analysis run for a given match (PGN).
// We intentionally keep it generic so we can evolve the payload without breaking older rows.
type MatchAnalysis struct {
	ID        uint               `gorm:"primaryKey" json:"id"`
	MatchID   uint               `gorm:"not null;index" json:"match_id"`
	Status    MatchAnalysisStatus `gorm:"not null;index" json:"status"`

	Engine  string `gorm:"not null" json:"engine"`
	Depth   int    `gorm:"not null" json:"depth"`
	MultiPV int    `gorm:"not null" json:"multipv"`

	WhiteAccuracy float64 `gorm:"not null;default:0" json:"white_accuracy"`
	BlackAccuracy float64 `gorm:"not null;default:0" json:"black_accuracy"`

	ErrorMessage *string   `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	Positions []MatchAnalysisPosition `json:"positions,omitempty"`
}

// MatchAnalysisPosition stores per-position eval and the move classification for the move that led to it.
// ply=0 represents the initial position.
type MatchAnalysisPosition struct {
	ID             uint `gorm:"primaryKey" json:"id"`
	MatchAnalysisID uint `gorm:"not null;index" json:"match_analysis_id"`

	// Ply index (0=start, 1=after white's first move, ...)
	Ply int `gorm:"not null;index" json:"ply"`

	FEN string `gorm:"type:text;not null" json:"fen"`

	// Optional, set for ply>=1
	UciMove *string `gorm:"type:varchar(8)" json:"uci_move,omitempty"`
	SanMove *string `gorm:"type:varchar(32)" json:"san_move,omitempty"`

	BestMove string `gorm:"type:varchar(8)" json:"best_move,omitempty"`
	// JSON encoded lines (MultiPV) in a stable format
	LinesJSON string `gorm:"type:text" json:"lines_json"`

	Opening           *string `gorm:"type:text" json:"opening,omitempty"`
	MoveClassification *string `gorm:"type:varchar(16)" json:"move_classification,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}


