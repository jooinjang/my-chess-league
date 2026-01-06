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
                return (
                  <div key={user.id} className="ranking-item">
                    <span className="rank">#{index + 1}</span>
                    <div className="player-info">
                      <div className="player-main">
                        <span className="name">{user.name}</span>
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
