package services

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// Reference-project-inspired implementation:
// - info 라인에서 multipv별로 가장 높은 depth 결과만 유지
// - score cp/mate 는 "side-to-move 관점"이므로, black-to-move면 부호 반전하여 White 관점으로 저장
// - PV는 일부 엔진이 캐슬링을 e1h1/e1a1/e8h8/e8a8로 내보낼 수 있어 castling rights 기반으로 정규화

type EngineLine struct {
	PV      []string `json:"pv"`
	Depth   int      `json:"depth"`
	MultiPV int      `json:"multiPv"`
	CP      *int     `json:"cp,omitempty"`   // White perspective
	Mate    *int     `json:"mate,omitempty"` // White perspective (positive = White mates)
}

type EnginePositionEval struct {
	BestMove string       `json:"bestMove,omitempty"`
	Lines    []EngineLine `json:"lines"`
}

type EngineService struct {
	stockfishPath string
}

func NewEngineService(stockfishPath string) *EngineService {
	if strings.TrimSpace(stockfishPath) == "" {
		stockfishPath = "stockfish"
	}
	return &EngineService{stockfishPath: stockfishPath}
}

func (s *EngineService) EvaluatePosition(ctx context.Context, fen string, depth int, multiPv int) (*EnginePositionEval, error) {
	if strings.TrimSpace(fen) == "" {
		return nil, errors.New("fen is required")
	}
	if depth <= 0 {
		depth = 16
	}
	if multiPv < 2 || multiPv > 6 {
		// MultiPV range enforced to 2..6.
		multiPv = 3
	}

	// Stockfish binary path:
	// - In many Debian images, apt installs it under /usr/games/stockfish (not always in $PATH).
	// - Prefer explicit STOCKFISH_PATH, but fall back safely when "stockfish" isn't discoverable.
	bin := strings.TrimSpace(s.stockfishPath)
	if bin == "" {
		bin = "stockfish"
	}
	if !strings.Contains(bin, "/") {
		if lp, err := exec.LookPath(bin); err == nil && strings.TrimSpace(lp) != "" {
			bin = lp
		} else if bin == "stockfish" {
			// Debian default location
			if lp, err := exec.LookPath("/usr/games/stockfish"); err == nil && strings.TrimSpace(lp) != "" {
				bin = lp
			} else {
				// keep original; Start() will return a clear error
			}
		}
	}

	// 1) 프로세스 기동
	cmd := exec.CommandContext(ctx, bin)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}
	defer func() {
		_ = stdin.Close()
		_ = stdout.Close()
		_ = stderr.Close()
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
	}()

	// stderr는 버퍼가 꽉 차면 데드락이 날 수 있어 드레인합니다.
	go io.Copy(io.Discard, stderr) //nolint:errcheck

	w := bufio.NewWriter(stdin)
	send := func(line string) error {
		if _, err := w.WriteString(line + "\n"); err != nil {
			return err
		}
		return w.Flush()
	}

	// 2) UCI init
	if err := send("uci"); err != nil {
		return nil, err
	}
	if err := waitForToken(ctx, stdout, "uciok"); err != nil {
		return nil, err
	}
	if err := send(fmt.Sprintf("setoption name MultiPV value %d", multiPv)); err != nil {
		return nil, err
	}
	if err := send("isready"); err != nil {
		return nil, err
	}
	if err := waitForToken(ctx, stdout, "readyok"); err != nil {
		return nil, err
	}
	if err := send("ucinewgame"); err != nil {
		return nil, err
	}
	if err := send("isready"); err != nil {
		return nil, err
	}
	if err := waitForToken(ctx, stdout, "readyok"); err != nil {
		return nil, err
	}

	// 3) position + go, 그리고 bestmove까지 파싱
	if err := send("position fen " + fen); err != nil {
		return nil, err
	}
	if err := send(fmt.Sprintf("go depth %d", depth)); err != nil {
		return nil, err
	}

	eval, err := parseUntilBestMove(ctx, stdout, fen)
	if err != nil {
		return nil, err
	}

	// 종료
	_ = send("quit")
	return eval, nil
}

func waitForToken(ctx context.Context, r io.Reader, token string) error {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for sc.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		line := sc.Text()
		if strings.TrimSpace(line) == token {
			return nil
		}
	}
	if err := sc.Err(); err != nil {
		return err
	}
	return fmt.Errorf("token not found: %s", token)
}

