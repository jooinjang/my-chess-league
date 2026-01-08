import { useEffect, useState } from 'react';
import { User, Match, CreateMatchRequest } from '../types';
import { userApi, matchApi } from '../api';
import { MatchList, MatchForm, ChesscomImport, ChesscomSync } from '../components/matches';
import { useToast, SkeletonTable } from '../components/common';
import './MatchesPage.css';

export function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showChesscomImport, setShowChesscomImport] = useState(false);
  const [showChesscomSync, setShowChesscomSync] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [matchesData, usersData] = await Promise.all([
        matchApi.getAll(),
        userApi.getAll(),
      ]);
      setMatches(matchesData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async (data: CreateMatchRequest) => {
    try {
      await matchApi.create(data);
      setShowForm(false);
      showToast('Match recorded successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to create match:', error);
      showToast('Failed to record match', 'error');
    }
  };

  const handleDeleteMatch = async (id: number) => {
    try {
      await matchApi.delete(id);
      showToast('Match deleted successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete match:', error);
      showToast('Failed to delete match', 'error');
    }
  };

  const handleChesscomImportComplete = (count?: number) => {
    setShowChesscomImport(false);
    if (count !== undefined && count > 0) {
      showToast(`${count} matches imported successfully`, 'success');
    }
    loadData();
  };

  const handleChesscomSyncComplete = (count?: number) => {
    setShowChesscomSync(false);
    if (count !== undefined && count > 0) {
      showToast(`${count} matches synced successfully`, 'success');
    }
    loadData();
  };

  const handleDeleteAllMatches = async () => {
    if (!window.confirm('Are you sure you want to delete ALL matches? This action cannot be undone. (Ratings WILL be reset to each user\'s initial values)')) {
      return;
    }

    try {
      await matchApi.deleteAll();
      showToast('All matches deleted and ratings reset', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete all matches:', error);
      showToast('Failed to delete matches', 'error');
    }
  };

  // Check if any users have Chess.com username
  const hasChesscomUsers = users.filter(u => u.chesscom_username).length >= 2;

  if (loading) {
    return (
      <div className="matches-page">
        <div className="page-header">
          <h1>Matches</h1>
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div className="matches-page">
      <div className="page-header">
        <h1>Matches</h1>
        {!showForm && !showChesscomImport && !showChesscomSync && (
          <div className="header-buttons">
            {matches.length > 0 && (
              <button
                className="btn-danger"
                onClick={handleDeleteAllMatches}
              >
                Reset All
              </button>
            )}
            {hasChesscomUsers && (
              <>
                <button
                  className="btn-sync"
                  onClick={() => setShowChesscomSync(true)}
                >
                  Import All Matches
                </button>
                <button
                  className="btn-import"
                  onClick={() => setShowChesscomImport(true)}
                >
                  Import from Chess.com
                </button>
              </>
            )}
            <button
              className="btn-add"
              onClick={() => setShowForm(true)}
              disabled={users.length < 2}
            >
              + Record Match
            </button>
          </div>
        )}
      </div>

      {users.length < 2 && (
        <div className="warning">
          At least 2 users are required to record a match.
        </div>
      )}

      {showChesscomImport && (
        <ChesscomImport
          users={users}
          onComplete={handleChesscomImportComplete}
          onCancel={() => setShowChesscomImport(false)}
        />
      )}

      {showChesscomSync && (
        <ChesscomSync
          onComplete={handleChesscomSyncComplete}
          onCancel={() => setShowChesscomSync(false)}
        />
      )}

      {showForm && (
        <MatchForm
          users={users}
          onSubmit={handleCreateMatch}
          onCancel={() => setShowForm(false)}
        />
      )}

      <MatchList matches={matches} onDelete={handleDeleteMatch} />
    </div>
  );
}
