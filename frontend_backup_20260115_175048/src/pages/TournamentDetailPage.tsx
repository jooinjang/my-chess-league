import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tournamentApi } from '../api';
import { Tournament, TournamentMatch, User } from '../types';
import { ChesscomGamePicker } from '../components/chesscom/ChesscomGamePicker';
import './TournamentDetailPage.css';

export function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = Number(params.id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [picker, setPicker] = useState<{
    matchId: number;
    player1: User;
    player2: User;
    isArmageddon: boolean;
  } | null>(null);

  const rounds = useMemo(() => {
    const s = new Set<number>();
    for (const m of matches) s.add(m.round_no);
    return Array.from(s).sort((a, b) => a - b);
  }, [matches]);

  const matchesByRound = useMemo(() => {
    const map = new Map<number, TournamentMatch[]>();
    for (const m of matches) {
      const arr = map.get(m.round_no) || [];
      arr.push(m);
      map.set(m.round_no, arr);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.match_no - b.match_no);
      map.set(k, arr);
    }
    return map;
  }, [matches]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [t, ms] = await Promise.all([
        tournamentApi.getById(tournamentId),
        tournamentApi.getBracket(tournamentId),
      ]);
      setTournament(t);
      setMatches(ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : '토너먼트 정보를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId) || tournamentId <= 0) return;
    load();
  }, [tournamentId]);

  const handleGenerateNextRound = async () => {
    setError('');
    try {
      await tournamentApi.generateNextRound(tournamentId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '라운드 생성에 실패했습니다');
    }
  };

  const openPicker = (m: TournamentMatch) => {
    if (!m.player1 || !m.player2) {
      setError('플레이어 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }
    setPicker({ matchId: m.id, player1: m.player1, player2: m.player2, isArmageddon: m.armageddon_required });
  };

  const handlePickerSubmit = async (payload: { year: number; month: number; game_id: string }) => {
    if (!picker) return;
    await tournamentApi.reportMatchChesscom(tournamentId, picker.matchId, payload);
    setPicker(null);
    await load();
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!tournament) return <div className="empty-state">토너먼트를 찾을 수 없습니다.</div>;

  return (
    <div className="tournament-detail">
      <div className="page-header">
        <div>
          <h1>{tournament.name}</h1>
          <div className="sub">
            <span className="pill">Double Elimination</span>
            <span className="pill">{tournament.status}</span>
          </div>
        </div>
        <div className="header-buttons">
          <Link to="/tournaments" className="btn-secondary-link">목록</Link>
          <button className="btn-add" onClick={handleGenerateNextRound}>
            + 다음 라운드 생성
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        <h3>참가자</h3>
        <div className="participants">
          {(tournament.participants || []).map(p => (
            <div key={p.id} className={`participant ${p.eliminated ? 'eliminated' : ''}`}>
              <span className="name">{p.user?.name || `User#${p.user_id}`}</span>
              <span className="record">{p.wins}W-{p.losses}L</span>
              {p.eliminated && <span className="badge">탈락</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="round-header">
          <h3>매치</h3>
          {matches.length === 0 && <span className="hint">아직 매치가 없습니다. “다음 라운드 생성”을 눌러주세요.</span>}
        </div>

        {picker && (
          <div className="picker-wrap">
            <ChesscomGamePicker
              player1={picker.player1}
              player2={picker.player2}
              title={picker.isArmageddon ? 'Armageddon 게임 선택 (결정전)' : 'Chess.com 게임 선택'}
              requireDecisive={picker.isArmageddon}
              onCancel={() => setPicker(null)}
              onSubmit={handlePickerSubmit}
            />
          </div>
        )}

        {rounds.map(r => (
          <div key={r} className="round">
            <div className="round-title">Round {r}</div>
            <div className="match-list">
              {(matchesByRound.get(r) || []).map(m => (
                <div key={m.id} className={`match ${m.status}`}>
                  <div className="left">
                    <div className="players">
                      <span className="p">{m.player1?.name || (m.player1_user_id ? `#${m.player1_user_id}` : 'TBD')}</span>
                      <span className="vs">vs</span>
                      <span className="p">{m.player2?.name || (m.player2_user_id ? `#${m.player2_user_id}` : 'TBD')}</span>
                    </div>
                    <div className="meta">
                      <span className="pill">{m.bracket}</span>
                      <span className="pill">{m.status}</span>
                      {m.armageddon_required && <span className="pill">Armageddon</span>}
                      {m.initial_match?.chesscom_game_id && <span className="pill">main {m.initial_match.chesscom_game_id}</span>}
                      {m.tiebreak_match?.chesscom_game_id && <span className="pill">tb {m.tiebreak_match.chesscom_game_id}</span>}
                      {m.linked_match?.chesscom_game_id && <span className="pill">game {m.linked_match.chesscom_game_id}</span>}
                    </div>
                  </div>
                  <div className="right">
                    {m.player1_user_id && m.player2_user_id && m.status !== 'done' ? (
                      <button className="btn-primary" onClick={() => openPicker(m)}>
                        {m.armageddon_required ? 'Armageddon 결과 등록' : 'Chess.com 결과 등록'}
                      </button>
                    ) : m.status === 'done' ? (
                      <span className="done">완료</span>
                    ) : (
                      <span className="hint">대기</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


