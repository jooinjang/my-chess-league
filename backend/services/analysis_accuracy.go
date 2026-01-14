package services

import "math"

// Ports accuracy logic from the reference project (math + engine/accuracy helpers).

type Accuracy struct {
	White float64 `json:"white"`
	Black float64 `json:"black"`
}

func ComputeAccuracy(positions []PositionEval) Accuracy {
	if len(positions) == 0 {
		return Accuracy{White: 0, Black: 0}
	}
	posWin := make([]float64, len(positions))
	for i := range positions {
		posWin[i] = getPositionWinPercentage(positions[i])
	}
	weights := getAccuracyWeights(posWin)
	movesAcc := getMovesAccuracy(posWin)
	return Accuracy{
		White: getPlayerAccuracy(movesAcc, weights, true),
		Black: getPlayerAccuracy(movesAcc, weights, false),
	}
}

func getPlayerAccuracy(movesAccuracy []float64, weights []float64, white bool) float64 {
	remainder := 0
	if !white {
		remainder = 1
	}
	playerAcc := make([]float64, 0, (len(movesAccuracy)+1)/2)
	playerWeights := make([]float64, 0, (len(weights)+1)/2)
	for i := range movesAccuracy {
		if i%2 == remainder {
			playerAcc = append(playerAcc, movesAccuracy[i])
		}
	}
	for i := range weights {
		if i%2 == remainder {
			playerWeights = append(playerWeights, weights[i])
		}
	}

	weightedMean := getWeightedMean(playerAcc, playerWeights)
	// harmonic uses max(a,10)
	harmInput := make([]float64, len(playerAcc))
	for i, a := range playerAcc {
		if a < 10 {
			harmInput[i] = 10
		} else {
			harmInput[i] = a
		}
	}
	harmonicMean := getHarmonicMean(harmInput)
	return (weightedMean + harmonicMean) / 2
}

func getAccuracyWeights(movesWin []float64) []float64 {
	// windowSize = ceilsNumber(ceil(len/10), 2, 8)
	windowSize := int(ceilsNumberFloat(math.Ceil(float64(len(movesWin))/10), 2, 8))
	windows := make([][]float64, 0, maxInt(0, len(movesWin)-1))
	half := int(math.Round(float64(windowSize) / 2))

	for i := 1; i < len(movesWin); i++ {
		start := i - half
		end := i + half

		if start < 0 {
			windows = append(windows, movesWin[0:windowSize])
			continue
		}
		if end > len(movesWin) {
			windows = append(windows, movesWin[len(movesWin)-windowSize:])
			continue
		}
		windows = append(windows, movesWin[start:end])
	}

	weights := make([]float64, 0, len(windows))
	for _, w := range windows {
		std := getStandardDeviation(w)
		weights = append(weights, ceilsNumberFloat(std, 0.5, 12))
	}
	return weights
}

func getMovesAccuracy(movesWin []float64) []float64 {
	if len(movesWin) <= 1 {
		return nil
	}
	out := make([]float64, 0, len(movesWin)-1)
	for idx := 0; idx < len(movesWin)-1; idx++ {
		winPercent := movesWin[idx+1]
		lastWin := movesWin[idx]
		isWhiteMove := idx%2 == 0

		var winDiff float64
		if isWhiteMove {
			winDiff = math.Max(0, lastWin-winPercent)
		} else {
			winDiff = math.Max(0, winPercent-lastWin)
		}

		rawAcc := 103.1668100711649*math.Exp(-0.04354415386753951*winDiff) - 3.166924740191411
		acc := math.Min(100, math.Max(0, rawAcc+1))
		out = append(out, acc)
	}
	return out
}

// ---- Math helpers ----

func ceilsNumberFloat(number float64, min float64, max float64) float64 {
	if number > max {
		return max
	}
	if number < min {
		return min
	}
	return number
}

func getHarmonicMean(array []float64) float64 {
	if len(array) == 0 {
		return 0
	}
	sum := 0.0
	for _, curr := range array {
		sum += 1 / curr
	}
	return float64(len(array)) / sum
}

func getStandardDeviation(array []float64) float64 {
	if len(array) == 0 {
		return 0
	}
	n := float64(len(array))
	mean := 0.0
	for _, v := range array {
		mean += v
	}
	mean /= n

	variance := 0.0
	for _, x := range array {
		d := x - mean
		variance += d * d
	}
	variance /= n
	return math.Sqrt(variance)
}

func getWeightedMean(array []float64, weights []float64) float64 {
	if len(array) == 0 {
		return 0
	}
	if len(array) > len(weights) {
		return 0
	}
	weightedSum := 0.0
	for i, curr := range array {
		weightedSum += curr * weights[i]
	}
	weightSum := 0.0
	for i := 0; i < len(array); i++ {
		weightSum += weights[i]
	}
	if weightSum == 0 {
		return 0
	}
	return weightedSum / weightSum
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}


