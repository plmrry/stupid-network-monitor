"use client";

import { useEffect, useRef, useCallback } from "react";
import Matter from "matter-js";

const TEXT_LINES = ["stupid", "network", "monitor"];

function tileCorners(hw: number, hh: number) {
  return [
    { x: -hw, y: -hh },
    { x:  hw, y: -hh },
    { x:  hw, y:  hh },
    { x: -hw, y:  hh },
  ];
}

interface LetterEntry {
  body: Matter.Body;
  char: string;
  constraints: Matter.Constraint[];
  anchors: Matter.Body[];
}

interface Props {
  scrollEl: HTMLDivElement | null;
}

export default function PhysicsText({ scrollEl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef  = useRef<Matter.Render | null>(null);
  const runnerRef  = useRef<Matter.Runner | null>(null);
  const lettersRef = useRef<LetterEntry[]>([]);
  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([]);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = canvas.parentElement?.clientWidth  || 360;
    const H = canvas.parentElement?.clientHeight || 800;

    if (W === 0 || H === 0) {
      const t = setTimeout(() => init(), 50);
      timersRef.current.push(t);
      return;
    }

    // Cleanup previous instance
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (renderRef.current) Matter.Render.stop(renderRef.current);
    if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
    if (engineRef.current) {
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
    }
    lettersRef.current = [];

    const FONT_SIZE = Math.min(Math.floor(W / 6.5), 68);
    const TILE_W    = Math.floor(FONT_SIZE * 0.68);
    const TILE_H    = Math.floor(FONT_SIZE * 0.9);
    const GAP       = Math.max(3, Math.floor(FONT_SIZE * 0.05));
    const HW        = TILE_W / 2;
    const HH        = TILE_H / 2;

    // Target Y positions — stack the 3 lines near the top of the canvas
    const LINE_MARGIN_TOP = Math.round(H * 0.08);
    const LINE_SPACING    = TILE_H + GAP * 2;

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 4.0 } });
    engineRef.current = engine;

    const render = Matter.Render.create({
      canvas,
      engine,
      options: {
        width:  W,
        height: H,
        background: "#000000",
        wireframes: false,
        pixelRatio: window.devicePixelRatio || 1,
      },
    });
    renderRef.current = render;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;

    // Boundary walls
    const WALL_H  = H * 12;
    const WALL_CY = H / 2 - WALL_H * 0.25;
    const wallOpts = {
      isStatic: true,
      render: { fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 0 },
    };
    Matter.World.add(engine.world, [
      Matter.Bodies.rectangle(W / 2,   H + 25,  W + 200, 50,     wallOpts),
      Matter.Bodies.rectangle(-25,     WALL_CY, 50,      WALL_H, wallOpts),
      Matter.Bodies.rectangle(W + 25,  WALL_CY, 50,      WALL_H, wallOpts),
    ]);

    // Build the complete letter batch before adding it to the world.
    const letters: LetterEntry[] = [];
    const letterWorldParts: Array<Matter.Body | Matter.Constraint> = [];

    TEXT_LINES.forEach((line, lineIdx) => {
      const chars     = line.split("");
      const lineWidth = chars.length * TILE_W + (chars.length - 1) * GAP;
      const startX    = Math.round((W - lineWidth) / 2);
      const targetY   = LINE_MARGIN_TOP + lineIdx * LINE_SPACING + HH;

      chars.forEach((char, charIdx) => {
        const targetX      = startX + charIdx * (TILE_W + GAP) + HW;

        const body = Matter.Bodies.rectangle(targetX, targetY, TILE_W, TILE_H, {
          restitution: 0.25,
          friction:    0.6,
          frictionAir: 0.02,
          chamfer:     { radius: 6 },
          render: { fillStyle: "#ffffff", strokeStyle: "#ffffff", lineWidth: 0 },
        });

        const corners = tileCorners(HW, HH);
        const anchors = corners.map(({ x, y }) =>
          Matter.Bodies.circle(targetX + x, targetY + y, 2, {
            isStatic: true,
            collisionFilter: { mask: 0 },
            render: { fillStyle: "transparent", strokeStyle: "transparent", lineWidth: 0 },
          })
        );
        const constraints = corners.map(({ x, y }, i) =>
          Matter.Constraint.create({
            bodyA: body,
            pointA: { x, y },
            bodyB: anchors[i],
            pointB: { x: 0, y: 0 },
            stiffness: 0,
            length: 0,
            damping: 0.1,
            render: { visible: false },
          })
        );

        letterWorldParts.push(...anchors, ...constraints, body);
        letters.push({ body, char, constraints, anchors });
      });
    });

    Matter.World.add(engine.world, letterWorldParts);
    lettersRef.current = letters;

    // afterRender: draw constraints and letter characters.
    Matter.Events.on(render, "afterRender", () => {
      const ctx = render.context;
      ctx.save();

      ctx.strokeStyle = "rgba(168,85,247,0.85)";
      ctx.lineWidth = 1;

      for (const entry of lettersRef.current) {
        if (!entry) continue;
        const { body, constraints, anchors } = entry;
        const corners = tileCorners(TILE_W / 2, TILE_H / 2);
        const cos = Math.cos(body.angle);
        const sin = Math.sin(body.angle);

        for (let i = 0; i < constraints.length; i++) {
          const corner = corners[i];
          const wx = body.position.x + corner.x * cos - corner.y * sin;
          const wy = body.position.y + corner.x * sin + corner.y * cos;
          const anchor = anchors[i].position;

          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(anchor.x, anchor.y);
          ctx.stroke();
        }
      }

      // Letter characters
      ctx.font          = `800 ${Math.round(FONT_SIZE * 0.62)}px 'Geist Mono', ui-monospace, monospace`;
      ctx.textAlign     = "center";
      ctx.textBaseline  = "middle";
      ctx.fillStyle     = "#000000";

      for (const entry of lettersRef.current) {
        if (!entry) continue;
        const { body, char } = entry;
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.fillText(char, 0, 1);
        ctx.restore();
      }

      ctx.restore();
    });

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);
  }, []);

  // Wire up scroll damping.
  useEffect(() => {
    if (!scrollEl) return;

    const onScroll = () => {
      const progress = Math.min(scrollEl.scrollTop / (scrollEl.scrollHeight - scrollEl.clientHeight || 1), 1);
      const engine   = engineRef.current;
      if (!engine) return;

      engine.gravity.y = 4.0 * (1 - progress);

      for (const entry of lettersRef.current) {
        if (!entry) continue;
        const { body } = entry;
        body.frictionAir = 0.02 + progress * 0.25;

        if (progress > 0.9) {
          const ease = (progress - 0.9) / 0.1;
          Matter.Body.setVelocity(body, {
            x: body.velocity.x * (1 - ease * 0.4),
            y: body.velocity.y * (1 - ease * 0.4),
          });
          Matter.Body.setAngularVelocity(body, body.angularVelocity * (1 - ease * 0.4));
          Matter.Body.setAngle(body, body.angle * (1 - ease * 0.3));
        }
      }
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  useEffect(() => {
    init();
    const onResize = () => init();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      timersRef.current.forEach(clearTimeout);
      if (renderRef.current) Matter.Render.stop(renderRef.current);
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        Matter.Engine.clear(engineRef.current);
      }
    };
  }, [init]);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
}
