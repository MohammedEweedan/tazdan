// Chats: unread count and the latest conversations. Message text appears
// only when the user keeps notification previews on (see snapshot.ts).

import SwiftUI
import WidgetKit

private struct Avatar: View {
  let p: Palette
  let chat: ChatRow
  var body: some View {
    ZStack {
      Circle().fill(p.accent)
      if chat.support {
        Image(systemName: "headphones").font(.system(size: 13, weight: .semibold)).foregroundStyle(p.accentFg)
      } else {
        Text(chat.initial).font(.system(size: 14, weight: .semibold)).foregroundStyle(p.accentFg)
      }
    }
    .frame(width: 32, height: 32)
  }
}

private struct ChatLine: View {
  let p: Palette
  let chat: ChatRow
  let locale: String

  var body: some View {
    HStack(spacing: 10) {
      Avatar(p: p, chat: chat)
      VStack(alignment: .leading, spacing: 1) {
        Text(chat.name)
          .font(.system(size: 14, weight: chat.unread > 0 ? .bold : .semibold))
          .foregroundStyle(p.fg)
          .lineLimit(1)
        if !chat.preview.isEmpty {
          Text(chat.preview)
            .font(.system(size: 12))
            .foregroundStyle(chat.unread > 0 ? p.fg : p.fgMuted)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 4)
      VStack(alignment: .trailing, spacing: 3) {
        Text(clock(chat.at, locale)).font(.system(size: 10)).foregroundStyle(p.fgFaint)
        if chat.unread > 0 {
          Text(chat.unread > 99 ? "99+" : "\(chat.unread)")
            .font(.system(size: 10, weight: .semibold).monospacedDigit())
            .foregroundStyle(p.accentFg)
            .padding(.horizontal, 6).frame(minWidth: 18, minHeight: 18)
            .background(Capsule().fill(p.accent))
        }
      }
    }
  }
}

struct ChatsView: View {
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
        if family == .systemSmall { small(s, p) } else { list(s, p, rows: family == .systemLarge ? 6 : 2) }
      } else {
        SignedOut(p: p)
      }
    }
    .environment(\.layoutDirection, .leftToRight)
    .widgetSurface(p.bg)
  }

  private func small(_ s: Snapshot, _ p: Palette) -> some View {
    let top = s.chats.items.first
    return VStack(alignment: .leading, spacing: 2) {
      WidgetHeader(p: p, title: s.labels.chats)
      Spacer(minLength: 0)
      Text("\(s.chats.unread)")
        .font(.system(size: 36, weight: .semibold).monospacedDigit())
        .foregroundStyle(p.fg)
      Text(s.labels.unread).font(.system(size: 12, weight: .medium)).foregroundStyle(p.fgMuted)
      Spacer(minLength: 0)
      if let top { Text(top.name).font(.system(size: 11, weight: .semibold)).foregroundStyle(p.fgMuted).lineLimit(1) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(url(top != nil && s.chats.unread > 0 ? "messages/\(top!.partnerId)" : "messages"))
  }

  private func list(_ s: Snapshot, _ p: Palette, rows: Int) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      WidgetHeader(p: p, title: s.labels.chats, right: s.chats.unread > 0 ? "\(s.chats.unread) \(s.labels.unread)" : nil)
      if s.chats.items.isEmpty {
        EmptyNote(p: p, text: s.labels.noChats)
      } else {
        ForEach(s.chats.items.prefix(rows)) { chat in
          Link(destination: url("messages/\(chat.partnerId)")) { ChatLine(p: p, chat: chat, locale: s.locale) }
        }
        Spacer(minLength: 0)
      }
    }
    .widgetURL(url("messages"))
  }
}

struct ChatsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazdanChats", provider: SnapshotProvider()) { entry in
      ChatsView(entry: entry)
    }
    .configurationDisplayName(Gallery.chats)
    .description(Gallery.chatsDesc)
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
