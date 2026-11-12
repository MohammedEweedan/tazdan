// Payments: Send / Receive / Scan / Top up, and the latest payments.
// Incoming money in green, everything else in the normal ink; red is
// reserved for failures (as on the home screen).

import SwiftUI
import WidgetKit

private struct ActionButton: View {
  let p: Palette
  let label: String
  let symbol: String
  let path: String

  var body: some View {
    Link(destination: url(path)) {
      VStack(spacing: 4) {
        Image(systemName: symbol)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(p.fg)
          .frame(width: 38, height: 38)
          .background(Circle().fill(p.pill))
        Text(label)
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(p.fgMuted)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity)
    }
  }
}

private struct PaymentRow: View {
  let p: Palette
  let payment: Payment
  let locale: String

  var body: some View {
    HStack(spacing: 8) {
      VStack(alignment: .leading, spacing: 1) {
        Text(payment.title)
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(payment.failed ? p.fgMuted : p.fg)
          .lineLimit(1)
        Text(clock(payment.at, locale))
          .font(.system(size: 11))
          .foregroundStyle(p.fgMuted)
      }
      Spacer(minLength: 4)
      Text(payment.amountText)
        .font(.system(size: 14, weight: .semibold).monospacedDigit())
        .foregroundStyle(payment.failed ? p.fgFaint : payment.incoming ? p.green : p.fg)
        .lineLimit(1)
    }
  }
}

struct PaymentsView: View {
  @Environment(\.colorScheme) private var scheme
  @Environment(\.widgetFamily) private var systemFamily
  let entry: TazdanEntry
  /// Previews only; on device the system decides.
  var previewFamily: WidgetFamily? = nil
  private var family: WidgetFamily { previewFamily ?? systemFamily }

  var body: some View {
    let p = Palette.of(scheme)
    Group {
      if let s = entry.snapshot {
        if family == .systemSmall { small(s, p) } else { medium(s, p) }
      } else {
        SignedOut(p: p)
      }
    }
    .environment(\.layoutDirection, .leftToRight)
    .widgetSurface(p.bg)
  }

  // Small widgets take one tap: open Send.
  private func small(_ s: Snapshot, _ p: Palette) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      WidgetHeader(p: p, title: s.labels.payments)
      if let last = s.payments.first {
        Text(last.amountText)
          .font(.system(size: 20, weight: .semibold).monospacedDigit())
          .foregroundStyle(last.failed ? p.fgFaint : last.incoming ? p.green : p.fg)
          .lineLimit(1).minimumScaleFactor(0.6)
        Text(last.title).font(.system(size: 12, weight: .medium)).foregroundStyle(p.fgMuted).lineLimit(1)
      } else {
        Text(s.labels.noPayments).font(.system(size: 12, weight: .medium)).foregroundStyle(p.fgMuted)
      }
      Spacer(minLength: 0)
      HStack(spacing: 6) {
        Image(systemName: "arrow.up").font(.system(size: 12, weight: .bold))
        Text(s.labels.send).font(.system(size: 13, weight: .semibold))
      }
      .foregroundStyle(p.fg)
      .padding(.horizontal, 12).padding(.vertical, 7)
      .background(Capsule().fill(p.pill))
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(url("send"))
  }

  private func medium(_ s: Snapshot, _ p: Palette) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      WidgetHeader(p: p, title: s.labels.payments, right: clock(s.updatedAt, s.locale))
      if let last = s.payments.first {
        Link(destination: url("history")) { PaymentRow(p: p, payment: last, locale: s.locale) }
      } else {
        Text(s.labels.noPayments).font(.system(size: 13, weight: .medium)).foregroundStyle(p.fgMuted)
      }
      Spacer(minLength: 0)
      HStack(spacing: 0) {
        ActionButton(p: p, label: s.labels.send, symbol: "arrow.up", path: "send")
        ActionButton(p: p, label: s.labels.receive, symbol: "arrow.down", path: "receive")
        ActionButton(p: p, label: s.labels.scan, symbol: "qrcode.viewfinder", path: "scanner")
        ActionButton(p: p, label: s.labels.topUp, symbol: "plus", path: "topup")
      }
    }
  }
}

struct PaymentsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazdanPayments", provider: SnapshotProvider()) { entry in
      PaymentsView(entry: entry)
    }
    .configurationDisplayName(Gallery.payments)
    .description(Gallery.paymentsDesc)
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
