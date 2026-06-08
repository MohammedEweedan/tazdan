import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, ViewStyle } from 'react-native';
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

    let time = 1.0;

    const render = () => {
      if (!mountedRef.current) return;

      rafRef.current = requestAnimationFrame(render);

      time += 0.05;

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