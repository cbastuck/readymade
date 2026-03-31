import { FileEntry } from '../lib/api';
import styles from './Sidebar.module.css';

interface Props {
  files: FileEntry[];
  activePath: string | null;
  onNavigate: (rel: string) => void;
}

function label(name: string): string {
  return name.replace(/\.md$/, '').replace(/-/g, ' ');
}

function Tree({
  nodes,
  activePath,
  onNavigate,
}: {
  nodes: FileEntry[];
  activePath: string | null;
  onNavigate: (rel: string) => void;
}) {
  return (
    <ul className={styles.list}>
      {nodes.map((node) =>
        node.type === 'dir' ? (
          <li key={node.rel}>
            <div className={styles.dirLabel}>{label(node.name)}</div>
            <Tree nodes={node.children ?? []} activePath={activePath} onNavigate={onNavigate} />
          </li>
        ) : (
          <li key={node.rel}>
            <a
              href={'/' + node.rel}
              className={`${styles.link} ${activePath === node.rel ? styles.active : ''}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(node.rel);
              }}
            >
              {label(node.name)}
            </a>
          </li>
        )
      )}
    </ul>
  );
}

export default function Sidebar({ files, activePath, onNavigate }: Props) {
  return (
    <nav className={styles.nav}>
      <h1 className={styles.title}>hkp docs</h1>
      <Tree nodes={files} activePath={activePath} onNavigate={onNavigate} />
    </nav>
  );
}
