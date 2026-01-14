package models

// DTO types returned to the frontend for analysis pages.

type MoveAnnotation = *string

type MoveJudgement string

const (
	JBrilliant  MoveJudgement = "brilliant"
	JGreat      MoveJudgement = "great"
	JBest       MoveJudgement = "best"
	JExcellent  MoveJudgement = "excellent"
	JGood       MoveJudgement = "good"
	JInaccuracy MoveJudgement = "inaccuracy"
	JMistake    MoveJudgement = "mistake"
	JBlunder    MoveJudgement = "blunder"
	JBook       MoveJudgement = "book"
)

type MoveAnalysisDTO struct {
	MoveNumber int    `json:"moveNumber"`
	Color      string `json:"color"` // "w" | "b"
	San        string `json:"san"`
	Fen        string `json:"fen"`

	EvalBefore     int  `json:"evalBefore"`
	EvalAfter      int  `json:"evalAfter"`
	EvalAfterWhite int  `json:"evalAfterWhite"`
	MateBeforeWhite *int `json:"mateBeforeWhite,omitempty"`
	MateAfterWhite  *int `json:"mateAfterWhite,omitempty"`

	Judgement MoveJudgement `json:"judgement"`
	BestMove  string        `json:"bestMove"`
	BestMoveEval int        `json:"bestMoveEval"`
	EvalLoss  int           `json:"evalLoss"`
	Annotation MoveAnnotation `json:"annotation"`
	AnnotationReason string `json:"annotationReason"`
	PV        []string      `json:"pv"`

	WinChanceBefore *float64 `json:"winChanceBefore,omitempty"`
	WinChanceAfter  *float64 `json:"winChanceAfter,omitempty"`
	WinChanceLoss   *float64 `json:"winChanceLoss,omitempty"`
	CPL             *int     `json:"cpl,omitempty"`

	OpeningName *string `json:"openingName,omitempty"`
	OnlyMove    *bool   `json:"onlyMove,omitempty"`
	SecondBestMove *string `json:"secondBestMove,omitempty"`
	SecondBestEval *int `json:"secondBestEval,omitempty"`
}

type GameAnalysisDTO struct {
	MatchID       uint            `json:"matchId"`
	Moves         []MoveAnalysisDTO `json:"moves"`
	WhiteAccuracy float64         `json:"whiteAccuracy"`
	BlackAccuracy float64         `json:"blackAccuracy"`
	AnalysisDepth int             `json:"analysisDepth"`
	AnalysisDate  string          `json:"analysisDate"`
}


