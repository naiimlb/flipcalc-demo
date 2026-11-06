import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CoursesLogo } from './Logo';

/** Écran de démarrage : le logo COURSES rebondit puis s'efface. */
export function Splash() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 950);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="halftone fixed inset-0 z-[100] grid place-items-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
          aria-hidden="true"
        >
          <motion.div
            initial={{ scale: 0.82, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 1.08, transition: { duration: 0.35 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 13 }}
          >
            <CoursesLogo size="xl" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
