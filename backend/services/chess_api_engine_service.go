package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// ChessAPIEngineService evaluates positions by calling https://chess-api.com/ (Stockfish 17) asynchronously.
// We prefer WebSocket (progressive move/info/bestmove messages), with a conservative HTTP POST fallback.
type ChessAPIEngineService struct {
	wsURL string
	httpURL string
	maxThinkingMs int
}

func NewChessAPIEngineService(wsURL string, httpURL string, maxThinkingMs int) *ChessAPIEngineService {
	wsURL = strings.TrimSpace(wsURL)
	if wsURL == "" {
		wsURL = "wss://chess-api.com/v1"
	}
	httpURL = strings.TrimSpace(httpURL)
	if httpURL == "" {
		httpURL = "https://chess-api.com/v1"
	}
	if maxThinkingMs <= 0 {
		maxThinkingMs = 50
	}
	if maxThinkingMs > 100 {
		maxThinkingMs = 100
	}
	return &ChessAPIEngineService{
		wsURL: wsURL,
		httpURL: httpURL,
		maxThinkingMs: maxThinkingMs,
	}
}

type chessAPIRequest struct {
	FEN            string `json:"fen,omitempty"`
	Input          string `json:"input,omitempty"`
	Variants       int    `json:"variants,omitempty"`
	Depth          int    `json:"depth,omitempty"`
	MaxThinkingTime int   `json:"maxThinkingTime,omitempty"`
	SearchMoves    string `json:"searchmoves,omitempty"`
	TaskID         string `json:"taskId,omitempty"`
}

type chessAPIMessage struct {
	Type            string   `json:"type"`
	TaskID          string   `json:"taskId"`
	Text            string   `json:"text"`
	Move            string   `json:"move"`
	Depth           int      `json:"depth"`
	Eval            *float64 `json:"eval"`
	Mate            *int     `json:"mate"`
	Centipawns      json.RawMessage `json:"centipawns"`
	WinChance       *float64 `json:"winChance"`
	ContinuationArr []string `json:"continuationArr"`
	// error/info messages may carry other fields; we ignore them
}

type lineCandidate struct {
	firstMove string
	pv        []string
	depth     int
	cp        *int
	mate      *int
	eval      *float64
}

func (s *ChessAPIEngineService) EvaluatePosition(ctx context.Context, fen string, depth int, multiPv int) (*EnginePositionEval, error) {
	if strings.TrimSpace(fen) == "" {
		return nil, errors.New("fen is required")
	}
	if depth <= 0 {
		depth = 16
	}
	// Chess-API limits: depth max 18, variants max 5.
	if depth > 18 {
		depth = 18
	}
	if multiPv <= 0 {
		multiPv = 3
	}
	if multiPv > 5 {
		multiPv = 5
	}

	// Retry logic: try up to 3 times with exponential backoff
	maxRetries := 3
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		taskID := newTaskID()
		req := chessAPIRequest{
			FEN:             fen,
			Variants:        multiPv,
			Depth:           depth,
			MaxThinkingTime: s.maxThinkingMs,
			TaskID:          taskID,
		}

		// Try websocket first.
		if eval, err := s.evalViaWS(ctx, req); err == nil {
			return eval, nil
		} else {
			lastErr = err
		}

		// HTTP fallback (single best line).
		if eval, err := s.evalViaHTTP(ctx, req); err == nil {
			return eval, nil
		} else {
			lastErr = err
		}
	}

	return nil, fmt.Errorf("all retries exhausted: %w", lastErr)
}

