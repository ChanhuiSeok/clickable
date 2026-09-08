'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  active: boolean;
}

export default function ConfettiEffect({ active }: ConfettiProps) {
  useEffect(() => {
    if (!active) return;

    // Trigger initial celebration explosion
    const duration = 4.5 * 1000;
    const end = Date.now() + duration;

    // Left and right side continuous cannons
    const interval: NodeJS.Timeout = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }

      confetti({
        startVelocity: 35,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random() * 0.4 + 0.1, y: Math.random() * 0.5 },
        colors: ['#38bdf8', '#f43f5e', '#facc15', '#a855f7', '#4ade80'],
      });

      confetti({
        startVelocity: 35,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random() * 0.4 + 0.5, y: Math.random() * 0.5 },
        colors: ['#38bdf8', '#f43f5e', '#facc15', '#a855f7', '#4ade80'],
      });
    }, 350);

    return () => clearInterval(interval);
  }, [active]);

  return null;
}
