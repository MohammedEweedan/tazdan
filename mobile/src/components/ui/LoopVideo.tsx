/**
 * LoopVideo — silent looping background video.
 *
 *  - Native (iOS / Android): uses Expo SDK 54's `expo-video` VideoView.
 *  - Web: uses a raw `<video>` DOM element so we get reliable autoplay
 *    (browsers only allow muted+playsInline autoplay).
 *
 * Uses expo-asset's Asset module to resolve the asset URI on all platforms.
 */

import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Asset } from 'expo-asset';

interface Props {
  /** require()-d asset, e.g. require('../../assets/WebHeader.mp4') */
  source: number;
  style?: StyleProp<ViewStyle>;
  /** 0..1 — visual opacity of the video layer */
  opacity?: number;
}

export function LoopVideo({ source, style, opacity = 1 }: Props) {
  if (Platform.OS === 'web') {
    return <WebVideo source={source} style={style} opacity={opacity} />;
  }
  return <NativeVideo source={source} style={style} opacity={opacity} />;
}

/* ── Native ───────────────────────────────────────────────── */
function NativeVideo({ source, style, opacity = 1 }: Props) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => { try { player.play(); } catch { /* noop */ } }, [player]);
  return (
    <VideoView
      player={player}
      style={[{ opacity }, style]}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

/* ── Web ──────────────────────────────────────────────────── */
function WebVideo({ source, style, opacity = 1 }: Props) {
  // Resolve the bundler's URI for the asset.
  const uri = Asset.fromModule(source).uri;

  // Flatten incoming style for sane DOM inheritance.
  const flat = (Array.isArray(style) ? Object.assign({}, ...style) : style) as Record<string, unknown> ?? {};

  // Use a native <video> element. JSX in React Native Web tolerates it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Video = 'video' as unknown as React.ComponentType<any>;

  return (
    <Video
      src={uri}
      autoPlay
      muted
      loop
      playsInline
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        opacity,
        pointerEvents: 'none',
        ...flat,
      }}
    />
  );
}
