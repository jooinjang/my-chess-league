import './Loading.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className={`spinner spinner-${size} ${className}`} role="status" aria-label="Loading">
      <div className="spinner-circle" />
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <Spinner size="lg" />
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height="0.875rem"
          className="skeleton-line"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <Skeleton height="1.25rem" width="40%" className="skeleton-title" />
      <SkeletonText lines={2} />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }: SkeletonTableProps) {
  return (
    <div className={`skeleton-table ${className}`}>
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="1rem" width="80%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              height="1rem"
              width={colIndex === 0 ? '60%' : '80%'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonRankingProps {
  count?: number;
  className?: string;
}

export function SkeletonRanking({ count = 5, className = '' }: SkeletonRankingProps) {
  return (
    <div className={`skeleton-ranking ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-ranking-item">
          <Skeleton width="2rem" height="1.5rem" borderRadius="var(--radius-sm)" />
          <div className="skeleton-ranking-info">
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="40%" height="0.75rem" />
          </div>
          <Skeleton width="3rem" height="1.25rem" borderRadius="var(--radius-sm)" />
        </div>
      ))}
    </div>
  );
}
