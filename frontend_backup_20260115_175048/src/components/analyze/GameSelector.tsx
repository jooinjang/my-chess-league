import { Match } from '../../types';
import './GameSelector.css';

interface GameSelectorProps {
  matches: Match[];
  selectedMatchId: number | null;
  onSelect: (matchId: number) => void;
  loading?: boolean;
}

export function GameSelector({ matches, selectedMatchId, onSelect, loading }: GameSelectorProps) {
  const matchesWithPgn = matches.filter((m) => m.pgn);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getResultLabel = (result: string) => {
    switch (result) {
      case 'white_win':
        return '1-0';
      case 'black_win':
        return '0-1';
      case 'draw':
        return '½-½';
      default:
        return '';
    }
  };

  return (
    <div className="game-selector">
      <select
        value={selectedMatchId || ''}
        onChange={(e) => onSelect(Number(e.target.value))}
        disabled={loading}
      >
        <option value="">Select a game to analyze...</option>
        {matchesWithPgn.map((match) => (
          <option key={match.id} value={match.id}>
            {formatDate(match.played_at)} - {match.white_player?.name || 'White'} vs{' '}
            {match.black_player?.name || 'Black'} ({getResultLabel(match.result)})
          </option>
        ))}
      </select>
      {matchesWithPgn.length === 0 && (
        <p className="no-games-hint">
          No games with PGN found. Import games from Chess.com to analyze.
        </p>
      )}
    </div>
  );
}
