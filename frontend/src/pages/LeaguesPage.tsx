import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leagueApi, userApi } from '../api';
import { CreateLeagueRequest, League, LeagueFormat, User } from '../types';
import './LeaguesPage.css';
import '../components/common/ListTable.css';

export function LeaguesPage() {
  const navigate = useNavigate();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [format, setFormat] = useState<LeagueFormat>('swiss');
  const [roundCount, setRoundCount] = useState(5);
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const canCreate = useMemo(() => {
    if (!name.trim()) return false;
    if (selectedUserIds.length < 2) return false;
    if (format === 'swiss' && roundCount <= 0) return false;
    return true;
  }, [name, selectedUserIds, format, roundCount]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ls, us] = await Promise.all([leagueApi.getAll(), userApi.getAll()]);
      setLeagues(ls);
      setUsers(us);
    } catch (e) {
      setError(e instanceof Error ? e.message : '리그 목록을 불러오지 못했습니다');
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
    const payload: CreateLeagueRequest = {
      name: name.trim(),
      format,
      round_count: format === 'swiss' ? roundCount : undefined,
      participant_user_ids: selectedUserIds,
    };
    try {
      const created = await leagueApi.create(payload);
      setShowCreate(false);
      await load();
      navigate(`/leagues/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '리그 생성에 실패했습니다');
    }
  };

  const handleDeleteLeague = async (id: number) => {
    if (!window.confirm('이 리그를 삭제할까요? (대회 기록용 매치 데이터는 삭제하지 않습니다)')) return;
    try {
      await leagueApi.delete(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '리그 삭제에 실패했습니다');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="leagues-page">
      <div className="page-header">
        <h1>League</h1>
        <div className="header-buttons">
          <button className="btn-add" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? '닫기' : '+ 리그 생성'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreate && (
        <div className="league-create">
          <h3>리그 생성</h3>

          <div className="create-top">
            <div className="field">
              <label>이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 2026 겨울 리그" />
              <div className="hint">리그 이름은 목록/상세에서 그대로 표시됩니다.</div>
            </div>

            <div className="field">
              <label>리그 형식</label>
              <div className="format-cards">
                <button
                  type="button"
                  className={`format-card ${format === 'swiss' ? 'selected' : ''}`}
                  onClick={() => setFormat('swiss')}
                >
                  <div className="title">Swiss</div>
                  <div className="desc">
                    점수 기반 페어링으로 라운드를 진행합니다.
                    <br />
                    라운드 수를 미리 정해 운영하기 좋습니다.
                  </div>
                </button>
                <button
                  type="button"
                  className={`format-card ${format === 'round_robin' ? 'selected' : ''}`}
                  onClick={() => setFormat('round_robin')}
                >
                  <div className="title">Round Robin</div>
                  <div className="desc">
                    1회전(단일 리그)으로 모든 참가자와 1번씩 대국합니다.
                    <br />
                    일정이 예측 가능하고 공정한 총당 결과를 얻습니다.
                  </div>
                </button>
              </div>
            </div>

            {format === 'swiss' && (
              <div className="field">
                <label>라운드 수</label>
                <input
                  type="number"
                  min={1}
                  value={roundCount}
                  onChange={(e) => setRoundCount(parseInt(e.target.value || '0', 10))}
                />
                <div className="hint">예: 5라운드 / 7라운드 등</div>
              </div>
            )}
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

      {leagues.length === 0 ? (
        <div className="empty-state">아직 생성된 리그가 없습니다.</div>
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
              {leagues.map(l => (
                <tr key={l.id}>
                  <td>
                    <button type="button" className="row-link" onClick={() => navigate(`/leagues/${l.id}`)}>
                      {l.name}
                    </button>
                  </td>
                  <td>
                    <span className="pill">{l.format}</span>
                    {l.format === 'swiss' && <span className="pill">{l.round_count}R</span>}
                  </td>
                  <td><span className="pill">{l.status}</span></td>
                  <td className="muted">{formatDate(l.created_at)}</td>
                  <td className="actions">
                    <button className="btn-delete" onClick={() => handleDeleteLeague(l.id)}>
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


