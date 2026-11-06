import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Splash } from './components/Splash';
import { TabBar, type Tab } from './components/TabBar';
import { ToastHost } from './components/Toast';
import { CoursesScreen } from './screens/CoursesScreen';
import { ImportSheet } from './screens/ImportSheet';
import { ListsScreen } from './screens/ListsScreen';
import { RecapScreen } from './screens/RecapScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useAppState } from './state/store';

interface Recap {
  finishedId: string | null;
  missingId: string | null;
  fresh: boolean;
}

function useTheme() {
  const theme = useAppState((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  useTheme();
  const [tab, setTab] = useState<Tab>('courses');
  const [importOpen, setImportOpen] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const missingCount = useAppState((s) => s.lists.filter((l) => l.kind === 'manquants').length);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      {/* Bande rose sous la barre d'état (notch / Dynamic Island) */}
      <div className="halftone shrink-0" style={{ height: 'var(--safe-top)' }} />
      <main
        ref={mainRef}
        className="scroll-area no-scrollbar relative flex-1"
        style={{ paddingBottom: 'var(--tabbar-h)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            className="min-h-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {tab === 'courses' && (
              <CoursesScreen
                onImport={() => setImportOpen(true)}
                onFinished={(finishedId, missingId) => setRecap({ finishedId, missingId, fresh: true })}
              />
            )}
            {tab === 'listes' && (
              <ListsScreen onOpenCourses={() => setTab('courses')} onOpenMissing={(id) => setRecap({ finishedId: null, missingId: id, fresh: false })} />
            )}
            {tab === 'reglages' && <SettingsScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar tab={tab} onChange={setTab} badge={missingCount || undefined} />

      <ImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCreated={() => {
          setImportOpen(false);
          setTab('courses');
        }}
      />

      <AnimatePresence>
        {recap && (
          <RecapScreen
            key="recap"
            {...recap}
            onClose={() => setRecap(null)}
            onNewList={() => {
              setRecap(null);
              setTab('courses');
            }}
          />
        )}
      </AnimatePresence>

      <ToastHost />
      <Splash />
    </div>
  );
}