func (s *ChessAPIEngineService) dialWS(ctx context.Context) (*websocket.Conn, error) {
	d := websocket.Dialer{
		Proxy: http.ProxyFromEnvironment,
		HandshakeTimeout: 10 * time.Second,
	}
	c, _, err := d.DialContext(ctx, s.wsURL, nil)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *ChessAPIEngineService) evalViaWS(ctx context.Context, req chessAPIRequest) (*EnginePositionEval, error) {
	conn, err := s.dialWS(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	b, _ := json.Marshal(req)
	if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
		return nil, err
	}

	// Two-phase deadlines:
	// 1) First useful message should arrive quickly; otherwise fall back to HTTP.
	// 2) Once streaming starts, allow up to ctx deadline for bestmove.
	firstDeadline := time.Now().Add(2 * time.Second)
	finalDeadline := time.Now().Add(30 * time.Second)
	if dl, ok := ctx.Deadline(); ok {
		finalDeadline = dl
		if dl.Before(firstDeadline) {
			firstDeadline = dl
		}
	}
	_ = conn.SetReadDeadline(firstDeadline)

	cands := map[string]lineCandidate{}
	bestMove := ""
	// chess-api may override taskId; since we serialize calls, bind to the first taskId we observe.
	streamTaskID := ""
	gotUseful := false

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			return nil, err
		}

		var m chessAPIMessage
		if err := json.Unmarshal(msgBytes, &m); err != nil {
			continue
		}

		if !gotUseful {
			gotUseful = true
			_ = conn.SetReadDeadline(finalDeadline)
		}
		if streamTaskID == "" && strings.TrimSpace(m.TaskID) != "" {
			streamTaskID = strings.TrimSpace(m.TaskID)
		}
		if streamTaskID != "" && strings.TrimSpace(m.TaskID) != "" && strings.TrimSpace(m.TaskID) != streamTaskID {
			// unexpected interleaving; ignore
			continue
		}

		// Build PV.
		move := strings.ToLower(strings.TrimSpace(m.Move))
		pv := make([]string, 0, 8)
		for _, t := range m.ContinuationArr {
			tt := strings.ToLower(strings.TrimSpace(t))
			if tt != "" {
				pv = append(pv, tt)
			}
		}
		if move != "" {
			if len(pv) == 0 || pv[0] != move {
				pv = append([]string{move}, pv...)
			}
		} else if len(pv) > 0 {
			move = pv[0]
		}
		pv = normalizePVForCastling(req.FEN, pv)

		cp := parseCentipawns(m.Centipawns)
		var mate *int
		if m.Mate != nil {
			v := *m.Mate
			mate = &v
		}

		cand := lineCandidate{
			firstMove: move,
			pv:        pv,
			depth:     m.Depth,
			cp:        cp,
			mate:      mate,
			eval:      m.Eval,
		}
		if cand.firstMove != "" {
			prev, ok := cands[cand.firstMove]
			if !ok || cand.depth > prev.depth || (cand.depth == prev.depth && betterEval(cand, prev)) {
				cands[cand.firstMove] = cand
			}
		}

		if strings.EqualFold(m.Type, "bestmove") {
			if bestMove == "" && move != "" {
				bestMove = move
			}
			break
		}
	}

	lines := make([]EngineLine, 0, len(cands))
	for _, c := range cands {
		if c.firstMove == "" {
			continue
		}
		lines = append(lines, EngineLine{
			PV:      c.pv,
			Depth:   c.depth,
			CP:      c.cp,
			Mate:    c.mate,
			MultiPV: 0, // set after sorting
		})
	}

	sort.SliceStable(lines, func(i, j int) bool {
		// Prefer mate lines, then higher cp, then deeper.
		mi, mj := lines[i].Mate, lines[j].Mate
		if mi != nil || mj != nil {
			if mi == nil {
				return false
			}
			if mj == nil {
				return true
			}
			if *mi != *mj {
				return *mi > *mj
			}
		}
		ci, cj := lines[i].CP, lines[j].CP
		if ci != nil && cj != nil && *ci != *cj {
			return *ci > *cj
		}
		if ci != nil && cj == nil {
			return true
		}
		if ci == nil && cj != nil {
			return false
		}
		return lines[i].Depth > lines[j].Depth
	})

	for i := range lines {
		lines[i].MultiPV = i + 1
	}

	if bestMove == "" && len(lines) > 0 && len(lines[0].PV) > 0 {
		bestMove = lines[0].PV[0]
	}

	return &EnginePositionEval{
		BestMove: bestMove,
		Lines:    lines,
	}, nil
}

func (s *ChessAPIEngineService) evalViaHTTP(ctx context.Context, req chessAPIRequest) (*EnginePositionEval, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.httpURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("chess-api http status=%d body=%s", resp.StatusCode, string(raw))
	}

	var m chessAPIMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}

	move := strings.ToLower(strings.TrimSpace(m.Move))
	pv := make([]string, 0, 8)
	for _, t := range m.ContinuationArr {
		tt := strings.ToLower(strings.TrimSpace(t))
		if tt != "" {
			pv = append(pv, tt)
		}
	}
	if move != "" {
		if len(pv) == 0 || pv[0] != move {
			pv = append([]string{move}, pv...)
		}
	} else if len(pv) > 0 {
		move = pv[0]
	}
	pv = normalizePVForCastling(req.FEN, pv)

	cp := parseCentipawns(m.Centipawns)
	var mate *int
	if m.Mate != nil {
		v := *m.Mate
		mate = &v
	}

	line := EngineLine{
		PV:      pv,
		Depth:   m.Depth,
		MultiPV: 1,
		CP:      cp,
		Mate:    mate,
	}

	return &EnginePositionEval{
		BestMove: move,
		Lines:    []EngineLine{line},
	}, nil
}

func parseCentipawns(raw json.RawMessage) *int {
	if len(raw) == 0 {
		return nil
	}
	// centipawns can be either a JSON string (e.g. "-1162") or a JSON number.
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		s = strings.TrimSpace(s)
		if s == "" {
			return nil
		}
		if v, err := strconv.Atoi(s); err == nil {
			return &v
		}
		if fv, err := strconv.ParseFloat(s, 64); err == nil {
			v := int(fv)
			return &v
		}
		return nil
	}
	var n json.Number
	if err := json.Unmarshal(raw, &n); err == nil {
		if iv, err := n.Int64(); err == nil {
			v := int(iv)
			return &v
		}
		if fv, err := n.Float64(); err == nil {
			v := int(fv)
			return &v
		}
	}
	var iv int
	if err := json.Unmarshal(raw, &iv); err == nil {
		return &iv
	}
	return nil
}

func betterEval(a, b lineCandidate) bool {
	// Prefer mate if present; else higher eval/cp.
	if a.mate != nil || b.mate != nil {
		if a.mate == nil {
			return false
		}
		if b.mate == nil {
			return true
		}
		return *a.mate > *b.mate
	}
	if a.cp != nil && b.cp != nil {
		return *a.cp > *b.cp
	}
	if a.eval != nil && b.eval != nil {
		return *a.eval > *b.eval
	}
	if a.cp != nil && b.cp == nil {
		return true
	}
	return false
}

func newTaskID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err == nil {
		return hex.EncodeToString(b)
	}
	// fallback
	return fmt.Sprintf("%d", time.Now().UnixNano())
}


