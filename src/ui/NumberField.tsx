import { useEffect, useRef, useState } from 'react';
import { sealHistory } from '../store/ops';

interface Props {
  value: number;
  min?: number;
  ariaLabel: string;
  onCommit: (v: number) => void;
}

// R-001: numeric fields bound to live storage must never let the async echo
// clobber keystrokes. While the field is focused the DOM is driven by a local
// draft; external (store) updates sync in only when the user isn't typing.
// Every live-bound numeric input in the app must use this component.
// #36: commits made while typing coalesce into one undo step; blur seals the
// chain. sealHistory is imported here — not delegated to callers — so no
// call site can forget it and silently merge two separate edits.
export function NumberField({ value, min = 0, ariaLabel, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      min={min}
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={(e) => {
        focused.current = false;
        sealHistory(); // the typing burst is over — the next edit is a new undo step
        const raw = e.target.value.trim();
        const n = Number(raw);
        // empty/garbage on leave → resync to the committed value
        setDraft(String(raw === '' || !Number.isFinite(n) ? value : Math.max(min, Math.trunc(n))));
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(Math.max(min, Math.trunc(n)));
      }}
    />
  );
}
