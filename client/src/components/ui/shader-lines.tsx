"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export function ShaderAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer | null
    animationId: number | null
    paused: boolean
    uniforms: { time: { value: number }; resolution: { value: THREE.Vector2 } } | null
    scene: THREE.Scene | null
    camera: THREE.Camera | null
  }>({
    renderer: null, animationId: null, paused: false,
    uniforms: null, scene: null, camera: null,
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const camera = new THREE.Camera()
    camera.position.z = 1
    const scene  = new THREE.Scene()
    const geo    = new THREE.PlaneGeometry(2, 2)
    const uniforms = {
      time:       { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    }

    /* ─────────────────────────────────────────────────────────────────
       Full-width radial scan-line shader.

       Key design decisions vs. the old version:
       · Vignette is vertical-only (uv.y only) so the effect runs
         edge-to-edge horizontally on any aspect ratio — no "circle".
       · DPR locked to 1 — the effect is subtle; 2× DPR halves
         throughput with zero perceptible benefit.
       · Loop body pre-computes `r = length(uv)` once, not per
         iteration — saves 5 redundant sqrts per pixel.
       · `mediump` for the brightness accumulator is fine on mobile.
       · transparent = true with setClearColor(0,0) → only the bright
         lines are opaque; background is fully see-through in both
         light and dark modes (normal blend, no mixBlendMode hack).
    ───────────────────────────────────────────────────────────────── */
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      vertexShader: `void main(){gl_Position=vec4(position,1.0);}`,
      fragmentShader: `
        precision highp float;
        uniform vec2  resolution;
        uniform float time;

        float rand(float x){ return fract(sin(x)*1e4); }

        void main(){
          /* normalise by short-side so aspect ratio never distorts rings */
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy)
                    / min(resolution.x, resolution.y);

          /* subtle pixel-grid character */
          const vec2 GRID   = vec2(5.0, 2.5);
          const vec2 SCREEN = vec2(280.0, 280.0);
          uv.x = floor(uv.x * SCREEN.x / GRID.x) / (SCREEN.x / GRID.x);
          uv.y = floor(uv.y * SCREEN.y / GRID.y) / (SCREEN.y / GRID.y);

          /* pre-compute once — used in every iteration */
          float r = length(uv);
          float t = time * 0.042 + rand(uv.x) * 0.30;
          const float LW = 0.00060;

          float bright = 0.0;
          for(int i = 0; i < 6; i++){
            float fi = float(i);
            /* each "ring" sweeps outward in time; inverse-dist spike = line */
            bright += LW * (fi * fi + 1.2)
                      / max(abs(fract(t + fi * 0.011) - r), 0.0005);
          }

          /* cool-white tint  R < G < B */
          vec3 col = vec3(bright * 0.70, bright * 0.86, bright * 1.00);

          /* ── full-width vignette ──
             Only fade top/bottom (uv.y), NOT left/right.
             The rings extend edge-to-edge horizontally.
             Clamp bright so multiplications don't blow out.         */
          bright = min(bright, 6.0);
          float vigY = 1.0 - smoothstep(0.70, 1.50, abs(uv.y));

          col   *= vigY;
          float alpha = clamp(bright * 3.2, 0.0, 1.0) * vigY;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    })

    scene.add(new THREE.Mesh(geo, material))

    /* ── renderer: DPR=1, transparent clear ── */
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"
    container.appendChild(renderer.domElement)

    stateRef.current = { renderer, animationId: null, paused: false, uniforms, scene, camera }

    /* ── resize: setSize(w,h,false) avoids double CSS-size write ── */
    const onResize = () => {
      const { width: w, height: h } = container.getBoundingClientRect()
      renderer.setSize(w || window.innerWidth, h || window.innerHeight, false)
      uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height)
    }
    onResize()
    window.addEventListener("resize", onResize, { passive: true })

    /* ── animation loop ── */
    const animate = () => {
      if (stateRef.current.paused) { stateRef.current.animationId = null; return }
      stateRef.current.animationId = requestAnimationFrame(animate)
      uniforms.time.value += 0.05
      renderer.render(scene, camera)
    }
    animate()

    /* ── IntersectionObserver: zero GPU when off-screen ── */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          stateRef.current.paused = !e.isIntersecting
          if (e.isIntersecting && !stateRef.current.animationId) animate()
        }
      },
      { threshold: 0.01 }
    )
    io.observe(container)

    return () => {
      io.disconnect()
      if (stateRef.current.animationId) cancelAnimationFrame(stateRef.current.animationId)
      window.removeEventListener("resize", onResize)
      renderer.dispose(); geo.dispose(); material.dispose()
    }
  }, [])

  return (
    <div ref={containerRef}
      style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"hidden" }}
    />
  )
}
