import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dispatch } from '../store/ops';
import type { Conflict } from '../domain/conflicts';

interface Props {
  tripId: string;
  active: Conflict[];
  acknowledged: Conflict[];
  /** ids currently stored as dismissals (needed to restore/re-raise). */
  dismissedIds: Map<string, { severity: 'hard' | 'soft' }>;
}

// The conflicts drawer (spec §4.2). Hard conflicts cannot be acknowledged —
// the plan is infeasible; soft ones can (D-020), and the acknowledgement is an
// op, so it is undoable and it cascades away with the trip.
export function ConflictsPanel({ tripId, active, acknowledged, dismissedIds }: Props) {
  const { t } = useTranslation();
  const [showAcked, setShowAcked] = useState(false);

  const message = (c: Conflict) => {
    const params = { ...c.messageParams };
    if (c.rule === 'CLOSED_DAY') params.d = t(`wd${params.d}`);
    return t(c.messageKey, params);
  };

  const acknowledge = (c: Conflict) =>
    void dispatch({
      t: 'dismissal/add',
      dismissal: { id: c.id, tripId, severity: c.severity, createdAt: new Date().toISOString() },
    });

  const restore = (c: Conflict) => {
    const rec = dismissedIds.get(c.id);
    if (!rec) return;
    void dispatch({
      t: 'dismissal/remove',
      dismissal: { id: c.id, tripId, severity: rec.severity, createdAt: '' },
    });
  };

  return (
    <section className="conflicts" aria-label={t('conflictsTitle')}>
      <h3 className="conflicts-title">{t('conflictsTitle')}</h3>
      {active.length === 0 && <p className="muted ok-line">✓ {t('noConflicts')}</p>}
      <ul className="conflict-list">
        {active.map((c) => (
          <li key={c.id} className={`card conflict-card sev-${c.severity}`}>
            <span className={`pill ${c.severity}`}>{c.severity === 'hard' ? '✕' : '⚠'}</span>
            <span className="conflict-msg">{message(c)}</span>
            {c.severity === 'soft' && (
              <button type="button" className="btn-ghost" onClick={() => acknowledge(c)}>
                {t('acknowledge')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {acknowledged.length > 0 && (
        <div className="acked">
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={showAcked}
            onClick={() => setShowAcked((v) => !v)}
          >
            {t('acknowledgedTitle')} ({acknowledged.length})
          </button>
          {showAcked && (
            <ul className="conflict-list">
              {acknowledged.map((c) => (
                <li key={c.id} className="card conflict-card acked-card">
                  <span className="conflict-msg muted">{message(c)}</span>
                  <button type="button" className="btn-ghost" onClick={() => restore(c)}>
                    {t('reraise')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
