/**
 * Android home-screen widgets: Payments, Chats and Holdings.
 *
 * Same language as the app's home screen — charcoal (or paper) surface,
 * uppercase muted captions, flat rows, incoming money in green and
 * everything else in the normal ink (red only for failures), no boxed
 * cards. Narrow placements (2 cells) get a compact layout.
 */
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type WidgetRepresentation } from 'react-native-android-widget';
import {
  MASK, formatChange, formatDisplay, priceLine, totalUsd,
  type WidgetName, type WidgetSnapshot,
} from '../snapshot';
import { DARK, LIGHT, glyph, type WidgetTheme } from './theme';

type Size = { width: number; height: number };
const open = (path: string) => ({ clickAction: 'OPEN_URI' as const, clickActionData: { uri: `tazdan://${path}` } });

function clock(iso: string, locale: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const tag = locale === 'ar' ? 'ar-LY' : 'en-GB';
  return sameDay
    ? d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : d.toLocaleDateString(tag, { day: 'numeric', month: 'short' });
}

function Shell({ t, children, link }: { t: WidgetTheme; children: React.ReactNode; link: string }) {
  return (
    <FlexWidget
      {...open(link)}
      style={{
        height: 'match_parent', width: 'match_parent', flexDirection: 'column',
        backgroundColor: t.bg, borderRadius: 22, padding: 16,
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Header({ t, title, right }: { t: WidgetTheme; title: string; right?: string }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <TextWidget text={title.toUpperCase()} style={{ color: t.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.06 }} />
      <FlexWidget style={{ flex: 1 }} />
      {right ? <TextWidget text={right} style={{ color: t.fgFaint, fontSize: 10, fontWeight: '500' }} /> : null}
    </FlexWidget>
  );
}

function Empty({ t, text }: { t: WidgetTheme; text: string }) {
  return (
    <FlexWidget style={{ flex: 1, width: 'match_parent', justifyContent: 'center', alignItems: 'center' }}>
      <TextWidget text={text} maxLines={3} style={{ color: t.fgMuted, fontSize: 13, fontWeight: '500', textAlign: 'center' }} />
    </FlexWidget>
  );
}

/* ── Payments ─────────────────────────────────────────────────── */

function Action({ t, label, icon, path }: { t: WidgetTheme; label: string; icon: Parameters<typeof glyph>[0]; path: string }) {
  return (
    <FlexWidget {...open(path)} style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
      <FlexWidget style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.pillBg, justifyContent: 'center', alignItems: 'center' }}>
        <SvgWidget svg={glyph(icon, t.fg)} style={{ width: 18, height: 18 }} />
      </FlexWidget>
      <TextWidget text={label} maxLines={1} style={{ color: t.fgMuted, fontSize: 10, fontWeight: '500', marginTop: 4 }} />
    </FlexWidget>
  );
}

function Payments({ s, t, size }: { s: WidgetSnapshot; t: WidgetTheme; size: Size }) {
  const compact = size.width < 200;
  const rows = s.payments.slice(0, compact ? 1 : Math.max(1, Math.floor((size.height - 120) / 40)));
  if (compact) {
    // Narrow: the latest amount large, who it was under it, then Send/Scan.
    const last = s.payments[0];
    return (
      <Shell t={t} link="history">
        <Header t={t} title={s.labels.payments} />
        <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'column' }}>
          {/* No fragments here: the widget renderer only resolves widget primitives. */}
          {last ? (
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
              <TextWidget text={last.amountText} maxLines={1} style={{ color: last.failed ? t.fgFaint : last.incoming ? t.green : t.fg, fontSize: 18, fontWeight: '600', adjustsFontSizeToFit: true }} />
              <TextWidget text={last.title} maxLines={1} truncate="END" style={{ color: t.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} />
            </FlexWidget>
          ) : <TextWidget text={s.labels.noPayments} style={{ color: t.fgMuted, fontSize: 12, fontWeight: '500' }} />}
        </FlexWidget>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
          <Action t={t} label={s.labels.send} icon="up" path="send" />
          <Action t={t} label={s.labels.scan} icon="scan" path="scanner" />
        </FlexWidget>
      </Shell>
    );
  }
  return (
    <Shell t={t} link="history">
      <Header t={t} title={s.labels.payments} right={clock(s.updatedAt, s.locale)} />
      {rows.length === 0 ? <Empty t={t} text={s.labels.noPayments} /> : (
        <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'column' }}>
          {rows.map((p) => (
            <FlexWidget key={p.id} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
                <TextWidget text={p.title} maxLines={1} truncate="END" style={{ color: p.failed ? t.fgMuted : t.fg, fontSize: 14, fontWeight: '600' }} />
                <TextWidget text={clock(p.at, s.locale)} style={{ color: t.fgMuted, fontSize: 11, marginTop: 1 }} />
              </FlexWidget>
              <TextWidget
                text={p.amountText}
                style={{ color: p.failed ? t.fgFaint : p.incoming ? t.green : t.fg, fontSize: 14, fontWeight: '600', marginLeft: 8 }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 6 }}>
        <Action t={t} label={s.labels.send} icon="up" path="send" />
        <Action t={t} label={s.labels.receive} icon="down" path="receive" />
        <Action t={t} label={s.labels.scan} icon="scan" path="scanner" />
        <Action t={t} label={s.labels.topUp} icon="plus" path="topup" />
      </FlexWidget>
    </Shell>
  );
}

/* ── Chats ────────────────────────────────────────────────────── */

function Chats({ s, t, size }: { s: WidgetSnapshot; t: WidgetTheme; size: Size }) {
  const compact = size.width < 200;
  if (compact) {
    const top = s.chats.items[0];
    return (
      <Shell t={t} link={top && s.chats.unread ? `messages/${top.partnerId}` : 'messages'}>
        <Header t={t} title={s.labels.chats} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <TextWidget text={String(s.chats.unread)} style={{ color: t.fg, fontSize: 34, fontWeight: '600' }} />
          <TextWidget text={s.labels.unread} style={{ color: t.fgMuted, fontSize: 12, fontWeight: '500' }} />
        </FlexWidget>
        {top ? <TextWidget text={top.name} maxLines={1} truncate="END" style={{ color: t.fgMuted, fontSize: 11, fontWeight: '600' }} /> : null}
      </Shell>
    );
  }
  const rows = s.chats.items.slice(0, Math.max(1, Math.floor((size.height - 50) / 46)));
  return (
    <Shell t={t} link="messages">
      <Header t={t} title={s.labels.chats} right={s.chats.unread ? `${s.chats.unread} ${s.labels.unread}` : undefined} />
      {rows.length === 0 ? <Empty t={t} text={s.labels.noChats} /> : rows.map((c) => (
        <FlexWidget key={c.partnerId} {...open(`messages/${c.partnerId}`)} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
          <FlexWidget style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' }}>
            <TextWidget text={c.initial} style={{ color: t.accentFg, fontSize: 14, fontWeight: '600' }} />
          </FlexWidget>
          <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
            <TextWidget text={c.name} maxLines={1} truncate="END" style={{ color: t.fg, fontSize: 14, fontWeight: c.unread ? '700' : '600' }} />
            {c.preview ? (
              <TextWidget text={c.preview} maxLines={1} truncate="END" style={{ color: c.unread ? t.fg : t.fgMuted, fontSize: 12, marginTop: 1 }} />
            ) : null}
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end', marginLeft: 8 }}>
            <TextWidget text={clock(c.at, s.locale)} style={{ color: t.fgFaint, fontSize: 10 }} />
            {c.unread ? (
              <FlexWidget style={{ height: 18, borderRadius: 9, paddingHorizontal: 6, marginTop: 3, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' }}>
                <TextWidget text={c.unread > 99 ? '99+' : String(c.unread)} style={{ color: t.accentFg, fontSize: 10, fontWeight: '600' }} />
              </FlexWidget>
            ) : null}
          </FlexWidget>
        </FlexWidget>
      ))}
    </Shell>
  );
}

/* ── Holdings ─────────────────────────────────────────────────── */

function PriceRow({ s, t, h }: { s: WidgetSnapshot; t: WidgetTheme; h: WidgetSnapshot['holdings'][number] }) {
  const change = formatChange(h.change24hPct);
  return (
    <FlexWidget {...open(`asset/${h.code}`)} style={{ width: 'match_parent', flexDirection: 'column', paddingVertical: 3 }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget text={h.code} style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget text={priceLine(h, s.display)} maxLines={1} style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget text={s.hidden ? MASK : formatDisplay(h.amount * h.usdPrice, s.display)} maxLines={1} style={{ color: t.fgMuted, fontSize: 11 }} />
        <FlexWidget style={{ flex: 1 }} />
        {change ? <TextWidget text={change} style={{ color: h.change24hPct != null && h.change24hPct < 0 ? t.red : t.green, fontSize: 11, fontWeight: '500' }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Holdings({ s, t, size, pricesAt }: { s: WidgetSnapshot; t: WidgetTheme; size: Size; pricesAt: string }) {
  const compact = size.width < 200;
  const total = s.hidden ? MASK : formatDisplay(totalUsd(s), s.display);
  if (!compact && size.height < 260) {
    // Wide and short: the total on the left, three prices on the right.
    return (
      <Shell t={t} link="wallet">
        <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'row' }}>
          <FlexWidget style={{ width: 118, height: 'match_parent', flexDirection: 'column', marginRight: 14 }}>
            <Header t={t} title={s.labels.assets} />
            <FlexWidget style={{ flex: 1 }} />
            <TextWidget text={s.labels.total} style={{ color: t.fgMuted, fontSize: 11, fontWeight: '500' }} />
            <TextWidget text={total} maxLines={1} style={{ color: t.fg, fontSize: 20, fontWeight: '600', adjustsFontSizeToFit: true }} />
            <TextWidget text={clock(pricesAt, s.locale)} style={{ color: t.fgFaint, fontSize: 10, fontWeight: '500', marginTop: 2 }} />
          </FlexWidget>
          <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column' }}>
            {s.holdings.length === 0
              ? <Empty t={t} text={s.labels.noAssets} />
              : s.holdings.slice(0, 3).map((h) => <PriceRow key={h.code} s={s} t={t} h={h} />)}
          </FlexWidget>
        </FlexWidget>
      </Shell>
    );
  }
  const rows = s.holdings.slice(0, compact ? 2 : Math.max(1, Math.floor((size.height - 92) / 40)));
  return (
    <Shell t={t} link="wallet">
      <Header t={t} title={s.labels.assets} right={clock(pricesAt, s.locale)} />
      <TextWidget text={s.labels.total} style={{ color: t.fgMuted, fontSize: 11, fontWeight: '500' }} />
      <TextWidget text={total} maxLines={1} style={{ color: t.fg, fontSize: compact ? 20 : 24, fontWeight: '600', marginBottom: 6, adjustsFontSizeToFit: true }} />
      {rows.length === 0 ? <Empty t={t} text={s.labels.noAssets} /> : rows.map((h) => {
        const change = formatChange(h.change24hPct);
        const changeColor = h.change24hPct != null && h.change24hPct < 0 ? t.red : t.green;
        return (
          <FlexWidget key={h.code} {...open(`asset/${h.code}`)} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
            <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
              <TextWidget text={h.code} style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} />
              {!compact && <TextWidget text={priceLine(h, s.display)} maxLines={1} style={{ color: t.fgMuted, fontSize: 11, marginTop: 1 }} />}
            </FlexWidget>
            <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
              {!compact && (
                <TextWidget text={s.hidden ? MASK : formatDisplay(h.amount * h.usdPrice, s.display)} style={{ color: t.fg, fontSize: 13, fontWeight: '600' }} />
              )}
              {change ? <TextWidget text={change} style={{ color: changeColor, fontSize: 11, fontWeight: '500', marginTop: compact ? 0 : 1 }} /> : null}
            </FlexWidget>
          </FlexWidget>
        );
      })}
    </Shell>
  );
}

/* ── Entry ────────────────────────────────────────────────────── */

const SIGNED_OUT: Record<'en' | 'ar', string> = {
  en: 'Open tazdan to set up this widget',
  ar: 'افتح tazdan لإعداد هذه الأداة',
};

function one(name: WidgetName, s: WidgetSnapshot | null, t: WidgetTheme, size: Size, pricesAt?: string, lang: 'en' | 'ar' = 'en') {
  if (!s) {
    return (
      <Shell t={t} link="">
        <Empty t={t} text={SIGNED_OUT[lang]} />
      </Shell>
    );
  }
  if (name === 'TazdanPayments') return <Payments s={s} t={t} size={size} />;
  if (name === 'TazdanChats') return <Chats s={s} t={t} size={size} />;
  return <Holdings s={s} t={t} size={size} pricesAt={pricesAt ?? s.updatedAt} />;
}

/** Both appearances; the launcher picks the one matching the system theme. */
export function renderWidget(
  name: WidgetName, s: WidgetSnapshot | null, size: Size,
  opts: { pricesAt?: string; lang?: 'en' | 'ar' } = {},
): WidgetRepresentation {
  return {
    light: one(name, s, LIGHT, size, opts.pricesAt, opts.lang),
    dark: one(name, s, DARK, size, opts.pricesAt, opts.lang),
  };
}
