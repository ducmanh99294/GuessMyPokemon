// =====================================================
// useEntrance — staggered pop-in entrance animation.
//
// Attach a ref to the page container, add `data-entrance` to the
// elements you want animated, and call:
//
//   const ref = useRef(null);
//   useEntrance(ref);                    // runs once on mount
//   useEntrance(ref, [screen]);          // re-runs when `screen` changes
//
//   <div ref={ref} className="...">
//       <header data-entrance>...</header>
//       <div data-entrance className="card">...</div>
//   </div>
//
// - Scoped to the ref (never touches elements outside the page).
// - Skipped entirely for prefers-reduced-motion users.
// - Cleans up on unmount / re-run via gsap.context().revert().
// =====================================================

import { useEffect } from "react";
import { gsap, prefersReducedMotion } from "../lib/gsap";

export function useEntrance(ref, deps = []) {
    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion()) return;

        const ctx = gsap.context(() => {
            gsap.from("[data-entrance]", {
                y: 26,
                opacity: 0,
                scale: 0.97,
                duration: 0.55,
                ease: "back.out(1.5)",
                stagger: 0.09,
                clearProps: "transform,opacity",
            });
        }, el);

        return () => ctx.revert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
