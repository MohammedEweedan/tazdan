import { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';
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

  float random(in float x) {
    return fract(sin(x) * 1e4);
  }

  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

    vec2 fMosaicScal = vec2(4.0, 2.0);
    vec2 vScreenSize = vec2(256.0, 256.0);
    uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
    uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

    float t = time * 0.04 + random(uv.x) * 0.4;
    float lineWidth = 0.0028;

    float intensity = 0.0;
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 5; i++) {
        intensity += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) - length(uv));
      }
    }

    intensity = clamp(intensity * 0.18, 0.0, 0.24);
    vec3 lineColor = vec3(0.388, 0.631, 0.859);
    gl_FragColor = vec4(lineColor, intensity);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (__DEV__ && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
  }
  return shader;
}

/**
 * Animated shader lines.
 *
 * The shader emits transparent accent strokes only. It intentionally does not
 * paint an opaque canvas background, which keeps onboarding backgrounds uniform.
 */
export function ShaderLines({
  style,
  opacity: baseOpacity = 1,
  dimAfterMs,
  dimTo = 0.35,
}: {
  style?: object;
  /** Constant opacity for the whole layer — set this low when the shader
   *  would otherwise hurt foreground contrast. */
  opacity?: number;
  dimAfterMs?: number;
  dimTo?: number;
}) {
  const rafRef = useRef<number | null>(null);
  const glRef  = useRef<(WebGLRenderingContext & { endFrameEXP: () => void }) | null>(null);
  const opacity = useRef(new Animated.Value(baseOpacity)).current;

  useEffect(() => {
    if (dimAfterMs == null) return;
    const id = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: dimTo, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
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
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const positionAttr = gl.getAttribLocation(program, 'position');
    const timeLoc = gl.getUniformLocation(program, 'time');
    const resLoc = gl.getUniformLocation(program, 'resolution');

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttr);
    gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);

    let t = 1.0;
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      t += 0.05;
      gl.uniform1f(timeLoc, t);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endFrameEXP();
    };
    render();
  }, []);

  // Cancel animation loop on unmount
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }, style]} pointerEvents="none">
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </Animated.View>
  );
}
