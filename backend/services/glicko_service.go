package services

import (
	"math"
)

const (
	InitialRating = 1500.0
	InitialRD     = 350.0
	MinRD         = 30.0
	MaxRD         = 350.0
	Q             = 0.0057565 // ln(10) / 400
)

type GlickoService struct{}

func NewGlickoService() *GlickoService {
	return &GlickoService{}
}

type OpponentResult struct {
	Rating float64
	RD     float64
	Score  float64 // 1.0 = win, 0.5 = draw, 0.0 = loss
}

// g(RD) function: weight based on RD
func (s *GlickoService) g(rd float64) float64 {
	return 1.0 / math.Sqrt(1.0+3.0*Q*Q*rd*rd/(math.Pi*math.Pi))
}

// E(r, rj, RDj) function: expected score
func (s *GlickoService) expectedScore(rating, opponentRating, opponentRD float64) float64 {
	return 1.0 / (1.0 + math.Pow(10, -s.g(opponentRD)*(rating-opponentRating)/400.0))
}

// d^2 calculation: variance used in rating update
func (s *GlickoService) dSquared(rating float64, opponents []OpponentResult) float64 {
	sum := 0.0
	for _, opp := range opponents {
		gRD := s.g(opp.RD)
		e := s.expectedScore(rating, opp.Rating, opp.RD)
		sum += gRD * gRD * e * (1 - e)
	}
	return 1.0 / (Q * Q * sum)
}

// CalculateNewRating calculates new rating and RD
func (s *GlickoService) CalculateNewRating(
	currentRating, currentRD float64,
	opponents []OpponentResult,
) (newRating, newRD float64) {
	if len(opponents) == 0 {
		return currentRating, math.Min(math.Sqrt(currentRD*currentRD+34.6*34.6), MaxRD)
	}

	dSq := s.dSquared(currentRating, opponents)

	// Calculate new RD
	newRD = 1.0 / math.Sqrt(1.0/(currentRD*currentRD)+1.0/dSq)
	newRD = math.Max(MinRD, math.Min(newRD, MaxRD))

	// Calculate new rating
	sum := 0.0
	for _, opp := range opponents {
		e := s.expectedScore(currentRating, opp.Rating, opp.RD)
		sum += s.g(opp.RD) * (opp.Score - e)
	}

	newRating = currentRating + Q/(1.0/(currentRD*currentRD)+1.0/dSq)*sum

	return newRating, newRD
}

// ProcessMatch processes a single match and returns updated ratings for both players
func (s *GlickoService) ProcessMatch(
	whiteRating, whiteRD, blackRating, blackRD float64,
	result string,
) (newWhiteRating, newWhiteRD, newBlackRating, newBlackRD float64) {
	var whiteScore, blackScore float64

	switch result {
	case "white_win":
		whiteScore, blackScore = 1.0, 0.0
	case "black_win":
		whiteScore, blackScore = 0.0, 1.0
	case "draw":
		whiteScore, blackScore = 0.5, 0.5
	}

	// Update white player rating
	whiteOpponents := []OpponentResult{{Rating: blackRating, RD: blackRD, Score: whiteScore}}
	newWhiteRating, newWhiteRD = s.CalculateNewRating(whiteRating, whiteRD, whiteOpponents)

	// Update black player rating
	blackOpponents := []OpponentResult{{Rating: whiteRating, RD: whiteRD, Score: blackScore}}
	newBlackRating, newBlackRD = s.CalculateNewRating(blackRating, blackRD, blackOpponents)

	return
}
