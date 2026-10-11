import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, ViewStyle } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';
import { GLView } from 'expo-gl';

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
  uniform vec3 themeAccent;
  uniform vec3 themeSurface;

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

    vec3 base = mix(themeSurface, themeAccent, mix(0.1, 0.2, grad));
    vec3 accent = mix(themeAccent, vec3(1.0), 0.2 * sin(grad * 3.14));

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

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (__DEV__ && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[ShaderLines] compile error:', gl.getShaderInfoLog(shader));
  }

  return shader;
}

export const ShaderLines = memo(function ShaderLines({
  style,
  opacity: baseOpacity = 1,
  dimAfterMs,
  dimTo = 0.35,
  mode = 'dark',
}: {
  style?: ViewStyle | ViewStyle[];
  opacity?: number;
  dimAfterMs?: number;
  dimTo?: number;
  mode?: 'dark' | 'light';
}) {
  const p = useThemedPalette();
  const paletteRef = useRef(p);
  paletteRef.current = p;
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const glRef = useRef<(WebGLRenderingContext & { endFrameEXP: () => void }) | null>(null);
  const resLocRef = useRef<WebGLUniformLocation | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [size, setSize] = useState({ width: 1, height: 1 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;

    if (width > 0 && height > 0) {
      setSize({
        width: Math.ceil(width),
        height: Math.ceil(height),
      });
    }
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: baseOpacity,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [baseOpacity, opacity]);

  useEffect(() => {
    if (dimAfterMs == null) return;

    const id = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: dimTo,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, dimAfterMs);

    return () => clearTimeout(id);
  }, [dimAfterMs, dimTo, opacity]);

  const onContextCreate = useCallback((gl: WebGLRenderingContext & { endFrameEXP: () => void }) => {
    glRef.current = gl;

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.useProgram(program);

    if (__DEV__ && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[ShaderLines] link error:', gl.getProgramInfoLog(program));
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const positionAttr = gl.getAttribLocation(program, 'position');
    const timeLoc = gl.getUniformLocation(program, 'time');
    const resLoc = gl.getUniformLocation(program, 'resolution');

    resLocRef.current = resLoc;

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

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(resLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const themeModeLoc = gl.getUniformLocation(program, 'themeMode');
    gl.uniform1f(themeModeLoc, modeRef.current === 'light' ? 1.0 : 0.0);

    const accentLoc = gl.getUniformLocation(program, 'themeAccent');
    const surfaceLoc = gl.getUniformLocation(program, 'themeSurface');
    const rgb = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
    let time = 1.0;

    const render = () => {
      if (!mountedRef.current) return;

      rafRef.current = requestAnimationFrame(render);

      time += 0.05;

      const [r, g, b] = rgb(paletteRef.current.accent);
      const [br, bg, bb] = rgb(paletteRef.current.bg);
      gl.uniform3f(accentLoc, r, g, b);
      gl.uniform3f(surfaceLoc, br, bg, bb);
      gl.uniform1f(themeModeLoc, modeRef.current === 'light' ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLoc, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endFrameEXP();
    };

    render();
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    const resLoc = resLocRef.current;

    if (!gl || !resLoc) return;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(resLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }, [size.width, size.height]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFillObject, styles.layer, { opacity }, style]}
    >
      <GLView
        style={{
          width: size.width,
          height: size.height,
        }}
        onContextCreate={onContextCreate}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: {
    overflow: 'hidden',
  },
});