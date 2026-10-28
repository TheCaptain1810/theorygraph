const IMAGE_BASE = 'https://image.tmdb.org/t/p';
// Same shape the server enforces before storing a poster path; checked again before building a URL.
const POSTER_RE = /^\/[A-Za-z0-9_-]{1,100}\.(?:jpg|jpeg|png|webp)$/;

const SIZES = {
  thumb: { width: 92, className: 'w-12' },
  large: { width: 185, className: 'w-32 sm:w-40' },
} as const;

/** TMDB poster, or nothing. Posters are provider artwork (design rule 8: no unlicensed stills). */
export function Poster({
  path,
  title,
  size = 'thumb',
}: {
  path: string | null;
  title: string;
  size?: keyof typeof SIZES;
}) {
  if (!path || !POSTER_RE.test(path)) return null;
  const s = SIZES[size];
  return (
    <img
      src={`${IMAGE_BASE}/w${s.width}${path}`}
      srcSet={`${IMAGE_BASE}/w${s.width}${path} 1x, ${IMAGE_BASE}/w${s.width * 2}${path} 2x`}
      alt={`Poster of ${title}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`${s.className} aspect-[2/3] shrink-0 rounded border border-border bg-surface object-cover`}
    />
  );
}
