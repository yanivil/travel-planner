import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { dispatch } from '../store/ops';
import { formatRange, formatHM, parseHM } from '../domain/time';
import { wazeUrl } from '../domain/waze';
import { NumberField } from './NumberField';
import type { ScheduledStop } from '../domain/schedule';
import type { Stop } from '../domain/types';

interface Props {
  stop: Stop;
  scheduled: ScheduledStop;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function StopRow({ stop, scheduled, isFirst, isLast, onMoveUp, onMoveDown }: Props) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stop.id });

  const updateStop = (patch: Partial<Stop>, prev: Partial<Stop>) =>
    void dispatch({ t: 'stop/update', id: stop.id, patch, prev });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="stop-item-wrap"
    >
      <div className="stop-item">
        <div className="stop-times">
          {stop.anchorStartMin != null && <span aria-hidden="true">📌 </span>}
          {formatRange(scheduled.startMin, scheduled.endMin)}
        </div>
        <div className={`stop-card kind-${stop.kind}`}>
          <div className="row">
            <input
              className="stop-name"
              aria-label={t('stopName')}
              defaultValue={stop.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== stop.name) updateStop({ name }, { name: stop.name });
              }}
            />
          </div>
          {(scheduled.slackBeforeMin > 0 || scheduled.lateByMin > 0) && (
            <div className="chips-row">
              {scheduled.slackBeforeMin > 0 && (
                <span className="chip slack">⏱ {t('slackWait', { m: scheduled.slackBeforeMin })}</span>
              )}
              {scheduled.lateByMin > 0 && (
                <span className="chip bad">⚠ {t('lateBy', { m: scheduled.lateByMin })}</span>
              )}
            </div>
          )}
          <div className="stop-fields">
            <label>
              {t('durationMin')}
              <NumberField
                value={stop.durationMin}
                ariaLabel={`${t('durationMin')} — ${stop.name}`}
                onCommit={(v) => updateStop({ durationMin: v }, { durationMin: stop.durationMin })}
              />
            </label>
            {!isLast && (
              <label>
                {t('legMin')}
                <NumberField
                  value={stop.legAfterMin ?? 0}
                  ariaLabel={`${t('legMin')} — ${stop.name}`}
                  onCommit={(v) =>
                    updateStop({ legAfterMin: v > 0 ? v : null }, { legAfterMin: stop.legAfterMin })
                  }
                />
              </label>
            )}
            {stop.anchorStartMin != null && (
              <label>
                {t('anchorTime')}
                <input
                  type="time"
                  aria-label={`${t('anchorTime')} — ${stop.name}`}
                  value={formatHM(stop.anchorStartMin)}
                  onChange={(e) => {
                    const parsed = parseHM(e.target.value);
                    if (parsed != null)
                      updateStop({ anchorStartMin: parsed }, { anchorStartMin: stop.anchorStartMin });
                  }}
                />
              </label>
            )}
            <div className="stop-actions">
              <button
                type="button"
                className="btn-ghost pin-btn"
                aria-label={`${t('anchor')}: ${stop.name}`}
                aria-pressed={stop.anchorStartMin != null}
                onClick={() =>
                  updateStop(
                    { anchorStartMin: stop.anchorStartMin != null ? null : scheduled.startMin },
                    { anchorStartMin: stop.anchorStartMin },
                  )
                }
              >
                📌
              </button>
              <button
                type="button"
                className="btn-ghost"
                aria-label={`${t('moveUp')}: ${stop.name}`}
                disabled={isFirst}
                onClick={onMoveUp}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-ghost"
                aria-label={`${t('moveDown')}: ${stop.name}`}
                disabled={isLast}
                onClick={onMoveDown}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-ghost"
                aria-label={`${t('delete')}: ${stop.name}`}
                onClick={() => void dispatch({ t: 'stop/remove', stop })}
              >
                ✕
              </button>
              <button
                type="button"
                className="btn-ghost"
                aria-label={`${t('reorder')}: ${stop.name}`}
                {...attributes}
                {...listeners}
              >
                ⠿
              </button>
            </div>
          </div>
        </div>
      </div>
      {!isLast && scheduled.legAfterMin != null && (
        <div className="stop-item">
          <div />
          <div className="leg-row">
            <span>
              🚗 {scheduled.legAfterMin} {t('min')} · {formatHM(scheduled.nextArriveMin ?? 0)}
            </span>
            {stop.wazeQuery && (
              <a href={wazeUrl(stop.wazeQuery)} target="_blank" rel="noreferrer">
                Waze ↗
              </a>
            )}
          </div>
        </div>
      )}
      {isLast && stop.wazeQuery && (
        <div className="stop-item">
          <div />
          <div className="leg-row">
            <a href={wazeUrl(stop.wazeQuery)} target="_blank" rel="noreferrer">
              Waze ↗
            </a>
          </div>
        </div>
      )}
    </li>
  );
}
