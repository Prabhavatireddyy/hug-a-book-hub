import { useEffect } from "react";
import confetti from "canvas-confetti";

/**
 * Shoots a cute party-ribbon confetti burst from the top of the screen
 * once on mount. Uses ribbon-like rectangles in our pastel palette.
 */
export function ConfettiBurst() {
  useEffect(() => {
    const colors = ["#f7b69b", "#a8e0c5", "#fde8a4", "#f5b8c2", "#c8b6e3"];

    const fire = (x: number) => {
      confetti({
        particleCount: 60,
        angle: 270,
        spread: 70,
        startVelocity: 45,
        origin: { x, y: -0.1 },
        gravity: 0.9,
        scalar: 1.2,
        ticks: 240,
        shapes: ["square"],
        colors,
      });
    };

    // Three bursts across the top for a "ribbon" feel
    fire(0.2);
    setTimeout(() => fire(0.5), 180);
    setTimeout(() => fire(0.8), 340);
  }, []);

  return null;
}