func parseUntilBestMove(ctx context.Context, r io.Reader, fen string) (*EnginePositionEval, error) {
	// multipv -> best depth line
	linesByMPV := map[int]EngineLine{}
	var bestMove string

	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for sc.Scan() {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		raw := strings.TrimSpace(sc.Text())
		if raw == "" {
			continue
		}

		if strings.HasPrefix(raw, "bestmove") {
			mv := getTokenAfter(raw, "bestmove")
			if mv != "" && mv != "(none)" {
				bestMove = normalizeCastlingMove(fen, mv)
			}
			break
		}

		if !strings.HasPrefix(raw, "info") {
			continue
		}

		pv := getPV(raw)
		mpvStr := getTokenAfter(raw, "multipv")
		depthStr := getTokenAfter(raw, "depth")
		if len(pv) == 0 || mpvStr == "" || depthStr == "" {
			continue
		}
		mpv, err := strconv.Atoi(mpvStr)
		if err != nil || mpv < 1 {
			continue
		}
		d, err := strconv.Atoi(depthStr)
		if err != nil || d < 0 {
			continue
		}

		// score parsing (cp or mate)
		var cpPtr *int
		var matePtr *int
		if scoreType, scoreVal, ok := getScore(raw); ok {
			switch scoreType {
			case "cp":
				v := scoreVal
				cpPtr = &v
			case "mate":
				v := scoreVal
				matePtr = &v
			}
		}

		// keep max depth per mpv
		if prev, ok := linesByMPV[mpv]; ok && d < prev.Depth {
			continue
		}

		pv = normalizePVForCastling(fen, pv)
		linesByMPV[mpv] = EngineLine{
			PV:      pv,
			Depth:   d,
			MultiPV: mpv,
			CP:      cpPtr,
			Mate:    matePtr,
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}

	// Convert score from side-to-move to White perspective (reference parsing behavior)
	whiteToMove := strings.Fields(fen)
	if len(whiteToMove) >= 2 && whiteToMove[1] == "b" {
		for k, line := range linesByMPV {
			if line.CP != nil {
				v := -*line.CP
				line.CP = &v
			}
			if line.Mate != nil {
				v := -*line.Mate
				line.Mate = &v
			}
			linesByMPV[k] = line
		}
	}

	// sort by mpv asc
	out := make([]EngineLine, 0, len(linesByMPV))
	for _, v := range linesByMPV {
		out = append(out, v)
	}
	sortEngineLines(out)

	return &EnginePositionEval{
		BestMove: bestMove,
		Lines:    out,
	}, nil
}

func getTokenAfter(line string, token string) string {
	parts := strings.Fields(line)
	for i := 0; i < len(parts)-1; i++ {
		if parts[i] == token {
			return parts[i+1]
		}
	}
	return ""
}

func getScore(line string) (scoreType string, scoreVal int, ok bool) {
	parts := strings.Fields(line)
	for i := 0; i < len(parts)-2; i++ {
		if parts[i] == "score" {
			t := parts[i+1]
			v, err := strconv.Atoi(parts[i+2])
			if err != nil {
				return "", 0, false
			}
			if t == "cp" || t == "mate" {
				return t, v, true
			}
			return "", 0, false
		}
	}
	return "", 0, false
}

func getPV(line string) []string {
	parts := strings.Fields(line)
	for i := 0; i < len(parts)-1; i++ {
		if parts[i] == "pv" {
			return append([]string{}, parts[i+1:]...)
		}
	}
	return nil
}

func sortEngineLines(lines []EngineLine) {
	// stable insertion sort small N (<=6)
	for i := 1; i < len(lines); i++ {
		j := i
		for j > 0 && lines[j-1].MultiPV > lines[j].MultiPV {
			lines[j-1], lines[j] = lines[j], lines[j-1]
			j--
		}
	}
}

// PV castling normalization: based on castling rights (KQkq), normalize castling UCI in PV to standard form.
func normalizePVForCastling(fen string, pv []string) []string {
	fields := strings.Fields(fen)
	if len(fields) < 3 {
		return pv
	}
	castling := fields[2]
	canWK := strings.Contains(castling, "K")
	canWQ := strings.Contains(castling, "Q")
	canBK := strings.Contains(castling, "k")
	canBQ := strings.Contains(castling, "q")

	out := make([]string, 0, len(pv))
	for _, uci := range pv {
		switch {
		case uci == "e1h1" && canWK:
			canWK = false
			out = append(out, "e1g1")
		case uci == "e1a1" && canWQ:
			canWQ = false
			out = append(out, "e1c1")
		case uci == "e8h8" && canBK:
			canBK = false
			out = append(out, "e8g8")
		case uci == "e8a8" && canBQ:
			canBQ = false
			out = append(out, "e8c8")
		default:
			out = append(out, uci)
		}
	}
	return out
}

func normalizeCastlingMove(fen string, uci string) string {
	if uci == "" {
		return uci
	}
	// PV 정규화의 단일 move 버전
	pv := normalizePVForCastling(fen, []string{uci})
	if len(pv) == 1 {
		return pv[0]
	}
	return uci
}

// Helper for callers: a conservative default timeout for a single position evaluation.
func DefaultEngineTimeout(depth int) time.Duration {
	// depth가 커질수록 시간이 늘어날 수 있으니 느슨하게.
	if depth <= 12 {
		return 5 * time.Second
	}
	if depth <= 18 {
		return 10 * time.Second
	}
	return 20 * time.Second
}


