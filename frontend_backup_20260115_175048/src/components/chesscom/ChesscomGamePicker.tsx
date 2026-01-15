import { useMemo, useState } from 'react';
import { chesscomApi } from '../../api';
import { ChesscomGame, User } from '../../types';
import './ChesscomGamePicker.css';

interface ChesscomGamePickerProps {
  player1: User;
  player2: User;
  title?: string;
  requireDecisive?: boolean;
  onSubmit: (payload: { year: number; month: number; game_id: string }) => Promise<void>;
  onCancel: () => void;
}

function formatGameResult(game: ChesscomGame): string {
  if (game.white.result === 'win') return '1-0';
  if (game.black.result === 'win') return '0-1';
  return '½-½';
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ko-KR');
}

export function ChesscomGamePicker({ player1, player2, title, requireDecisive, onSubmit, onCancel }: ChesscomGamePickerProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [games, setGames] = useState<ChesscomGame[]>([]);
  const [alreadyImported, setAlreadyImported] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchDone, setSearchDone] = useState(false);

  const [selectedGameId, setSelectedGameId] = useState<string>('');

  const availableGames = useMemo(() => {
    const base = games.filter(g => !alreadyImported.includes(g.game_id));
    if (!requireDecisive) return base;
    return base.filter(g => g.white.result === 'win' || g.black.result === 'win');
  }, [games, alreadyImported, requireDecisive]);

  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setSearchDone(false);
    setSelectedGameId('');
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const res = await chesscomApi.getGames(player1.id, player2.id, year, month);
      setGames(res.games || []);
      setAlreadyImported(res.already_imported || []);
      setSearchDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chess.com 게임 조회에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedGameId) return;
    setSubmitting(true);
    setError('');
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      await onSubmit({ year, month, game_id: selectedGameId });
    } catch (err) {
      setError(err instanceof Error ? err.message : '결과 등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="chesscom-game-picker">
      <div className="picker-header">
        <h3>{title || 'Chess.com 게임 선택'}</h3>
        <div className="picker-subtitle">
          <b>{player1.name}</b> vs <b>{player2.name}</b>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="controls">
        <div className="form-group">
          <label htmlFor="month">년/월</label>
          <select
            id="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={loading || submitting}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-search" onClick={handleSearch} disabled={loading || submitting}>
          {loading ? '조회 중...' : '게임 조회'}
        </button>
      </div>

      {searchDone && (
        <div className="results">
          {availableGames.length === 0 ? (
            <div className="empty">
              {games.length === 0 ? '해당 월에 두 플레이어의 대국이 없습니다.' : '해당 월의 대국이 모두 이미 등록되었습니다.'}
            </div>
          ) : (
            <div className="games">
              {availableGames.map(game => (
                <label key={game.game_id} className={`game ${selectedGameId === game.game_id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="game"
                    value={game.game_id}
                    checked={selectedGameId === game.game_id}
                    onChange={() => setSelectedGameId(game.game_id)}
                    disabled={submitting}
                  />
                  <span className="meta">
                    <span className="date">{formatDate(game.end_time)}</span>
                    <span className="players">
                      <span className="white">{game.white.username}</span>
                      <span className="vs">vs</span>
                      <span className="black">{game.black.username}</span>
                    </span>
                    <span className="result">{formatGameResult(game)}</span>
                    <span className="type">{game.time_class}{game.rated ? ' (rated)' : ''}</span>
                    <a className="link" href={game.url} target="_blank" rel="noreferrer">
                      열기
                    </a>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading || submitting}>
          취소
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!selectedGameId || submitting || loading}
        >
          {submitting ? '등록 중...' : '선택한 게임으로 결과 등록'}
        </button>
      </div>
    </div>
  );
}


