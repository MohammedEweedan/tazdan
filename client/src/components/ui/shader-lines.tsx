'use client';

import { useEffect, useRef } from 'react';

const VERT = `
  attribute vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;

  uniform vec2 resolution;
  uniform float time;
  uniform float themeMode;

  float random(in float x) {
    return fract(sin(x) * 1e4);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy)
      / min(resolution.x, resolution.y);

    vec2 fMosaicScal = vec2(4.0, 2.0);
    vec2 vScreenSize = vec2(256.0, 256.0);

    uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
    uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

    float t = time * 0.06 + random(uv.x) * 0.4;
    float lineWidth = 0.004;

    vec3 raw = vec3(0.0);

    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 5; i++) {
        raw[j] += lineWidth * float(i * i)
          / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) - length(uv));
      }
    }

    float fade = 1.0;

    vec2 screenUV = gl_FragCoord.xy / resolution.xy;
    float grad = (screenUV.x + screenUV.y) * 0.5;

    vec3 darkBaseA = vec3(0.043, 0.071, 0.125);
    vec3 darkBaseB = vec3(0.059, 0.110, 0.180);
    vec3 darkBaseC = vec3(0.067, 0.122, 0.208);

    vec3 darkBlueA = vec3(0.106, 0.208, 0.357);
    vec3 darkBlueB = vec3(0.392, 0.714, 0.976);
    vec3 darkBlueC = vec3(0.231, 0.475, 0.690);

    // Light mode: BreathingGradient palette — light-blue base fill (#e8f2fb →
    // #cce1f5) with medium-blue lines (#4a8fd0 / #63a1db / #3b79b0) woven in.
    vec3 lightBaseA = vec3(0.910, 0.949, 0.984);
    vec3 lightBaseB = vec3(0.855, 0.918, 0.973);
    vec3 lightBaseC = vec3(0.800, 0.882, 0.961);

    vec3 lightBlueA = vec3(0.290, 0.560, 0.820);
    vec3 lightBlueB = vec3(0.388, 0.631, 0.859);
    vec3 lightBlueC = vec3(0.231, 0.475, 0.690);

    vec3 baseA = mix(darkBaseA, lightBaseA, themeMode);
    vec3 baseB = mix(darkBaseB, lightBaseB, themeMode);
    vec3 baseC = mix(darkBaseC, lightBaseC, themeMode);

    vec3 blueA = mix(darkBlueA, lightBlueA, themeMode);
    vec3 blueB = mix(darkBlueB, lightBlueB, themeMode);
    vec3 blueC = mix(darkBlueC, lightBlueC, themeMode);

    vec3 base = mix(baseA, baseB, smoothstep(0.0, 0.55, grad));
    base = mix(base, baseC, smoothstep(0.45, 1.0, grad));

    vec3 accent = mix(blueA, blueB, smoothstep(0.0, 0.55, grad));
    accent = mix(accent, blueC, smoothstep(0.45, 1.0, grad));

    float mask = clamp((raw.r + raw.g + raw.b) * 0.18, 0.0, 1.0);
    vec3 color = mix(base, accent, mask);

    // Dark: faint line overlay so the bg shows through (alpha floor near zero).
    // Light: near-solid blue fill like the BreathingGradient — base covers the
    // whole surface, brighter lines woven in on top.
    float darkAlpha = clamp(mask, 0.08, 0.65);
    float lightAlpha = clamp(0.85 + mask * 0.15, 0.85, 1.0);
    float alpha = mix(darkAlpha, lightAlpha, themeMode) * fade;

    gl_FragColor = vec4(color, alpha);
  }
`;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const shader = gl.createShader(type);

  if (!shader) return null;

  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (
    process.env.NODE_ENV !== 'production' &&
    !gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  ) {
    console.error('[ShaderLines] compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

type ShaderLinesProps = {
  mode?: 'dark' | 'light';
};

export function ShaderLines({ mode = 'dark' }: ShaderLinesProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.dataset.shaderMode = mode;
  }, [mode]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'display:block',
      'pointer-events:none',
    ].join(';');

    root.appendChild(canvas);

    const gl =
      (canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
      }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      return () => {
        canvas.remove();
      };
    }

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);

    if (!vert || !frag) {
      canvas.remove();
      return;
    }

    const program = gl.createProgram();

    if (!program) {
      canvas.remove();
      return;
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (
      process.env.NODE_ENV !== 'production' &&
      !gl.getProgramParameter(program, gl.LINK_STATUS)
    ) {
      console.error('[ShaderLines] link error:', gl.getProgramInfoLog(program));
      canvas.remove();
      return;
    }

    gl.useProgram(program);

    const positionAttr = gl.getAttribLocation(program, 'position');
    const timeLoc = gl.getUniformLocation(program, 'time');
    const resLoc = gl.getUniformLocation(program, 'resolution');

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttr);
    gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let rafId: number | null = null;
    let paused = false;
    let time = 1.0;

    const resize = () => {
      const rect = root.getBoundingClientRect();

      const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
      const height = Math.max(1, Math.floor(rect.height || window.innerHeight));

      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      gl.viewport(0, 0, width, height);
      gl.uniform2f(resLoc, width, height);
    };

    const render = () => {
      if (paused) {
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(render);

      time += 0.05;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLoc, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const themeModeLoc = gl.getUniformLocation(program, 'themeMode');

    const themeValue = mode === 'light' ? 1.0 : 0.0;

    gl.uniform1f(themeModeLoc, themeValue);

    resize();

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (reduceMotion) {
      gl.uniform1f(timeLoc, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      render();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    const onVisibilityChange = () => {
      paused = document.hidden;

      if (!paused && rafId === null && !reduceMotion) {
        render();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        paused = !entry.isIntersecting || document.hidden;

        if (!paused && rafId === null && !reduceMotion) {
          render();
        }
      },
      { threshold: 0 }
    );

    observer.observe(root);

    return () => {
      paused = true;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);

      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);

      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
    />
  );
}

export default ShaderLines;