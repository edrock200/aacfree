import { useEffect, useState } from 'react';
import { assetURL } from '../lib/db';

const BASE = import.meta.env.BASE_URL;

export function symbolSrc(ref?: string): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('a:')) return `${BASE}symbols/${ref.slice(2)}.webp`;
  return undefined;
}

/** Renders a symbol reference (ARASAAC id, emoji, or user image asset). */
export function Symbol({ value, className, alt = '' }: { value?: string; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | undefined>(() => symbolSrc(value));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!value) return setUrl(undefined);
    if (value.startsWith('img:')) {
      let alive = true;
      assetURL(value.slice(4)).then((u) => alive && setUrl(u));
      return () => { alive = false; };
    }
    setUrl(symbolSrc(value));
  }, [value]);

  if (!value) return null;
  if (value.startsWith('e:')) {
    return <span className={`sym sym-emoji ${className ?? ''}`} aria-hidden>{value.slice(2)}</span>;
  }
  if (!url) return null;
  return (
    <img
      className={`sym ${className ?? ''}`}
      src={failed && value.startsWith('a:') ? `https://static.arasaac.org/pictograms/${value.slice(2)}/${value.slice(2)}_300.png` : url}
      alt={alt}
      draggable={false}
      loading="lazy"
      onError={() => !failed && setFailed(true)}
    />
  );
}
