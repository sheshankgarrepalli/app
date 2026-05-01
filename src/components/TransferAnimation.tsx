import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isActive: boolean;
  onComplete?: () => void;
}

export default function TransferAnimation({ isActive, onComplete }: Props) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.6 } }}
        >
          <motion.div
            className="relative w-80 h-48"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <svg
              viewBox="0 0 400 240"
              className="w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Ground line */}
              <motion.line
                x1="40" y1="200" x2="360" y2="200"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                className="text-zinc-500/40"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4 }}
              />

              {/* Road */}
              <motion.rect
                x="40" y="202" width="320" height="20" rx="3"
                className="fill-zinc-700/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
              />

              {/* Van body */}
              <motion.g
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
              >
                <motion.g
                  animate={{ x: [0, 0, 280] }}
                  transition={{
                    x: { delay: 1.4, duration: 0.8, ease: [0.6, 0, 0.9, 0.5] },
                  }}
                  onAnimationComplete={() => {
                    if (onComplete) setTimeout(onComplete, 200);
                  }}
                >
                  {/* Van shadow */}
                  <ellipse cx="170" cy="208" rx="52" ry="6" className="fill-zinc-900/30" />

                  {/* Van chassis */}
                  <rect x="118" y="154" width="104" height="46" rx="5" className="fill-accent" />

                  {/* Van cabin */}
                  <rect x="118" y="130" width="48" height="48" rx="5" className="fill-accent/80" />

                  {/* Windshield */}
                  <rect
                    x="146" y="138" width="16" height="28" rx="3"
                    className="fill-sky-300/30"
                  />

                  {/* Cargo area */}
                  <rect
                    x="170" y="158" width="48" height="36" rx="3"
                    className="fill-zinc-800/60"
                  />

                  {/* Package inside cargo */}
                  <motion.rect
                    x="182" y="170" width="20" height="16" rx="2"
                    className="fill-amber-400"
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 15 }}
                  />

                  {/* Wheels */}
                  <circle cx="138" cy="200" r="12" className="fill-zinc-800" />
                  <circle cx="138" cy="200" r="5" className="fill-zinc-600" />
                  <circle cx="198" cy="200" r="12" className="fill-zinc-800" />
                  <circle cx="198" cy="200" r="5" className="fill-zinc-600" />

                  {/* Headlight */}
                  <motion.rect
                    x="218" y="166" width="4" height="6" rx="1"
                    className="fill-yellow-300"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: 2, duration: 0.3 }}
                  />
                </motion.g>
              </motion.g>

              {/* Flying package (from top) */}
              <motion.g
                initial={{ y: -40, x: 50, opacity: 0, rotate: -10 }}
                animate={{ y: 30, x: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 250, damping: 15 }}
              >
                <motion.rect
                  x="175" y="100"
                  width="22" height="18" rx="3"
                  className="fill-amber-400"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: 4, duration: 0.35 }}
                />
                <rect
                  x="181" y="100" width="2" height="18" rx="1"
                  className="fill-amber-500/60"
                />
              </motion.g>

              {/* Sparkle particles */}
              {[[0, 0.7], [1, 0.85], [2, 1.0]].map(([i, d]) => (
                <motion.circle
                  key={i}
                  cx={195 + Number(i) * 14}
                  cy={85 + Number(i) * 8}
                  r="2.5"
                  className="fill-amber-300/80"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                  transition={{ delay: d, duration: 0.55 }}
                />
              ))}
            </svg>

            {/* Status text */}
            <motion.p
              className="text-center text-xs font-bold uppercase tracking-widest text-white mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
              >
                Transferring
              </motion.span>
              {' '}
              <motion.span
                className="text-accent"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0, duration: 0.3 }}
              >
                Dispatched
              </motion.span>
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
