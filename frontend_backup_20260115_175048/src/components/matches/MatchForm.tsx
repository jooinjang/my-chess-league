import { useState } from 'react';
import { User, CreateMatchRequest, MatchResult } from '../../types';
import './MatchForm.css';

interface MatchFormProps {
  users: User[];
  onSubmit: (data: CreateMatchRequest) => Promise<void>;
  onCancel: () => void;
}

export function MatchForm({ users, onSubmit, onCancel }: MatchFormProps) {
  const [whitePlayerId, setWhitePlayerId] = useState('');
  const [blackPlayerId, setBlackPlayerId] = useState('');
  const [result, setResult] = useState<MatchResult>('white_win');
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (whitePlayerId === blackPlayerId) {
      setError('White and Black player must be different');
      return;
    }

    setLoading(true);

    try {
      await onSubmit({
        white_player_id: parseInt(whitePlayerId),
        black_player_id: parseInt(blackPlayerId),
        result,
        played_at: new Date(playedAt).toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="match-form" onSubmit={handleSubmit}>
      <h3>Record Match Result</h3>

      {error && <div className="error-message" role="alert" aria-live="polite">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="whitePlayer">White Player *</label>
          <select
            id="whitePlayer"
            value={whitePlayerId}
            onChange={(e) => setWhitePlayerId(e.target.value)}
            required
          >
            <option value="">Select player</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({Math.round(user.rating)})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="blackPlayer">Black Player *</label>
          <select
            id="blackPlayer"
            value={blackPlayerId}
            onChange={(e) => setBlackPlayerId(e.target.value)}
            required
          >
            <option value="">Select player</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({Math.round(user.rating)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Result *</label>
        <div className="result-options">
          <label className={`result-option ${result === 'white_win' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="result"
              value="white_win"
              checked={result === 'white_win'}
              onChange={(e) => setResult(e.target.value as MatchResult)}
            />
            White Win
          </label>
          <label className={`result-option ${result === 'draw' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="result"
              value="draw"
              checked={result === 'draw'}
              onChange={(e) => setResult(e.target.value as MatchResult)}
            />
            Draw
          </label>
          <label className={`result-option ${result === 'black_win' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="result"
              value="black_win"
              checked={result === 'black_win'}
              onChange={(e) => setResult(e.target.value as MatchResult)}
            />
            Black Win
          </label>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="playedAt">Played At *</label>
        <input
          id="playedAt"
          type="datetime-local"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          required
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Recording...' : 'Record Match'}
        </button>
      </div>
    </form>
  );
}
