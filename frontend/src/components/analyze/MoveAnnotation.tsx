import { MoveAnnotation as MoveAnnotationType } from '../../types/analysis';
import './MoveAnnotation.css';

interface MoveAnnotationProps {
  annotation: MoveAnnotationType;
  showTooltip?: boolean;
  reason?: string;
}

export function MoveAnnotation({ annotation, showTooltip = false, reason }: MoveAnnotationProps) {
  if (!annotation) return null;

  const getAnnotationClass = () => {
    switch (annotation) {
      case '!!':
        return 'brilliant';
      case '!':
        return 'good';
      case '!?':
        return 'interesting';
      case '?!':
        return 'inaccuracy';
      case '?':
        return 'mistake';
      case '??':
        return 'blunder';
      default:
        return '';
    }
  };

  return (
    <span
      className={`move-annotation ${getAnnotationClass()}`}
      title={showTooltip && reason ? reason : undefined}
    >
      {annotation}
    </span>
  );
}
