package services

import (
	"sync"
	"time"
)

type AnalysisProgress struct {
	MatchID   uint      `json:"matchId"`
	AnalysisID uint     `json:"analysisId"`
	Current   int       `json:"current"`
	Total     int       `json:"total"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"startedAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	AvgMs     int64     `json:"avgMs"`
	LastMs    int64     `json:"lastMs"`
}

var progressMu sync.RWMutex
var progressByMatch = map[uint]*AnalysisProgress{}

func SetAnalysisProgress(matchID uint, analysisID uint, current int, total int, status string, startedAt time.Time, lastMs int64) *AnalysisProgress {
	now := time.Now()
	progressMu.Lock()
	defer progressMu.Unlock()

	p := progressByMatch[matchID]
	if p == nil || p.AnalysisID != analysisID {
		p = &AnalysisProgress{
			MatchID:    matchID,
			AnalysisID: analysisID,
			StartedAt:  startedAt,
		}
		progressByMatch[matchID] = p
	}
	p.Current = current
	p.Total = total
	p.Status = status
	p.UpdatedAt = now
	p.LastMs = lastMs
	if current > 0 {
		p.AvgMs = now.Sub(startedAt).Milliseconds() / int64(current)
	}
	return p
}

func GetAnalysisProgress(matchID uint) *AnalysisProgress {
	progressMu.RLock()
	defer progressMu.RUnlock()
	if p := progressByMatch[matchID]; p != nil {
		// return a shallow copy to avoid races
		cp := *p
		return &cp
	}
	return nil
}


