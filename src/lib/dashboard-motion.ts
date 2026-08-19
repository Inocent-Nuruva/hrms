"use client"

import { useReducedMotion, type Transition, type Variants } from "framer-motion"

export const dashboardEase: Transition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
}

export const dashboardSpring: Transition = {
  type: "spring",
  stiffness: 360,
  damping: 30,
  mass: 0.72,
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
}

export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.032, delayChildren: 0.02 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: dashboardSpring },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28 } },
}

export const riseSoft: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: dashboardEase,
  },
}

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: dashboardEase },
}

export const metricStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
}

export const metricCardEnter: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    scale: 0.94,
    filter: "blur(8px)",
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
      mass: 0.78,
    },
  },
}

export const clipCircleReveal: Variants = {
  hidden: { clipPath: "circle(0% at 78% 18%)", opacity: 0 },
  show: {
    clipPath: "circle(58% at 88% -4%)",
    opacity: 1,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
}

export const reducedMotionVariants: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
}

export function useDashboardMotion() {
  const reduce = useReducedMotion()
  return {
    reduce: Boolean(reduce),
    container: reduce ? reducedMotionVariants : staggerContainer,
    fast: reduce ? reducedMotionVariants : staggerFast,
    item: reduce ? reducedMotionVariants : fadeUp,
    rise: reduce ? reducedMotionVariants : riseSoft,
    page: reduce ? reducedMotionVariants : pageEnter,
    metrics: reduce ? reducedMotionVariants : metricStagger,
    metricCard: reduce ? reducedMotionVariants : metricCardEnter,
    clipReveal: reduce ? reducedMotionVariants : clipCircleReveal,
    hover: reduce
      ? undefined
      : { y: -6, scale: 1.018, transition: { type: "spring", stiffness: 420, damping: 28 } },
    tap: reduce ? undefined : { scale: 0.985 },
  }
}
