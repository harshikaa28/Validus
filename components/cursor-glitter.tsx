"use client";

import { useEffect, useRef } from "react";

interface Sparkle {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  isStar: boolean;
}

const COLORS = [
  "#f472b6", // soft pink
  "#ec4899", // vibrant pink
  "#ffffff", // pure white sparkle
  "#fbcfe8", // pale pastel pink
  "#fda4af", // rose pink
];

export function CursorGlitter() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 1. Check prefers-reduced-motion
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // 2. Check for touch devices / fine pointer requirement
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!hasFinePointer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Sparkle[] = [];
    let animationFrameId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;

    function addSparkles(x: number, y: number) {
      // Spawn 1 to 2 subtle sparkles per move threshold
      const count = Math.random() > 0.4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        if (particles.length >= 40) {
          particles.shift(); // keep particle count capped
        }
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const size = Math.random() * 2.2 + 1.2; // 1.2px to 3.4px
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.6 + 0.2;

        particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          size,
          color,
          alpha: 0.95,
          decay: Math.random() * 0.035 + 0.03, // fades out in ~300-450ms
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.15, // gentle upward float
          rotation: Math.random() * Math.PI,
          rotationSpeed: (Math.random() - 0.5) * 0.15,
          isStar: Math.random() > 0.4,
        });
      }
    }

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.isStar) {
          // Draw cute 4-point sparkle star
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.6);
          ctx.quadraticCurveTo(0, 0, s * 1.6, 0);
          ctx.quadraticCurveTo(0, 0, 0, s * 1.6);
          ctx.quadraticCurveTo(0, 0, -s * 1.6, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s * 1.6);
          ctx.fill();
        } else {
          // Soft circular glimmer
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // If particles remain, keep loop running. Otherwise stop to save 100% idle CPU
      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        animationFrameId = null;
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Throttling: spawn when cursor moved at least 6px or 35ms passed
      if (dist > 6 || now - lastTime > 35) {
        lastX = e.clientX;
        lastY = e.clientY;
        lastTime = now;
        addSparkles(e.clientX, e.clientY);

        // Start render loop if idle
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full select-none"
      aria-hidden="true"
    />
  );
}
