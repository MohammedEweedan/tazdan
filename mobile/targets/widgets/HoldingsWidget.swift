// Prices & holdings: the total and each crypto/currency the user holds,
// with live prices and 24 h change. Hide-balances masks amounts and the
// total, never market prices.

import SwiftUI
import WidgetKit

private struct HoldingLine: View {
  let p: Palette
  let h: Holding
  let s: Snapshot
  var showValue = true

  var body: some View {
    HStack(spacing: 8) {
      VStack(alignment: .leading, spacing: 1) {
        Text(h.code).font(.system(size: 13, weight: .semibold)).foregroundStyle(p.fg)
        Text(priceLine(h, s.display))
          .font(.system(size: 11).monospacedDigit())
          .foregroundStyle(p.fgMuted)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      Spacer(minLength: 4)
      VStack(alignment: .trailing, spacing: 1) {
        if showValue {
          Text(s.hidden ? maskedAmount : formatDisplay(h.amount * h.usdPrice, s.display))
            .font(.system(size: 13, weight: .semibold).monospacedDigit())
            .foregroundStyle(p.fg)
            .lineLimit(1)
        }
        if let change = formatChange(h.change24hPct) {
          Text(change)
            .font(.system(size: 11, weight: .medium).monospacedDigit())
            .foregroundStyle((h.change24hPct ?? 0) < 0 ? p.red : p.green)
        }
      }
    }
  }
}

struct HoldingsView: View {
  @Environment(\.colorScheme) private var scheme
  @Environment(\.widgetFamily) private var systemFamily
  let entry: TazdanEntry
  /// Previews only; on device the system decides.
  var previewFamily: WidgetFamily? = nil
  private var family: WidgetFamily { previewFamily ?? systemFamily }

  var body: some View {
    let p = Palette.of(scheme)
    Group {
      if let s = entry.snapshot { content(s, p) } else { SignedOut(p: p) }
    }
    .environment(\.layoutDirection, .leftToRight)
    .widgetSurface(p.bg)
    .widgetURL(url("wallet"))
  }

  private func content(_ s: Snapshot, _ p: Palette) -> some View {
    let pricesAt = clock(entry.pricesAt.map { ISO8601DateFormatter().string(from: $0) } ?? s.updatedAt, s.locale)
    let total = s.hidden ? maskedAmount : formatDisplay(s.totalUsd, s.display)
    return Group {
      if family == .systemMedium {
        // Wide and short: the total on the left, three prices on the right.
        HStack(alignment: .top, spacing: 14) {
          VStack(alignment: .leading, spacing: 2) {
            WidgetHeader(p: p, title: s.labels.assets)
            Spacer(minLength: 0)
            Text(s.labels.total).font(.system(size: 11, weight: .medium)).foregroundStyle(p.fgMuted)
            Text(total)
              .font(.system(size: 22, weight: .semibold).monospacedDigit())
              .foregroundStyle(p.fg)
              .lineLimit(1).minimumScaleFactor(0.5)
            Text(pricesAt).font(.system(size: 10, weight: .medium)).foregroundStyle(p.fgFaint)
          }
          .frame(width: 118, alignment: .leading)
          VStack(alignment: .leading, spacing: 7) {
            if s.holdings.isEmpty {
              EmptyNote(p: p, text: s.labels.noAssets)
            } else {
              ForEach(s.holdings.prefix(3)) { h in
                Link(destination: url("asset/\(h.code)")) { PriceLine(p: p, h: h, s: s) }
              }
              Spacer(minLength: 0)
            }
          }
        }
      } else {
        let rows = family == .systemSmall ? 2 : 7
        VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 6) {
          WidgetHeader(p: p, title: s.labels.assets, right: pricesAt)
          VStack(alignment: .leading, spacing: 0) {
            Text(s.labels.total).font(.system(size: 11, weight: .medium)).foregroundStyle(p.fgMuted)
            Text(total)
              .font(.system(size: family == .systemSmall ? 20 : 26, weight: .semibold).monospacedDigit())
              .foregroundStyle(p.fg)
              .lineLimit(1).minimumScaleFactor(0.5)
          }
          if s.holdings.isEmpty {
            EmptyNote(p: p, text: s.labels.noAssets)
          } else {
            ForEach(s.holdings.prefix(rows)) { h in
              if family == .systemSmall {
                HoldingLine(p: p, h: h, s: s, showValue: false)
              } else {
                Link(destination: url("asset/\(h.code)")) { HoldingLine(p: p, h: h, s: s) }
              }
            }
            Spacer(minLength: 0)
          }
        }
      }
    }
  }
}

/// Compact two-line row for the medium widget: code and price, then the
/// holding's value and 24 h change.
private struct PriceLine: View {
  let p: Palette
  let h: Holding
  let s: Snapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 6) {
        Text(h.code).font(.system(size: 13, weight: .semibold)).foregroundStyle(p.fg)
        Spacer(minLength: 2)
        Text(priceLine(h, s.display))
          .font(.system(size: 13, weight: .semibold).monospacedDigit())
          .foregroundStyle(p.fg)
          .lineLimit(1).minimumScaleFactor(0.7)
      }
      HStack(spacing: 6) {
        Text(s.hidden ? maskedAmount : formatDisplay(h.amount * h.usdPrice, s.display))
          .font(.system(size: 11).monospacedDigit())
          .foregroundStyle(p.fgMuted)
          .lineLimit(1)
        Spacer(minLength: 2)
        if let change = formatChange(h.change24hPct) {
          Text(change)
            .font(.system(size: 11, weight: .medium).monospacedDigit())
            .foregroundStyle((h.change24hPct ?? 0) < 0 ? p.red : p.green)
        }
      }
    }
  }
}

struct HoldingsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazdanHoldings", provider: PricesProvider()) { entry in
      HoldingsView(entry: entry)
    }
    .configurationDisplayName(Gallery.holdings)
    .description(Gallery.holdingsDesc)
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
