import { useState, useMemo } from 'react';
import { User, ChesscomGame, CreateMatchRequest, MatchResult } from '../../types';
import { chesscomApi, matchApi } from '../../api';
import './ChesscomImport.css';

interface ChesscomImportProps {
  users: User[];
  onComplete: (count?: number) => void;
  onCancel: () => void;
}

export function ChesscomImport({ users, onComplete, onCancel }: ChesscomImportProps) {
  const [user1Id, setUser1Id] = useState('');
  const [user2Id, setUser2Id] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [games, setGames] = useState<ChesscomGame[]>([]);
  const [alreadyImported, setAlreadyImported] = useState<string[]>([]);
  const [userMapping, setUserMapping] = useState<{
    user1: { id: number; name: string; chesscom_username: string };
    user2: { id: number; name: string; chesscom_username: string };
  } | null>(null);

  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [searchDone, setSearchDone] = useState(false);

  // Filter users that have Chess.com username
  const chesscomUsers = useMemo(() =>
    users.filter(u => u.chesscom_username),
    [users]
  );

  // Available games (excluding already imported)
  const availableGames = useMemo(() =>
    games.filter(g => !alreadyImported.includes(g.game_id)),
    [games, alreadyImported]
  );

  const handleSearch = async () => {
    if (!user1Id || !user2Id) {
      setError('Please select both players');
      return;
    }

    if (user1Id === user2Id) {
      setError('Please select different players');
      return;
    }

    setLoading(true);
    setError('');
    setGames([]);
    setSelectedGameIds(new Set());
    setSearchDone(false);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const result = await chesscomApi.getGames(
        parseInt(user1Id),
        parseInt(user2Id),
        year,
        month
      );

      setGames(result.games || []);
      setAlreadyImported(result.already_imported || []);
      setUserMapping({ user1: result.user1, user2: result.user2 });
      setSearchDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGameIds(new Set(availableGames.map(g => g.game_id)));
    } else {
      setSelectedGameIds(new Set());
    }
  };

  const handleSelectGame = (gameId: string, checked: boolean) => {
    const newSet = new Set(selectedGameIds);
    if (checked) {
      newSet.add(gameId);
    } else {
      newSet.delete(gameId);
    }
    setSelectedGameIds(newSet);
  };

  const convertToMatchResult = (game: ChesscomGame): MatchResult => {
    if (game.white.result === 'win') return 'white_win';
    if (game.black.result === 'win') return 'black_win';
    return 'draw';
  };

  const handleImport = async () => {
    if (selectedGameIds.size === 0 || !userMapping) return;

    setImporting(true);
    setError('');

    try {
      const selectedGames = availableGames.filter(g => selectedGameIds.has(g.game_id));

      const matches: CreateMatchRequest[] = selectedGames.map(game => {
        // Determine which user is white and which is black
        const whiteChesscomUsername = game.white.username.toLowerCase();
        const user1ChesscomUsername = userMapping.user1.chesscom_username.toLowerCase();

        let whitePlayerId: number;
        let blackPlayerId: number;

        if (whiteChesscomUsername === user1ChesscomUsername) {
          whitePlayerId = userMapping.user1.id;
          blackPlayerId = userMapping.user2.id;
        } else {
          whitePlayerId = userMapping.user2.id;
          blackPlayerId = userMapping.user1.id;
        }

        return {
          white_player_id: whitePlayerId,
          black_player_id: blackPlayerId,
          result: convertToMatchResult(game),
          played_at: new Date(game.end_time * 1000).toISOString(),
          chesscom_game_id: game.game_id,
          pgn: game.pgn,
        };
      });

      await matchApi.createBulk({ matches });
      onComplete(matches.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import matches');
    } finally {
      setImporting(false);
    }
  };

  const formatGameResult = (game: ChesscomGame): string => {
    if (game.white.result === 'win') return '1-0';
    if (game.black.result === 'win') return '0-1';
    return '½-½';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  return (
    <div className="chesscom-import">
      <h3>Import from Chess.com</h3>

      {error && <div className="error-message">{error}</div>}

      <div className="search-section">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="user1">Player 1</label>
            <select
              id="user1"
              value={user1Id}
              onChange={(e) => setUser1Id(e.target.value)}
              disabled={loading}
            >
              <option value="">Select player</option>
              {chesscomUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} (@{user.chesscom_username})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="user2">Player 2</label>
            <select
              id="user2"
              value={user2Id}
              onChange={(e) => setUser2Id(e.target.value)}
              disabled={loading}
            >
              <option value="">Select player</option>
              {chesscomUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} (@{user.chesscom_username})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="month">Month</label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={loading}
            >
              {getMonthOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn-search"
          onClick={handleSearch}
          disabled={loading || !user1Id || !user2Id}
        >
          {loading ? 'Searching...' : 'Search Games'}
        </button>
      </div>

      {searchDone && (
        <div className="results-section">
          {availableGames.length === 0 ? (
            <div className="no-games">
              {games.length === 0
                ? 'No games found between these players for the selected month.'
                : 'All games from this month have already been imported.'}
            </div>
          ) : (
            <>
              <div className="select-all">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedGameIds.size === availableGames.length && availableGames.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  Select All ({availableGames.length} games)
                </label>
              </div>

              <div className="games-list">
                {availableGames.map((game) => (
                  <div key={game.game_id} className="game-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedGameIds.has(game.game_id)}
                        onChange={(e) => handleSelectGame(game.game_id, e.target.checked)}
                      />
                      <span className="game-info">
                        <span className="game-date">{formatDate(game.end_time)}</span>
                        <span className="game-players">
                          <span className="player white">{game.white.username}</span>
                          <span className="vs">vs</span>
                          <span className="player black">{game.black.username}</span>
                        </span>
                        <span className="game-result">{formatGameResult(game)}</span>
                        <span className="game-type">{game.time_class}</span>
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        {searchDone && availableGames.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleImport}
            disabled={importing || selectedGameIds.size === 0}
          >
            {importing ? 'Importing...' : `Import (${selectedGameIds.size})`}
          </button>
        )}
      </div>
    </div>
  );
}
