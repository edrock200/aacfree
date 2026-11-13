import { useEffect, useState } from 'react';
import { assetURL } from '../lib/db';
import { useStore } from '../store';

const BASE = import.meta.env.BASE_URL;

export function symbolSrc(ref?: string): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('a:')) return `${BASE}symbols/${ref.slice(2)}.webp`;
  return undefined;
}

const arasaacURL = (id: string) => `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;

/** Renders a symbol reference (ARASAAC id, emoji, or user image asset). */
export function Symbol({ value, className, alt = '', lazy }: { value?: string; className?: string; alt?: string; lazy?: boolean }) {
  const [url, setUrl] = useState<string | undefined>(() => symbolSrc(value));
  const [failed, setFailed] = useState(false);
  // A bundled pictogram that is missing (e.g. from an imported OBF board) can be fetched from
  // arasaac.org, unless the family turned that off (Settings → Lock).
  const online = useStore((s) => (s.data.profiles.find((p) => p.id === s.data.activeProfileId) ?? s.data.profiles[0])?.settings.downloadSymbols !== false);

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
  if (failed && (!online || !value.startsWith('a:'))) return <span className={`sym sym-missing ${className ?? ''}`} aria-hidden />;
  return (
    <img
      className={`sym ${className ?? ''}`}
      src={failed ? arasaacURL(value.slice(2)) : url}
      alt={alt}
      draggable={false}
      loading={lazy ? 'lazy' : 'eager'}
      onError={() => !failed && setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
}
