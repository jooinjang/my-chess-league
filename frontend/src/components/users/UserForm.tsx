import { useState, useEffect } from 'react';
import { User, CreateUserRequest, UpdateUserRequest } from '../../types';
import { chesscomApi } from '../../api';
import './UserForm.css';

const RATING_OPTIONS = [
  {
    id: 'newbie',
    rating: 400,
    label: '뉴비',
    description: '체스의 규칙과 기물의 행마법을 이제 막 익힌 단계',
  },
  {
    id: 'beginner',
    rating: 600,
    label: '초심자',
    description: '체스를 조금 알고 있지만, 오프닝이나 전술 등은 잘 모릅니다',
  },
  {
    id: 'intermediate',
    rating: 800,
    label: '중급자',
    description: '몇 가지 주력 오프닝에 대해 알고 있으며, 전술의 개념에 대해서는 이해하고 있습니다',
  },
  {
    id: 'advanced',
    rating: 1000,
    label: '상급자',
    description: '흔히 등장하는 오프닝에 대한 이론수들을 알고 있으며, 전술에 따라 게임을 진행할 수 있습니다',
  },
];

interface UserFormProps {
  user?: User;
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
  onCancel: () => void;
}

export function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const isEditMode = !!user;

  const [name, setName] = useState('');
  const [selectedRating, setSelectedRating] = useState('beginner');
  const [memo, setMemo] = useState('');
  const [chesscomUsername, setChesscomUsername] = useState('');
  const [chesscomValidated, setChesscomValidated] = useState<boolean | null>(null);
  const [chesscomValidating, setChesscomValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setMemo(user.memo || '');
      setChesscomUsername(user.chesscom_username || '');
      if (user.chesscom_username) {
        setChesscomValidated(true);
      }
    }
  }, [user]);

  const validateChesscomUsername = async () => {
    if (!chesscomUsername.trim()) {
      setChesscomValidated(null);
      return;
    }

    setChesscomValidating(true);
    setChesscomValidated(null);

    try {
      await chesscomApi.validateUsername(chesscomUsername.trim());
      setChesscomValidated(true);
    } catch {
      setChesscomValidated(false);
    } finally {
      setChesscomValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate Chess.com username if provided
    if (chesscomUsername.trim() && chesscomValidated === false) {
      setError('Please enter a valid Chess.com username');
      return;
    }

    if (chesscomUsername.trim() && chesscomValidated === null) {
      setError('Please validate the Chess.com username first');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        await onSubmit({
          name: name.trim(),
          memo: memo.trim() || undefined,
          chesscom_username: chesscomUsername.trim() || undefined,
        } as UpdateUserRequest);
      } else {
        const ratingOption = RATING_OPTIONS.find(opt => opt.id === selectedRating);
        await onSubmit({
          name: name.trim(),
          rating: ratingOption?.rating ?? 600,
          memo: memo.trim() || undefined,
          chesscom_username: chesscomUsername.trim() || undefined,
        } as CreateUserRequest);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="user-form" onSubmit={handleSubmit}>
      <h3>{isEditMode ? 'Edit User' : 'Add New User'}</h3>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Enter name"
        />
      </div>

      {!isEditMode && (
        <div className="form-group">
          <label>Initial Rating *</label>
          <div className="rating-cards">
            {RATING_OPTIONS.map((option) => (
              <div
                key={option.id}
                className={`rating-card ${selectedRating === option.id ? 'selected' : ''}`}
                onClick={() => setSelectedRating(option.id)}
              >
                <div className="rating-card-header">
                  <span className="rating-card-label">{option.label}</span>
                  <span className="rating-card-value">{option.rating}</span>
                </div>
                <p className="rating-card-description">{option.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isEditMode && (
        <div className="form-group">
          <label>Current Rating</label>
          <div className="rating-display">{Math.round(user!.rating)}</div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="chesscomUsername">Chess.com Username</label>
        <div className="chesscom-input-group">
          <input
            id="chesscomUsername"
            type="text"
            value={chesscomUsername}
            onChange={(e) => {
              setChesscomUsername(e.target.value);
              setChesscomValidated(null);
            }}
            placeholder="e.g., hikaru"
          />
          <button
            type="button"
            className="btn-validate"
            onClick={validateChesscomUsername}
            disabled={chesscomValidating || !chesscomUsername.trim()}
          >
            {chesscomValidating ? 'Checking...' : 'Validate'}
          </button>
        </div>
        {chesscomValidated === true && (
          <span className="validation-status valid">Valid Chess.com user</span>
        )}
        {chesscomValidated === false && (
          <span className="validation-status invalid">User not found on Chess.com</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="memo">Memo</label>
        <textarea
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Optional notes"
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create User')}
        </button>
      </div>
    </form>
  );
}
