import { useNavigate } from 'react-router-dom';
import { Match } from '../../types';
import './MatchList.css';

interface MatchListProps {
  matches: Match[];
  analyzedMatchIds?: Set<number>;
  onDelete: (id: number) => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getResultDisplay(result: string) {
  switch (result) {
    case 'white_win':
      return { text: '1-0', class: 'white-win' };
    case 'black_win':
      return { text: '0-1', class: 'black-win' };
    case 'draw':
      return { text: '½-½', class: 'draw' };
    default:
      return { text: '-', class: '' };
  }
}

function getRatingChange(before: number, after: number) {
  const change = Math.round(after - before);
  if (change > 0) return { text: `+${change}`, class: 'positive', ariaLabel: `increased by ${change}` };
  if (change < 0) return { text: `${change}`, class: 'negative', ariaLabel: `decreased by ${Math.abs(change)}` };
  return { text: '0', class: 'neutral', ariaLabel: 'no change' };
}

export function MatchList({ matches, analyzedMatchIds, onDelete }: MatchListProps) {
  const navigate = useNavigate();

  const handleRowClick = (match: Match) => {
    if (match.pgn) {
      navigate(`/analyze/${match.id}`);
    }
  };

  if (matches.length === 0) {
    return <div className="empty-state">No matches recorded yet.</div>;
  }

  return (
    <div className="match-list">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">White</th>
            <th scope="col">Result</th>
            <th scope="col">Black</th>
            <th scope="col">Rating Change</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const resultDisplay = getResultDisplay(match.result);
            const whiteChange = getRatingChange(match.white_rating_before, match.white_rating_after);
            const blackChange = getRatingChange(match.black_rating_before, match.black_rating_after);
            const isAnalyzed = analyzedMatchIds?.has(match.id) ?? false;
            const hasPgn = !!match.pgn;

            return (
              <tr
                key={match.id}
                className={hasPgn ? 'clickable' : ''}
                onClick={() => handleRowClick(match)}
              >
                <td className="date">
                  {formatDate(match.played_at)}
                </td>
                <td className="player white">
                  <span className="name">{match.white_player?.name || 'Unknown'}</span>
                  <span className="rating">({Math.round(match.white_rating_before)})</span>
                </td>
                <td className={`result ${resultDisplay.class}`}>{resultDisplay.text}</td>
                <td className="player black">
                  <span className="name">{match.black_player?.name || 'Unknown'}</span>
                  <span className="rating">({Math.round(match.black_rating_before)})</span>
                </td>
                <td className="rating-change">
                  <span className={whiteChange.class} aria-label={`White ${whiteChange.ariaLabel}`}>
                    <span className="change-icon" aria-hidden="true">{whiteChange.class === 'positive' ? '▲' : whiteChange.class === 'negative' ? '▼' : '–'}</span>
                    {whiteChange.text}
                  </span>
                  <span className="separator" aria-hidden="true">/</span>
                  <span className={blackChange.class} aria-label={`Black ${blackChange.ariaLabel}`}>
                    <span className="change-icon" aria-hidden="true">{blackChange.class === 'positive' ? '▲' : blackChange.class === 'negative' ? '▼' : '–'}</span>
                    {blackChange.text}
                  </span>
                </td>
                <td className="actions">
                  {hasPgn && (
                    <>
                      {isAnalyzed && (
                        <span className="analyzed-badge" title="Analyzed">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                      )}
                      <button
                        className="btn-analyze"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/analyze/${match.id}`);
                        }}
                        aria-label={`${isAnalyzed ? 'View analysis' : 'Analyze'} match between ${match.white_player?.name || 'Unknown'} and ${match.black_player?.name || 'Unknown'}`}
                      >
                        {isAnalyzed ? 'View' : 'Analyze'}
                      </button>
                    </>
                  )}
                  <button
                    className="btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this match?')) {
                        onDelete(match.id);
                      }
                    }}
                    aria-label={`Delete match between ${match.white_player?.name || 'Unknown'} and ${match.black_player?.name || 'Unknown'}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
