package services

import (
	"errors"
	"fmt"
	"math/rand"
	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
	"sort"
	"strings"
	"time"
)

type LeagueService struct {
	userService     *UserService
	matchService    *MatchService
	chesscomService *ChesscomService
}

func NewLeagueService() *LeagueService {
	return &LeagueService{
		userService:     NewUserService(),
		matchService:    NewMatchService(),
		chesscomService: NewChesscomService(),
	}
}

func (s *LeagueService) CreateLeague(req *models.CreateLeagueRequest) (*models.League, error) {
	if req.Format == models.LeagueFormatSwiss && req.RoundCount <= 0 {
		return nil, errors.New("round_count is required for swiss and must be > 0")
	}
	if len(req.ParticipantUserIDs) < 2 {
		return nil, errors.New("at least 2 participants are required")
	}

	// Validate users exist
	seen := make(map[uint]struct{}, len(req.ParticipantUserIDs))
	for _, id := range req.ParticipantUserIDs {
		if _, ok := seen[id]; ok {
			return nil, errors.New("duplicate participant_user_ids")
		}
		seen[id] = struct{}{}
		if _, err := s.userService.GetUserByID(id); err != nil {
			return nil, fmt.Errorf("user not found: %d", id)
		}
	}

	league := models.League{
		Name:       req.Name,
		Format:     req.Format,
		Status:     models.LeagueStatusDraft,
		RoundCount: req.RoundCount,
	}

	tx := database.DB.Begin()
	if err := tx.Create(&league).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	for i, uid := range req.ParticipantUserIDs {
		seed := i + 1
		p := models.LeagueParticipant{
			LeagueID: league.ID,
			UserID:   uid,
			Seed:     &seed,
		}
		if err := tx.Create(&p).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	tx.Commit()
	return s.GetLeagueByID(league.ID)
}

func (s *LeagueService) GetLeagues() ([]models.League, error) {
	var leagues []models.League
	err := database.DB.Order("id DESC").Find(&leagues).Error
	return leagues, err
}

func (s *LeagueService) GetLeagueByID(id uint) (*models.League, error) {
	var league models.League
	err := database.DB.Preload("Participants").Preload("Participants.User").First(&league, id).Error
	if err != nil {
		return nil, err
	}
	return &league, nil
}

func (s *LeagueService) UpdateLeagueName(id uint, name string) (*models.League, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	if err := database.DB.Model(&models.League{}).Where("id = ?", id).Update("name", name).Error; err != nil {
		return nil, err
	}
	return s.GetLeagueByID(id)
}

func (s *LeagueService) DeleteLeague(id uint) error {
	tx := database.DB.Begin()
	// delete children first (avoid leaving stale rows)
	if err := tx.Where("league_id = ?", id).Delete(&models.LeaguePairing{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Where("league_id = ?", id).Delete(&models.LeagueParticipant{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Delete(&models.League{}, id).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func (s *LeagueService) GetRoundPairings(leagueID uint, roundNo int) ([]models.LeaguePairing, error) {
	var pairings []models.LeaguePairing
	err := database.DB.
		Preload("Player1").Preload("Player2").
		Preload("LinkedMatch").Preload("LinkedMatch.WhitePlayer").Preload("LinkedMatch.BlackPlayer").
		Where("league_id = ? AND round_no = ?", leagueID, roundNo).
		Order("id ASC").
		Find(&pairings).Error
	return pairings, err
}

func (s *LeagueService) GetAllPairings(leagueID uint) ([]models.LeaguePairing, error) {
	var pairings []models.LeaguePairing
	err := database.DB.
		Preload("Player1").Preload("Player2").
		Preload("LinkedMatch").Preload("LinkedMatch.WhitePlayer").Preload("LinkedMatch.BlackPlayer").
		Where("league_id = ?", leagueID).
		Order("round_no ASC").Order("id ASC").
		Find(&pairings).Error
	return pairings, err
}

type LeagueStanding struct {
	UserID uint    `json:"user_id"`
	Name   string  `json:"name"`
	Points float64 `json:"points"`
	Played int     `json:"played"`
	Wins   int     `json:"wins"`
	Draws  int     `json:"draws"`
	Losses int     `json:"losses"`
}

func (s *LeagueService) GetStandings(leagueID uint) ([]LeagueStanding, error) {
	league, err := s.GetLeagueByID(leagueID)
	if err != nil {
		return nil, err
	}

	standByUser := make(map[uint]*LeagueStanding, len(league.Participants))
	for _, p := range league.Participants {
		standByUser[p.UserID] = &LeagueStanding{
			UserID: p.UserID,
			Name:   p.User.Name,
		}
	}

	var pairings []models.LeaguePairing
	if err := database.DB.
		Preload("LinkedMatch").
		Where("league_id = ?", leagueID).
		Order("round_no ASC").Order("id ASC").
		Find(&pairings).Error; err != nil {
		return nil, err
	}

	applyResult := func(uid uint, score float64, w, d, l int) {
		st, ok := standByUser[uid]
		if !ok {
			return
		}
		st.Points += score
		st.Played++
		st.Wins += w
		st.Draws += d
		st.Losses += l
	}

	for _, pr := range pairings {
		if pr.IsBye {
			// Bye counts as a win (1 point) for Player1
			if pr.Status == models.PairingStatusDone {
				applyResult(pr.Player1UserID, 1.0, 1, 0, 0)
			}
			continue
		}
		if pr.LinkedMatch == nil || pr.Status != models.PairingStatusDone {
			continue
		}
		m := pr.LinkedMatch

		switch m.Result {
		case models.WhiteWin:
			applyResult(m.WhitePlayerID, 1.0, 1, 0, 0)
			applyResult(m.BlackPlayerID, 0.0, 0, 0, 1)
		case models.BlackWin:
			applyResult(m.WhitePlayerID, 0.0, 0, 0, 1)
			applyResult(m.BlackPlayerID, 1.0, 1, 0, 0)
		case models.Draw:
			applyResult(m.WhitePlayerID, 0.5, 0, 1, 0)
			applyResult(m.BlackPlayerID, 0.5, 0, 1, 0)
		}
	}

	out := make([]LeagueStanding, 0, len(standByUser))
	for _, st := range standByUser {
		out = append(out, *st)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Points != out[j].Points {
			return out[i].Points > out[j].Points
		}
		if out[i].Wins != out[j].Wins {
			return out[i].Wins > out[j].Wins
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

func (s *LeagueService) GenerateNextRound(leagueID uint) ([]models.LeaguePairing, error) {
	league, err := s.GetLeagueByID(leagueID)
	if err != nil {
		return nil, err
	}
	if league.Status == models.LeagueStatusCompleted {
		return nil, errors.New("league is completed")
	}

	var maxRound int
	database.DB.Model(&models.LeaguePairing{}).
		Where("league_id = ?", leagueID).
		Select("COALESCE(MAX(round_no), 0)").Scan(&maxRound)
	nextRound := maxRound + 1

	participants := make([]models.LeagueParticipant, 0, len(league.Participants))
	for _, p := range league.Participants {
		if !p.Dropped {
			participants = append(participants, p)
		}
	}
	if len(participants) < 2 {
		return nil, errors.New("not enough participants")
	}

	// Round limit
	if league.Format == models.LeagueFormatSwiss {
		if league.RoundCount <= 0 {
			return nil, errors.New("league round_count is invalid")
		}
		if nextRound > league.RoundCount {
			return nil, errors.New("swiss rounds exceeded")
		}
	} else {
		// Round robin single round
		n := len(participants)
		totalRounds := n - 1
		if n%2 == 1 {
			totalRounds = n
		}
		if nextRound > totalRounds {
			return nil, errors.New("round robin rounds exceeded")
		}
	}

	// Ensure running status once rounds begin
	if league.Status == models.LeagueStatusDraft {
		if err := database.DB.Model(&models.League{}).Where("id = ?", leagueID).
			Update("status", models.LeagueStatusRunning).Error; err != nil {
			return nil, err
		}
	}

	if league.Format == models.LeagueFormatRoundRobin {
		_, err = s.generateRoundRobinRound(leagueID, participants, nextRound)
	} else {
		_, err = s.generateSwissRound(leagueID, participants, nextRound)
	}
	if err != nil {
		return nil, err
	}
	return s.GetRoundPairings(leagueID, nextRound)
}

func (s *LeagueService) generateRoundRobinRound(leagueID uint, participants []models.LeagueParticipant, roundNo int) ([]models.LeaguePairing, error) {
	// Deterministic order by seed then id
	sort.SliceStable(participants, func(i, j int) bool {
		si, sj := 0, 0
		if participants[i].Seed != nil {
			si = *participants[i].Seed
		}
		if participants[j].Seed != nil {
			sj = *participants[j].Seed
		}
		if si != sj {
			return si < sj
		}
		return participants[i].UserID < participants[j].UserID
	})

	userIDs := make([]uint, 0, len(participants))
	for _, p := range participants {
		userIDs = append(userIDs, p.UserID)
	}

	ids := make([]*uint, 0, len(userIDs)+1)
	for i := range userIDs {
		v := userIDs[i]
		ids = append(ids, &v)
	}
	if len(ids)%2 == 1 {
		ids = append(ids, nil) // bye slot
	}

	n := len(ids)
	// Circle method: keep first fixed, rotate the rest (roundNo-1 times)
	fixed := ids[0]
	rest := append([]*uint{}, ids[1:]...)
	rot := func(a []*uint) []*uint {
		if len(a) <= 1 {
			return a
		}
		last := a[len(a)-1]
		copy(a[1:], a[0:len(a)-1])
		a[0] = last
		return a
	}
	for i := 1; i < roundNo; i++ {
		rest = rot(rest)
	}
	arr := append([]*uint{fixed}, rest...)

	tx := database.DB.Begin()
	matchNo := 1
	for i := 0; i < n/2; i++ {
		a := arr[i]
		b := arr[n-1-i]
		// If either is bye, assign bye to the real player
		if a == nil && b == nil {
			continue
		}
		if a == nil || b == nil {
			real := a
			if real == nil {
				real = b
			}
			p := models.LeaguePairing{
				LeagueID:      leagueID,
				RoundNo:       roundNo,
				Player1UserID: *real,
				Player2UserID: nil,
				IsBye:         true,
				Status:        models.PairingStatusDone,
			}
			if err := tx.Create(&p).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
			matchNo++
			continue
		}

		// Alternate colors by round/match to reduce bias
		p1 := *a
		p2 := *b
		if (roundNo+i)%2 == 1 {
			p1, p2 = p2, p1
		}

		p := models.LeaguePairing{
			LeagueID:      leagueID,
			RoundNo:       roundNo,
			Player1UserID: p1,
			Player2UserID: &p2,
			IsBye:         false,
			Status:        models.PairingStatusPending,
		}
		if err := tx.Create(&p).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		matchNo++
	}
	tx.Commit()
	return nil, nil
}

func (s *LeagueService) generateSwissRound(leagueID uint, participants []models.LeagueParticipant, roundNo int) ([]models.LeaguePairing, error) {
	standings, err := s.GetStandings(leagueID)
	if err != nil {
		return nil, err
	}

	scoreByUser := make(map[uint]float64, len(standings))
	for _, st := range standings {
		scoreByUser[st.UserID] = st.Points
	}

	// Past opponents map for rematch avoidance
	opponents := make(map[uint]map[uint]struct{})
	var prev []models.LeaguePairing
	if err := database.DB.Where("league_id = ? AND is_bye = 0", leagueID).Find(&prev).Error; err != nil {
		return nil, err
	}
	for _, p := range prev {
		if p.Player2UserID == nil {
			continue
		}
		a, b := p.Player1UserID, *p.Player2UserID
		if opponents[a] == nil {
			opponents[a] = make(map[uint]struct{})
		}
		if opponents[b] == nil {
			opponents[b] = make(map[uint]struct{})
		}
		opponents[a][b] = struct{}{}
		opponents[b][a] = struct{}{}
	}

	type node struct {
		UserID uint
		Score  float64
		Seed   int
	}
	nodes := make([]node, 0, len(participants))
	for _, p := range participants {
		seed := 999999
		if p.Seed != nil {
			seed = *p.Seed
		}
		nodes = append(nodes, node{
			UserID: p.UserID,
			Score:  scoreByUser[p.UserID],
			Seed:   seed,
		})
	}

	// Shuffle within same score a bit to avoid deterministic bias when all 0-0
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(nodes), func(i, j int) { nodes[i], nodes[j] = nodes[j], nodes[i] })

	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].Score != nodes[j].Score {
			return nodes[i].Score > nodes[j].Score
		}
		return nodes[i].Seed < nodes[j].Seed
	})

	used := make(map[uint]bool, len(nodes))
	tx := database.DB.Begin()
	matchNo := 1

	// Bye if odd: give to lowest score player who hasn't gotten a bye yet
	if len(nodes)%2 == 1 {
		byeGiven := make(map[uint]bool)
		var byes []models.LeaguePairing
		_ = database.DB.Where("league_id = ? AND is_bye = 1", leagueID).Find(&byes).Error
		for _, b := range byes {
			byeGiven[b.Player1UserID] = true
		}

		byeIdx := -1
		for i := len(nodes) - 1; i >= 0; i-- {
			if !byeGiven[nodes[i].UserID] {
				byeIdx = i
				break
			}
		}
		if byeIdx == -1 {
			byeIdx = len(nodes) - 1
		}
		byeUser := nodes[byeIdx].UserID
		used[byeUser] = true
		p := models.LeaguePairing{
			LeagueID:      leagueID,
			RoundNo:       roundNo,
			Player1UserID: byeUser,
			Player2UserID: nil,
			IsBye:         true,
			Status:        models.PairingStatusDone,
		}
		if err := tx.Create(&p).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		matchNo++
	}

	// Pair remaining
	for i := 0; i < len(nodes); i++ {
		a := nodes[i].UserID
		if used[a] {
			continue
		}
		used[a] = true

		// Find the best opponent (prefer same score and not played before)
		bestJ := -1
		for j := i + 1; j < len(nodes); j++ {
			b := nodes[j].UserID
			if used[b] {
				continue
			}
			if opponents[a] != nil {
				if _, played := opponents[a][b]; played {
					continue
				}
			}
			bestJ = j
			break
		}
		// If none found, allow rematch (still pick next available)
		if bestJ == -1 {
			for j := i + 1; j < len(nodes); j++ {
				b := nodes[j].UserID
				if used[b] {
					continue
				}
				bestJ = j
				break
			}
		}
		if bestJ == -1 {
			tx.Rollback()
			return nil, errors.New("failed to create swiss pairings")
		}

		b := nodes[bestJ].UserID
		used[b] = true

		// Alternate colors by round/match for rough balance
		p1, p2 := a, b
		if (roundNo+matchNo)%2 == 1 {
			p1, p2 = b, a
		}

		p := models.LeaguePairing{
			LeagueID:      leagueID,
			RoundNo:       roundNo,
			Player1UserID: p1,
			Player2UserID: &p2,
			IsBye:         false,
			Status:        models.PairingStatusPending,
		}
		if err := tx.Create(&p).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		matchNo++
	}

	tx.Commit()
	return nil, nil
}

func (s *LeagueService) ReportPairingResultFromChesscom(leagueID uint, pairingID uint, req *models.LeagueReportChesscomResultRequest) (*models.LeaguePairing, error) {
	var pairing models.LeaguePairing
	if err := database.DB.First(&pairing, pairingID).Error; err != nil {
		return nil, err
	}
	if pairing.LeagueID != leagueID {
		return nil, errors.New("pairing does not belong to league")
	}
	if pairing.IsBye {
		return nil, errors.New("cannot report result for bye pairing")
	}
	if pairing.Status == models.PairingStatusDone {
		return nil, errors.New("pairing already completed")
	}
	if pairing.Player2UserID == nil {
		return nil, errors.New("pairing missing player2")
	}

	// Load users and chess.com usernames
	u1, err := s.userService.GetUserByID(pairing.Player1UserID)
	if err != nil {
		return nil, errors.New("player1 not found")
	}
	u2, err := s.userService.GetUserByID(*pairing.Player2UserID)
	if err != nil {
		return nil, errors.New("player2 not found")
	}
	if u1.ChesscomUsername == nil || strings.TrimSpace(*u1.ChesscomUsername) == "" {
		return nil, errors.New("player1 has no chess.com username")
	}
	if u2.ChesscomUsername == nil || strings.TrimSpace(*u2.ChesscomUsername) == "" {
		return nil, errors.New("player2 has no chess.com username")
	}

	// Prevent duplicates
	var existing models.Match
	if err := database.DB.Where("chesscom_game_id = ?", req.GameID).First(&existing).Error; err == nil {
		return nil, errors.New("this chess.com game is already imported")
	}

	games, err := s.chesscomService.GetGamesBetweenPlayers(*u1.ChesscomUsername, *u2.ChesscomUsername, req.Year, req.Month)
	if err != nil {
		return nil, err
	}
	var chosen *ChesscomGame
	for i := range games {
		if games[i].GameID == req.GameID {
			chosen = &games[i]
			break
		}
	}
	if chosen == nil {
		return nil, errors.New("game_id not found for these players in the selected month")
	}

	// Map white/black to user IDs based on usernames from the game
	whiteUsername := strings.ToLower(chosen.White.Username)
	u1c := strings.ToLower(strings.TrimSpace(*u1.ChesscomUsername))
	var whiteID, blackID uint
	if whiteUsername == u1c {
		whiteID = u1.ID
		blackID = u2.ID
	} else {
		whiteID = u2.ID
		blackID = u1.ID
	}

	result := ConvertResultToMatchResult(chosen.White.Result, chosen.Black.Result)
	playedAt := time.Unix(chosen.EndTime, 0).UTC()
	gameIDCopy := req.GameID

	match, err := s.matchService.CreateMatch(&models.CreateMatchRequest{
		WhitePlayerID:  whiteID,
		BlackPlayerID:  blackID,
		Result:         models.MatchResult(result),
		PlayedAt:       playedAt,
		ChesscomGameID: &gameIDCopy,
	})
	if err != nil {
		return nil, err
	}

	if err := database.DB.Model(&models.LeaguePairing{}).Where("id = ?", pairing.ID).
		Updates(map[string]interface{}{
			"status":          models.PairingStatusDone,
			"linked_match_id": match.ID,
		}).Error; err != nil {
		return nil, err
	}

	var out models.LeaguePairing
	if err := database.DB.
		Preload("Player1").Preload("Player2").
		Preload("LinkedMatch").Preload("LinkedMatch.WhitePlayer").Preload("LinkedMatch.BlackPlayer").
		First(&out, pairing.ID).Error; err != nil {
		return nil, err
	}
	return &out, nil
}
