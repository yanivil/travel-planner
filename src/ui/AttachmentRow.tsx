import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dispatch } from '../store/ops';
import type { Attachment } from '../domain/types';

// One wallet item (D-028). Images render a small thumbnail straight from the
// stored Blob — the entrance-gate moment must work with zero bars.
export function AttachmentRow({ att }: { att: Attachment }) {
  const { t } = useTranslation();
  const url = useMemo(
    () => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(att.data) : null),
    [att.data],
  );
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const isImage = att.mimeType.startsWith('image/');

  return (
    <span className="att-row">
      {isImage && url && <img className="att-thumb" src={url} alt={att.name} />}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {att.name}
        </a>
      ) : (
        <span>{att.name}</span>
      )}
      <button
        type="button"
        className="btn-ghost clear-btn"
        aria-label={`${t('delete')}: ${att.name}`}
        onClick={() => void dispatch({ t: 'attachment/remove', attachment: att })}
      >
        ✕
      </button>
    </span>
  );
}
