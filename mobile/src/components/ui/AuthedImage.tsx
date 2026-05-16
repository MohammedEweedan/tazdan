/**
 * Image component that fetches its source with the user's auth token.
 *
 * The server's /uploads route used to be public (express.static) and is
 * now auth-gated. A bare <Image source={{uri:'/uploads/abc.jpg'}}/> will
 * now 401 because RN doesn't attach our Authorization header. Use this
 * component for any image whose URL points at /uploads on our backend.
 *
 * For external URLs (CoinGecko icons, QR data URIs, etc.) use the plain
 * <Image> — this component is overkill for public assets.
 */
import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { APP, STORAGE_KEYS } from '@/constants';
import { secureStore } from '@/lib/secureStore';

type Props = Omit<ImageProps, 'source'> & { uri?: string };

const ORIGIN = (() => {
  try {
    const u = new URL(APP.apiBaseUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
})();

function isProtectedUploadUrl(uri: string): boolean {
  if (uri.startsWith('/uploads/')) return true;
  if (ORIGIN && uri.startsWith(`${ORIGIN}/uploads/`)) return true;
  if (uri.startsWith(`${APP.apiBaseUrl}/uploads/`)) return true;
  return false;
}

export function AuthedImage({ uri, ...rest }: Props) {
  const [dataUri, setDataUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      setDataUri(undefined);
      return;
    }
    if (!isProtectedUploadUrl(uri)) {
      setDataUri(uri);
      return;
    }
    (async () => {
      try {
        const token = await secureStore.get(STORAGE_KEYS.accessToken);
        const abs = uri.startsWith('http') ? uri : `${ORIGIN}${uri}`;
        const res = await fetch(abs, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelled && typeof reader.result === 'string') {
            setDataUri(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (!cancelled) setDataUri(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [uri]);

  if (!dataUri) return <Image {...rest} source={{ uri: undefined as any }} />;
  return <Image {...rest} source={{ uri: dataUri }} />;
}
