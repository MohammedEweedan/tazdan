"use client";

/**
 * Fortuni background shader — raw WebGL port of the mobile splash shader
 * in mobile/src/components/ui/ShaderLines.tsx.
 *
 * Why raw WebGL (not three.js):
 *   • three.js ships ~150 KB gzipped just to draw a single fullscreen quad.
 *     A full-bleed background shader doesn't need a scene graph, geometry
 *     loader, material system, or render targets.
 *   • The mobile splash already does it in ~40 lines of raw GL via expo-gl.
 *     The fragment shader is identical, so the visual matches exactly.
 *
 * Perf budget (matches mobile choices):
 *   • DPR locked to 1.0 — at 2× the lines hash to sub-pixel widths the eye
 *     can't see anyway and you double the fill cost.
 *   • IntersectionObserver pauses the rAF loop the instant the canvas is
 *     fully off-screen (scrolled past hero) — zero GPU when invisible.
 *   • visibilitychange pauses when the tab is hidden (battery-friendly).
 *   • prefers-reduced-motion → render one static frame and stop the loop.
 *
 * Render order on the landing page: the component renders absolutely
 * positioned at inset:0 with pointer-events:none, alpha-clear. The hero
 * markup behind/in front of it is unaffected.
 */

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;

// Fragment shader — verbatim port of the mobile splash shader. Same
// constants, same loop, same `random(uv.x)` per-pixel seed, same
// `lineWidth = 0.004`. The fade-after-18s envelope is web-only and lets
// the shader settle into a quiet background after the first reveal.
const FRAG = `
  precision highp float;
  uniform vec2  resolution;
  uniform float time;

  float random(in float x){ return fract(sin(x) * 1e4); }

  void main(){
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy)
              / min(resolution.x, resolution.y);

    vec2 fMosaicScal = vec2(4.0, 2.0);
    vec2 vScreenSize = vec2(256.0, 256.0);
    uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
    uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

    float t = time * 0.06 + random(uv.x) * 0.4;
    float lineWidth = 0.004;

    vec3 color = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 5; i++) {
        color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 1.0 - length(uv));
      }
    }

    float a = 1.0;
    if (time > 18.0) {
      a = mix(1.0, 0.15, smoothstep(18.0, 24.0, time));
    }
    gl_FragColor = vec4(color[2], color[1], color[0], a);
  }
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (process.env.NODE_ENV !== "production" && !gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.error("[ShaderAnimation] compile error:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function ShaderAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;";
    container.appendChild(canvas);

    // Antialias off — the shader is hand-tuned around aliased fill, not
    // smoothed geometry. preserveDrawingBuffer off — we never read back.
    const gl =
      (canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      // Graceful no-op when WebGL is unavailable — the page still renders.
      return () => {
        if (canvas.parentNode === container) container.removeChild(canvas);
      };
    }

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) {
      if (canvas.parentNode === container) container.removeChild(canvas);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionAttr = gl.getAttribLocation(program, "position");
    const timeLoc = gl.getUniformLocation(program, "time");
    const resLoc = gl.getUniformLocation(program, "resolution");

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttr);
    gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);

    // DPR locked to 1 — the effect is subtle, 2× DPR halves throughput
    // with zero perceptible benefit on this fragment program.
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width  || window.innerWidth));
      const h = Math.max(1, Math.floor(rect.height || window.innerHeight));
      if (canvas.width !== w)  canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resLoc, w, h);
    };
    resize();

    // ── Animation loop with pause-when-offscreen + pause-when-hidden ──
    let rafId: number | null = null;
    let paused = false;
    let time = 1.0;

    // Reduce-motion: render one static frame, never start the loop.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = () => {
      if (paused) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(frame);
      time += 0.05;
      gl.uniform1f(timeLoc, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    if (reduceMotion) {
      gl.uniform1f(timeLoc, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      frame();
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const visible = e.isIntersecting;
          paused = !visible || document.hidden;
          if (!paused && rafId === null && !reduceMotion) frame();
        }
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      paused = document.hidden;
      if (!paused && rafId === null && !reduceMotion) frame();
    };
    document.addEventListener("visibilitychange", onVisibility, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
