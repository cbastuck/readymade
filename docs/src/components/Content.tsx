import { useEffect, useState } from 'react';
import { marked } from 'marked';
import { fetchMarkdown } from '../lib/api';
import styles from './Content.module.css';

interface Props {
  activePath: string | null;
  onNavigate: (rel: string) => void;
}

export default function Content({ activePath, onNavigate }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activePath) {
      setHtml(null);
      setError(null);
      return;
    }
    setError(null);
    fetchMarkdown(activePath)
      .then((md) => setHtml(marked.parse(md) as string))
      .catch((e) => setError(e.message));
  }, [activePath]);

  // Intercept clicks on .md links inside rendered content
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
    if (!target) return;
    const href = target.getAttribute('href') ?? '';
    if (!href.endsWith('.md') || href.startsWith('http')) return;
    e.preventDefault();
    const base = activePath ? activePath.replace(/[^/]+$/, '') : '';
    const resolved = (base + href).replace(/^\//, '');
    onNavigate(resolved);
  };

  return (
    <main className={styles.main}>
      <article className={styles.article} onClick={handleClick}>
        {error && <div className={styles.error}>Error: {error}</div>}
        {!activePath && !error && (
          <div className={styles.placeholder}>
            <h2>hkp documentation</h2>
            <p>Select a page from the sidebar to get started.</p>
          </div>
        )}
        {html && <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />}
      </article>
    </main>
  );
}
