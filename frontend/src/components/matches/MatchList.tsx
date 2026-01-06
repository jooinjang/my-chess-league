import { Match } from '../../types';
import './MatchList.css';

interface MatchListProps {
  matches: Match[];
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
  if (change > 0) return { text: `+${change}`, class: 'positive' };
  if (change < 0) return { text: `${change}`, class: 'negative' };
  return { text: '0', class: 'neutral' };
}

export function MatchList({ matches, onDelete }: MatchListProps) {
  if (matches.length === 0) {
    return <div className="empty-state">No matches recorded yet.</div>;
  }

  return (
    <div className="match-list">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>White</th>
            <th>Result</th>
            <th>Black</th>
            <th>Rating Change</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const resultDisplay = getResultDisplay(match.result);
            const whiteChange = getRatingChange(match.white_rating_before, match.white_rating_after);
            const blackChange = getRatingChange(match.black_rating_before, match.black_rating_after);

            return (
              <tr key={match.id}>
                <td className="date">
                  {formatDate(match.played_at)}
                  {!match.rated && <span className="unrated-badge">Unrated</span>}
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
                  <span className={whiteChange.class}>{whiteChange.text}</span>
                  <span className="separator">/</span>
                  <span className={blackChange.class}>{blackChange.text}</span>
                </td>
                <td className="actions">
                  <button
                    className="btn-delete"
                    onClick={() => {
                      if (confirm('Delete this match?')) {
                        onDelete(match.id);
                      }
                    }}
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
