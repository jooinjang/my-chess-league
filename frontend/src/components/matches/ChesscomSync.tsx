import { useMemo, useState } from 'react';
import { chesscomApi } from '../../api';
import { ChesscomSyncResponse } from '../../types';
import './ChesscomSync.css';

interface ChesscomSyncProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function ChesscomSync({ onComplete, onCancel }: ChesscomSyncProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [recalculate, setRecalculate] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChesscomSyncResponse | null>(null);

  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, []);

  const handleSync = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const data = await chesscomApi.syncMonth({
        year,
        month,
        recalculate,
      });
      setResult(data);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '동기화에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chesscom-sync">
      <h3>Import All Matches (Chess.com)</h3>

      <div className="sync-hint">
        선택한 년/월에 대해 <b>등록된 모든 플레이어 간</b> 대국을 수집하고,
        시간순으로 정렬하여 반영합니다. (옵션에 따라 전체 레이팅을 재계산할 수 있습니다)
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="month">년/월</label>
          <select
            id="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={loading}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="options">
        <label className="toggle">
          <input
            type="checkbox"
            checked={recalculate}
            onChange={(e) => setRecalculate(e.target.checked)}
            disabled={loading}
          />
          <span className="toggle-label">전체 레이팅 재계산</span>
          <span className="toggle-hint">과거 대국이 추가되어도 레이팅 일관성 보장</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
          취소
        </button>
        <button type="button" className="btn-primary" onClick={handleSync} disabled={loading}>
          {loading ? '불러오는 중...' : 'Import All Matches 실행'}
        </button>
      </div>

      {result && (
        <div className="result">
          <div className="result-title">결과</div>
          <div className="result-grid">
            <div className="item">
              <div className="k">대상</div>
              <div className="v">
                {result.year}-{String(result.month).padStart(2, '0')}
              </div>
            </div>
            <div className="item">
              <div className="k">사용자 수</div>
              <div className="v">{result.users_considered}</div>
            </div>
            <div className="item">
              <div className="k">월간 수집(전체)</div>
              <div className="v">{result.total_fetched}</div>
            </div>
            <div className="item">
              <div className="k">리그 내 매치</div>
              <div className="v">{result.total_between_players}</div>
            </div>
            <div className="item">
              <div className="k">이미 반영됨</div>
              <div className="v">{result.already_imported}</div>
            </div>
            <div className="item">
              <div className="k">새로 생성</div>
              <div className="v">{result.created_count}</div>
            </div>
            <div className="item">
              <div className="k">재계산</div>
              <div className="v">{result.recalculate_done ? '완료' : '미실행'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


