import { SVGProps } from "react";
import { cn } from "@/lib/utils";

interface PandaLogoProps extends SVGProps<SVGSVGElement> {
  className?: string;
  animated?: boolean;
}

export function PandaLogo({ className, animated = true, ...props }: PandaLogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "inline-block shrink-0 select-none",
        animated && "group hover:rotate-3 transition-transform duration-300",
        className
      )}
      {...props}
    >
      {/* Left Ear */}
      <circle cx="8" cy="9" r="5" fill="#18181b" />
      <circle cx="8.5" cy="9.5" r="2.5" fill="#ec4899" fillOpacity="0.45" />

      {/* Right Ear */}
      <circle cx="28" cy="9" r="5" fill="#18181b" />
      <circle cx="27.5" cy="9.5" r="2.5" fill="#ec4899" fillOpacity="0.45" />

      {/* Head */}
      <circle
        cx="18"
        cy="20"
        r="13"
        fill="#ffffff"
        stroke="#ec4899"
        strokeWidth="1"
        strokeOpacity="0.3"
      />

      {/* Eye Patches */}
      <ellipse
        cx="12.5"
        cy="18.5"
        rx="3.6"
        ry="4.2"
        transform="rotate(-15 12.5 18.5)"
        fill="#18181b"
      />
      <ellipse
        cx="23.5"
        cy="18.5"
        rx="3.6"
        ry="4.2"
        transform="rotate(15 23.5 18.5)"
        fill="#18181b"
      />

      {/* Eyes & Pupils with Blink Animation */}
      <g className={animated ? "animate-panda-blink origin-[18px_18.5px]" : ""}>
        {/* Left Pupil */}
        <circle cx="12.8" cy="18.5" r="1.6" fill="#ffffff" />
        <circle cx="13.5" cy="17.9" r="0.6" fill="#ec4899" />
        <circle cx="12.3" cy="19.1" r="0.35" fill="#ffffff" />

        {/* Right Pupil */}
        <circle cx="23.2" cy="18.5" r="1.6" fill="#ffffff" />
        <circle cx="23.9" cy="17.9" r="0.6" fill="#ec4899" />
        <circle cx="22.7" cy="19.1" r="0.35" fill="#ffffff" />
      </g>

      {/* Cheeks Blush */}
      <ellipse cx="8.5" cy="22" rx="2.2" ry="1.4" fill="#ec4899" fillOpacity="0.5" />
      <ellipse cx="27.5" cy="22" rx="2.2" ry="1.4" fill="#ec4899" fillOpacity="0.5" />

      {/* Cute Little Nose */}
      <path
        d="M 16.5 20.8 C 16.5 20.5 19.5 20.5 19.5 20.8 C 19.5 21.8 18 22.4 18 22.4 C 18 22.4 16.5 21.8 16.5 20.8 Z"
        fill="#18181b"
      />

      {/* Smiling Mouth */}
      <path
        d="M 16.2 23.3 Q 18 24.5 19.8 23.3"
        fill="none"
        stroke="#18181b"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
