import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournamentApi, userApi } from '../api';
import { CreateTournamentRequest, Tournament, User } from '../types';
import './TournamentsPage.css';
import '../components/common/ListTable.css';

export function TournamentsPage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const canCreate = useMemo(() => name.trim() && selectedUserIds.length >= 2, [name, selectedUserIds]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ts, us] = await Promise.all([tournamentApi.getAll(), userApi.getAll()]);
      setTournaments(ts);
      setUsers(us);
    } catch (e) {
      setError(e instanceof Error ? e.message : '토너먼트 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleUser = (id: number, checked: boolean) => {
    if (checked) {
      if (selectedUserIds.includes(id)) return;
      setSelectedUserIds([...selectedUserIds, id]);
    } else {
      setSelectedUserIds(selectedUserIds.filter(x => x !== id));
    }
  };

  const removeSelected = (id: number) => {
    setSelectedUserIds(selectedUserIds.filter(x => x !== id));
  };

  const usersById = useMemo(() => {
    const m = new Map<number, User>();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const selectedUsers = useMemo(
    () => selectedUserIds.map(id => usersById.get(id)).filter(Boolean) as User[],
    [selectedUserIds, usersById]
  );

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      const name = (u.name || '').toLowerCase();
      const cc = (u.chesscom_username || '').toLowerCase();
      return name.includes(q) || cc.includes(q);
    });
  }, [users, userQuery]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const reorderSelected = (from: number, to: number) => {
    if (from === to) return;
    const next = [...selectedUserIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSelectedUserIds(next);
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setError('');
    const payload: CreateTournamentRequest = {
      name: name.trim(),
      participant_user_ids: selectedUserIds,
    };
    try {
      const created = await tournamentApi.create(payload);
      setShowCreate(false);
      await load();
      navigate(`/tournaments/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '토너먼트 생성에 실패했습니다');
    }
  };

  const handleDeleteTournament = async (id: number) => {
    if (!window.confirm('이 토너먼트를 삭제할까요? (대회 기록용 매치 데이터는 삭제하지 않습니다)')) return;
    try {
      await tournamentApi.delete(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '토너먼트 삭제에 실패했습니다');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tournaments-page">
      <div className="page-header">
        <h1>Tournament</h1>
        <div className="header-buttons">
          <button className="btn-add" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? '닫기' : '+ 토너먼트 생성'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreate && (
        <div className="tournament-create">
          <h3>토너먼트 생성 (Double Elimination + GF Reset)</h3>
          <div className="create-top">
            <div className="field">
              <label>이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 2026 토너먼트" />
              <div className="hint">Double Elimination + GF Reset 규칙으로 진행됩니다.</div>
            </div>
          </div>

          <div className="create-grid">
            <div className="left">
              <div className="section-title">
                참가자 선택 <span className="count">({selectedUserIds.length}명)</span>
              </div>
              <div className="search">
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="유저 검색 (이름 / Chess.com 아이디)"
                />
              </div>
              <div className="user-list">
                {filteredUsers.map(u => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                  <label key={u.id} className={`user-row ${checked ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleUser(u.id, e.target.checked)}
                    />
                    <span className="name">{u.name}</span>
                    {u.chesscom_username && <span className="sub">@{u.chesscom_username}</span>}
                    <span className="rating">{Math.round(u.rating)}</span>
                  </label>
                )})}
              </div>
            </div>

            <div className="right">
              <div className="selected-panel">
                <div className="panel-title">선택된 참가자</div>
                {selectedUsers.length === 0 ? (
                  <div className="panel-empty">좌측에서 참가자를 선택하세요.</div>
                ) : (
                  <div className="selected-list">
                    {selectedUsers.map((u, idx) => (
                      <div
                        key={u.id}
                        className="selected-item"
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex === null) return;
                          reorderSelected(dragIndex, idx);
                          setDragIndex(null);
                        }}
                      >
                        <div className="info">
                          <div className="n">
                            <span className="seed">{idx + 1}</span>
                            {u.name}
                          </div>
                          <div className="m">
                            {u.chesscom_username ? `@${u.chesscom_username}` : 'Chess.com 미설정'}
                            <span className="dot">·</span>
                            {Math.round(u.rating)}
                          </div>
                        </div>
                        <button type="button" className="remove" onClick={() => removeSelected(u.id)} title="제거">
                          제거
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="panel-actions">
                  <button className="btn-add" onClick={handleCreate} disabled={!canCreate}>
                    생성
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="empty-state">아직 생성된 토너먼트가 없습니다.</div>
      ) : (
        <div className="list-table">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>TYPE</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th className="actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map(t => (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="row-link" onClick={() => navigate(`/tournaments/${t.id}`)}>
                      {t.name}
                    </button>
                  </td>
                  <td><span className="pill">Double Elim</span></td>
                  <td><span className="pill">{t.status}</span></td>
                  <td className="muted">{formatDate(t.created_at)}</td>
                  <td className="actions">
                    <button className="btn-delete" onClick={() => handleDeleteTournament(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
