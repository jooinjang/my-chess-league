import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { userApi } from '../api';
import { Match, User } from '../types';
import './UserDetailPage.css';

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatResultForUser(match: Match, userId: number) {
  const isWhite = match.white_player_id === userId;
  const isBlack = match.black_player_id === userId;

  if (!isWhite && !isBlack) return '-';
  if (match.result === 'draw') return '½-½ (무)';

  const userWon = (isWhite && match.result === 'white_win') || (isBlack && match.result === 'black_win');
  return userWon ? '승' : '패';
}

export function UserDetailPage() {
  const params = useParams();
  const userId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const recentMatches = useMemo(() => {
    const copy = [...matches];
    copy.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
    return copy.slice(0, 20);
  }, [matches]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, ms] = await Promise.all([
        userApi.getById(userId),
        userApi.getMatches(userId),
      ]);
      setUser(u);
      setMatches(ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : '유저 정보를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(userId) || userId <= 0) return;
    load();
  }, [userId]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <div className="empty-state">유저를 찾을 수 없습니다.</div>;

  return (
    <div className="user-detail">
      <div className="page-header">
        <div>
          <h1>{user.name}</h1>
          <div className="sub">
            <span className="pill">Rating {Math.round(user.rating)}</span>
            <span className="pill">RD {Math.round(user.rating_deviation)}</span>
            {user.chesscom_username && <span className="pill">@{user.chesscom_username}</span>}
          </div>
        </div>
        <div className="header-buttons">
          <Link to="/users" className="btn-secondary-link">목록</Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="grid">
        <div className="card">
          <h3>메모</h3>
          <div className="memo">
            {user.memo?.trim() ? user.memo : <span className="hint">메모가 없습니다.</span>}
          </div>
        </div>

        <div className="card">
          <h3>기본 정보</h3>
          <div className="meta">
            <div className="row">
              <span className="k">ID</span>
              <span className="v">{user.id}</span>
            </div>
            <div className="row">
              <span className="k">생성</span>
              <span className="v">{formatDateTime(user.created_at)}</span>
            </div>
            <div className="row">
              <span className="k">수정</span>
              <span className="v">{formatDateTime(user.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>최근 매치</h3>
          <span className="hint">최근 20개</span>
        </div>

        {recentMatches.length === 0 ? (
          <div className="empty">아직 기록된 매치가 없습니다.</div>
        ) : (
          <div className="user-matches">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>색</th>
                  <th>상대</th>
                  <th>결과</th>
                  <th>Game ID</th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.map((m) => {
                  const isWhite = m.white_player_id === user.id;
                  const opponentId = isWhite ? m.black_player_id : m.white_player_id;
                  const opponent = isWhite ? m.black_player : m.white_player;
                  const opponentFallback = isWhite ? `#${m.black_player_id}` : `#${m.white_player_id}`;
                  return (
                    <tr key={m.id}>
                      <td className="date">{formatDateTime(m.played_at)}</td>
                      <td className={`color ${isWhite ? 'white' : 'black'}`}>{isWhite ? 'White' : 'Black'}</td>
                      <td className="opponent">
                        {Number.isFinite(opponentId) && opponentId > 0 ? (
                          <Link className="user-link" to={`/users/${opponentId}`}>
                            {opponent?.name || opponentFallback}
                          </Link>
                        ) : (
                          <span>{opponent?.name || opponentFallback}</span>
                        )}
                      </td>
                      <td className="result">{formatResultForUser(m, user.id)}</td>
                      <td className="game">{m.chesscom_game_id || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
