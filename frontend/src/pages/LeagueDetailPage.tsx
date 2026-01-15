import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { leagueApi } from '../api';
import { League, LeaguePairing, LeagueStanding, User } from '../types';
import { ChesscomGamePicker } from '../components/chesscom/ChesscomGamePicker';
import './LeagueDetailPage.css';

export function LeagueDetailPage() {
  const params = useParams();
  const leagueId = Number(params.id);

  const [league, setLeague] = useState<League | null>(null);
  const [pairings, setPairings] = useState<LeaguePairing[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const [currentRound, setCurrentRound] = useState<number>(1);
  const [picker, setPicker] = useState<{
    pairingId: number;
    player1: User;
    player2: User;
  } | null>(null);

  const rounds = useMemo(() => {
    const s = new Set<number>();
    for (const p of pairings) s.add(p.round_no);
    return Array.from(s).sort((a, b) => a - b);
  }, [pairings]);

  const maxRound = useMemo(() => (rounds.length ? rounds[rounds.length - 1] : 0), [rounds]);

  const currentPairings = useMemo(
    () => pairings.filter(p => p.round_no === currentRound),
    [pairings, currentRound]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [l, ps, ss] = await Promise.all([
        leagueApi.getById(leagueId),
        leagueApi.getPairings(leagueId),
        leagueApi.getStandings(leagueId),
      ]);
      setLeague(l);
      setDraftName(l.name);
      setPairings(ps);
      setStandings(ss);
      const rs = Array.from(new Set(ps.map(p => p.round_no))).sort((a, b) => a - b);
      if (rs.length) setCurrentRound(rs[rs.length - 1]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '리그 정보를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(leagueId) || leagueId <= 0) return;
    load();
  }, [leagueId]);

  const handleGenerateNextRound = async () => {
    setError('');
    try {
      await leagueApi.generateNextRound(leagueId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '라운드 생성에 실패했습니다');
    }
  };

  const handleSaveName = async () => {
    if (!league) return;
    setError('');
    try {
      const updated = await leagueApi.updateName(league.id, draftName);
      setLeague(updated);
      setEditingName(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '리그 이름 수정에 실패했습니다');
    }
  };

  const openPicker = (pairing: LeaguePairing) => {
    if (!pairing.player1 || !pairing.player2) {
      setError('플레이어 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }
    setPicker({
      pairingId: pairing.id,
      player1: pairing.player1,
      player2: pairing.player2,
    });
  };

  const handlePickerSubmit = async (payload: { year: number; month: number; game_id: string }) => {
    if (!picker) return;
    await leagueApi.reportPairingChesscom(leagueId, picker.pairingId, payload);
    setPicker(null);
    await load();
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!league) return <div className="empty-state">리그를 찾을 수 없습니다.</div>;

  return (
    <div className="league-detail">
      <div className="page-header">
        <div>
          {!editingName ? (
            <div className="title-row">
              <h1>{league.name}</h1>
              <button type="button" className="btn-ghost" onClick={() => setEditingName(true)}>
                이름 수정
              </button>
            </div>
          ) : (
            <div className="title-edit">
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              <button type="button" className="btn-add" onClick={handleSaveName}>
                저장
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setDraftName(league.name); setEditingName(false); }}>
                취소
              </button>
            </div>
          )}
          <div className="sub">
            <span className="pill">{league.format}</span>
            <span className="pill">{league.status}</span>
            {league.format === 'swiss' && <span className="pill">{league.round_count}R</span>}
          </div>
        </div>
        <div className="header-buttons">
          <Link to="/leagues" className="btn-secondary-link">목록</Link>
          <button className="btn-add" onClick={handleGenerateNextRound}>
            + 다음 라운드 생성
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        <div className="card">
          <h3>참가자</h3>
          <div className="participants">
            {(league.participants || []).map(p => (
              <div key={p.id} className="participant">
                <span className="name">{p.user?.name || `User#${p.user_id}`}</span>
                {p.user?.chesscom_username && <span className="hint">@{p.user.chesscom_username}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>스탠딩</h3>
          {standings.length === 0 ? (
            <div className="empty">아직 반영된 결과가 없습니다.</div>
          ) : (
            <table className="standings">
              <thead>
                <tr>
                  <th>#</th>
                  <th>이름</th>
                  <th>점수</th>
                  <th>전적</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => (
                  <tr key={s.user_id}>
                    <td>{idx + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.points}</td>
                    <td>{s.wins}-{s.draws}-{s.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="round-header">
          <h3>라운드</h3>
          <div className="round-controls">
            <label>
              라운드 선택
              <select
                value={currentRound}
                onChange={(e) => setCurrentRound(parseInt(e.target.value, 10))}
                disabled={rounds.length === 0}
              >
                {rounds.map(r => (
                  <option key={r} value={r}>
                    Round {r}
                  </option>
                ))}
              </select>
            </label>
            {maxRound === 0 && <span className="hint">아직 라운드가 없습니다. “다음 라운드 생성”을 눌러주세요.</span>}
          </div>
        </div>

        {picker && (
          <div className="picker-wrap">
            <ChesscomGamePicker
              player1={picker.player1}
              player2={picker.player2}
              onCancel={() => setPicker(null)}
              onSubmit={handlePickerSubmit}
            />
          </div>
        )}

        {maxRound > 0 && (
          <div className="pairings">
            {currentPairings.length === 0 ? (
              <div className="empty">해당 라운드 대진이 없습니다.</div>
            ) : (
              currentPairings.map(p => (
                <div key={p.id} className={`pairing ${p.status}`}>
                  <div className="left">
                    <div className="players">
                      <span className="p">{p.player1?.name || `#${p.player1_user_id}`}</span>
                      <span className="vs">vs</span>
                      <span className="p">
                        {p.is_bye ? 'BYE' : (p.player2?.name || `#${p.player2_user_id}`)}
                      </span>
                    </div>
                    <div className="meta">
                      <span className="pill">R{p.round_no}</span>
                      <span className="pill">{p.status}</span>
                      {p.linked_match?.chesscom_game_id && (
                        <span className="pill">game {p.linked_match.chesscom_game_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="right">
                    {p.is_bye ? (
                      <span className="done">BYE (자동 1점)</span>
                    ) : p.status === 'done' ? (
                      <span className="done">완료</span>
                    ) : (
                      <button className="btn-primary" onClick={() => openPicker(p)}>
                        Chess.com 결과 등록
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
