import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Content from './components/Content';
import { fetchFiles, FileEntry } from './lib/api';
import styles from './App.module.css';

export default function App() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles().then(setFiles).catch(console.error);
  }, []);

  // Sync active path from browser URL on first load and on popstate
  useEffect(() => {
    const syncFromUrl = () => {
      const rel = window.location.pathname.replace(/^\//, '');
      setActivePath(rel.endsWith('.md') ? rel : null);
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const navigate = (rel: string) => {
    window.history.pushState({}, '', '/' + rel);
    setActivePath(rel);
  };

  return (
    <div className={styles.layout}>
      <Sidebar files={files} activePath={activePath} onNavigate={navigate} />
      <Content activePath={activePath} onNavigate={navigate} />
    </div>
  );
}
