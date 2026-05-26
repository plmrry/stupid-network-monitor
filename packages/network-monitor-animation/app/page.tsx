"use client";

import { useRef, useEffect, useState } from "react";
import PhysicsText from "./physics-text";

export default function Page() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  // Pass the DOM node to PhysicsText once it exists
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      setScrollEl(scrollRef.current);
    }
  }, []);

  return (
    <main className="bg-black min-h-screen">
      {/* Physics layer — fixed, pointer-events-none */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-sm h-screen outline outline-2 outline-purple-500 pointer-events-none z-10">
        <PhysicsText scrollEl={scrollEl} />
      </div>

      {/* Scrollable ruled layer — same width, fixed, sits above physics */}
      <div
        ref={scrollRef}
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-sm h-screen overflow-y-scroll z-20"
      >
        <div
          className="w-full"
          style={{
            height: "400vh",
            backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "100% 50px",
          }}
        />
      </div>
    </main>
  );
}
