import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { MoveAnalysis } from '../../types/analysis';
import './EvaluationGraph.css';

interface EvaluationGraphProps {
  analysis: MoveAnalysis[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
}

export function EvaluationGraph({ analysis, currentMoveIndex, onMoveClick }: EvaluationGraphProps) {
  if (analysis.length === 0) {
    return (
      <div className="evaluation-graph empty">
        <p>Run analysis to see the evaluation graph</p>
      </div>
    );
  }

  // Add a starting-position point (move 0) to align with chess.com style graphs.
  const first = analysis[0];
  const startEvalWhite = first.color === 'w' ? first.evalBefore : -first.evalBefore;
  const data = [
    {
      move: 0,
      eval: startEvalWhite / 100,
      san: 'start',
      annotation: null as string | null,
      fullEval: startEvalWhite,
      mate: first.mateBeforeWhite,
    },
    ...analysis.map((m, index) => ({
    move: index + 1,
      eval: m.evalAfterWhite / 100,
      san: m.san,
      annotation: m.annotation,
      fullEval: m.evalAfterWhite,
      mate: m.mateAfterWhite,
    })),
  ];

  // Dynamic, symmetric Y domain (in pawns) so the graph stays readable but still shows real shape.
  const maxAbs = Math.max(
    1,
    ...data.map((d) => {
      // If mate, force a visible ceiling.
      if (d.mate !== undefined) return 10;
      return Math.min(10, Math.abs(d.eval));
    })
  );
  const yDomain: [number, number] = [-maxAbs, maxAbs];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { move, san, annotation, fullEval, mate } = payload[0].payload;
      const evalStr = mate !== undefined
        ? (mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`)
        : (fullEval >= 0 ? `+${(fullEval / 100).toFixed(2)}` : (fullEval / 100).toFixed(2));
      return (
        <div className="eval-tooltip">
          <p>{move === 0 ? 'Start' : `Move ${move}: ${san}${annotation || ''}`}</p>
          <p>Eval: {evalStr}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="evaluation-graph">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart
          data={data}
          onClick={(e) => {
            if (e && e.activeTooltipIndex !== undefined && e.activeTooltipIndex !== null) {
              const idx = e.activeTooltipIndex as number;
              // idx 0 is start position (no moves yet)
              onMoveClick(idx === 0 ? -1 : idx - 1);
            }
          }}
        >
          <defs>
            {/* Symmetric domain => 0 line is always at 50% for a y-gradient. */}
            <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0f0f0" stopOpacity={0.78} />
              <stop offset="49.5%" stopColor="#f0f0f0" stopOpacity={0.25} />
              <stop offset="50.5%" stopColor="#333" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#333" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="move"
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#333' }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#333' }}
            ticks={[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((v) =>
              // Avoid -0
              Math.abs(v) < 1e-9 ? 0 : v
            )}
            tickFormatter={(v) => (v > 0 ? `+${v}` : v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          {currentMoveIndex >= -1 && currentMoveIndex < analysis.length && (
            <ReferenceLine x={currentMoveIndex + 1} stroke="#4a9eff" strokeWidth={2} />
          )}
          <Area
            type="monotone"
            dataKey="eval"
            stroke="#888"
            fill="url(#evalGradient)"
            fillOpacity={1}
            baseValue={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
