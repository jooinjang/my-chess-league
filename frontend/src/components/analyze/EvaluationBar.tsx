import { formatEvaluation, getEvalBarPercentage } from '../../utils/analysisUtils';
import './EvaluationBar.css';

interface EvaluationBarProps {
  score: number;
  mate?: number;
  height?: number;
}

export function EvaluationBar({ score, mate, height = 400 }: EvaluationBarProps) {
  const percentage = getEvalBarPercentage(score, mate);
  const whiteHeight = percentage;
  const evalText = formatEvaluation(score, mate);

  return (
    <div className="evaluation-bar" style={{ height }}>
      <div className="eval-text top">{score >= 0 || mate !== undefined && mate > 0 ? evalText : ''}</div>
      <div className="bar-container">
        <div className="bar-black" style={{ height: `${100 - whiteHeight}%` }} />
        <div className="bar-white" style={{ height: `${whiteHeight}%` }} />
      </div>
      <div className="eval-text bottom">{score < 0 || mate !== undefined && mate < 0 ? evalText : ''}</div>
    </div>
  );
}
