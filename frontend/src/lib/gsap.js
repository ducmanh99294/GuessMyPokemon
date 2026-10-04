// =====================================================
// Central GSAP setup for the app.
//
// Usage:
//   import { gsap, ScrollTrigger, prefersReducedMotion } from "../lib/gsap";
//
// Requires the `gsap` npm package:
//   cd frontend && npm install gsap
// =====================================================

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export { gsap, ScrollTrigger };
