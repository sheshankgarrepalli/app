import { Variants, Transition } from 'framer-motion';

export const spring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const smooth: Transition = {
  type: 'tween',
  duration: 0.22,
  ease: [0.25, 0.1, 0.25, 1],
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: smooth },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
};

export const hoverLift: Variants = {
  rest: { y: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  hover: {
    y: -2,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    transition: spring,
  },
  tap: { scale: 0.985, transition: { duration: 0.1 } },
};

export const stagger = (delay = 0.05): Variants => ({
  visible: {
    transition: {
      staggerChildren: delay,
    },
  },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.15 } },
};

export const buttonPress: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.15 } },
  tap: { scale: 0.97, transition: { duration: 0.08 } },
};
