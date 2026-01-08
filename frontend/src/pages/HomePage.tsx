import { useEffect, useState } from 'react';
import { User, Match } from '../types';
import { userApi, matchApi } from '../api';
import './HomePage.css';

interface UserStats {
  wins: number;
  draws: number;
  losses: number;
  lastRatingChange: number | null;
}

function calculateUserStats(userId: number, matches: Match[]): UserStats {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let lastRatingChange: number | null = null;

  // Find all matches for this user
  const userMatches = matches.filter(
    (m) => m.white_player_id === userId || m.black_player_id === userId
  );

  for (const match of userMatches) {
    const isWhite = match.white_player_id === userId;

    if (match.result === 'draw') {
      draws++;
    } else if (
      (isWhite && match.result === 'white_win') ||
      (!isWhite && match.result === 'black_win')
    ) {
      wins++;
    } else {
      losses++;
    }
  }

  // Get last match rating change (matches are sorted by played_at DESC)
  if (userMatches.length > 0) {
    const lastMatch = userMatches[0];
    const isWhite = lastMatch.white_player_id === userId;
    if (isWhite) {
      lastRatingChange = Math.round(lastMatch.white_rating_after - lastMatch.white_rating_before);
    } else {
      lastRatingChange = Math.round(lastMatch.black_rating_after - lastMatch.black_rating_before);
    }
  }

  return { wins, draws, losses, lastRatingChange };
}

function calculateWinStreak(userId: number, matches: Match[]): number {
  // matches are sorted by played_at DESC
  const userMatches = matches.filter(
    (m) => m.white_player_id === userId || m.black_player_id === userId
  );

  let streak = 0;
  for (const match of userMatches) {
    if (match.result === 'draw') break;

    const isWhite = match.white_player_id === userId;
    const isWin =
      (isWhite && match.result === 'white_win') ||
      (!isWhite && match.result === 'black_win');

    if (!isWin) break;
    streak++;
  }
  return streak;
}

export function HomePage() {
  const [rankings, setRankings] = useState<User[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rankingsData, matchesData] = await Promise.all([
        userApi.getRankings(),
        matchApi.getAll(),
      ]);
      setRankings(rankingsData.slice(0, 10));
      setAllMatches(matchesData);
      setRecentMatches(matchesData.slice(0, 5));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="home-page">
      <h1>Dashboard</h1>

      <div className="dashboard-grid">
        <section className="rankings-section">
          <h2>Top Rankings</h2>
          {rankings.length === 0 ? (
            <p className="empty">No users registered yet.</p>
          ) : (
            <div className="rankings-list">
              {rankings.map((user, index) => {
                const stats = calculateUserStats(user.id, allMatches);
                const streak = calculateWinStreak(user.id, allMatches);
                return (
                  <div key={user.id} className="ranking-item">
                    <span className="rank">#{index + 1}</span>
                    <div className="player-info">
                      <div className="player-main">
                        <span className="name">{user.name}</span>
                        {streak >= 2 && (
                          <span className="streak" title={`연승 ${streak}`}>
                            <svg
                              className="streak-icon"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                fill="currentColor"
                                d="M13.5 2.1c.2 2.6-.9 4.2-2.2 5.7-1.2 1.5-2.5 2.9-2.5 5.2 0 2.8 2.1 4.9 4.9 4.9 2.7 0 4.8-2.1 4.8-4.9 0-2.2-1.1-3.6-2.1-4.9-.9-1.1-1.7-2.2-1.9-4zM12 22c-4.4 0-8-3.6-8-8 0-3.3 1.9-5.4 3.4-7.1C9 5.1 10.1 3.8 10.1 2h1.8c0 2.6-1.2 4.2-2.6 5.8C7.9 9.5 6 11.2 6 14c0 3.3 2.7 6 6 6s6-2.7 6-6c0-2.6-1.3-4.1-2.4-5.5-.9-1.1-1.7-2.2-1.9-3.8h1.8c.2 1 .8 1.8 1.6 2.9 1.3 1.6 2.9 3.6 2.9 6.4 0 4.4-3.6 8-8 8z"
                              />
                            </svg>
                            <span className="streak-num">{streak}</span>
                          </span>
                        )}
                        <span className="record">
                          ({stats.wins}/{stats.draws}/{stats.losses})
                        </span>
                        {stats.lastRatingChange !== null && (
                          <span
                            className={`rating-change ${
                              stats.lastRatingChange > 0
                                ? 'positive'
                                : stats.lastRatingChange < 0
                                ? 'negative'
                                : 'neutral'
                            }`}
                          >
                            {stats.lastRatingChange > 0 ? '+' : ''}
                            {stats.lastRatingChange}
                          </span>
                        )}
                      </div>
                      {user.memo && <div className="player-memo">{user.memo}</div>}
                    </div>
                    <span className="rating">{Math.round(user.rating)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="matches-section">
          <h2>Recent Matches</h2>
          {recentMatches.length === 0 ? (
            <p className="empty">No matches recorded yet.</p>
          ) : (
            <div className="matches-list">
              {recentMatches.map((match) => (
                <div key={match.id} className="match-item">
                  <div className="players">
                    <span className={match.result === 'white_win' ? 'winner' : ''}>
                      {match.white_player?.name}
                    </span>
                    <span className="vs">vs</span>
                    <span className={match.result === 'black_win' ? 'winner' : ''}>
                      {match.black_player?.name}
                    </span>
                  </div>
                  <span className="result">
                    {match.result === 'white_win' ? '1-0' : match.result === 'black_win' ? '0-1' : '½-½'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
