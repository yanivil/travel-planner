import { useEffect, useRef, useState } from 'react';

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
