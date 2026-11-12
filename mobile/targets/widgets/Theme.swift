// The app's palette (store/themeStore.ts): charcoal dark mode — not black —
// and paper light mode; navy accent used sparingly.

import SwiftUI
import WidgetKit

extension Color {
  init(hex: UInt32, alpha: Double = 1) {
    self.init(.sRGB,
              red: Double((hex >> 16) & 0xFF) / 255,
              green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255,
              opacity: alpha)
  }
}

struct Palette {
  let bg, fg, fgMuted, fgFaint, pill, green, red, accent, accentFg: Color

  static func of(_ scheme: ColorScheme) -> Palette {
    scheme == .dark
      ? Palette(bg: Color(hex: 0x16181C), fg: Color(hex: 0xF4F5F7), fgMuted: Color(hex: 0xAEB6C3),
                fgFaint: Color(hex: 0x8C96A6), pill: Color(hex: 0xFFFFFF, alpha: 0.07),
                green: Color(hex: 0x3FCF8E), red: Color(hex: 0xF87171),
                accent: Color(hex: 0x24384F), accentFg: .white)
      : Palette(bg: Color(hex: 0xF6F7FA), fg: Color(hex: 0x0A0A0B), fgMuted: Color(hex: 0x586579),
                fgFaint: Color(hex: 0x697589), pill: Color(hex: 0x0A0A0B, alpha: 0.06),
                green: Color(hex: 0x1F8F58), red: Color(hex: 0xC0272D),
                accent: Color(hex: 0x24384F), accentFg: .white)
  }
}

extension View {
  /// The widget surface: containerBackground on iOS 17+, padded fill before.
  @ViewBuilder func widgetSurface(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      self.containerBackground(color, for: .widget)
    } else {
      self.padding(16).background(color)
    }
  }
}

/// Uppercase muted caption + optional right-hand note, like the app's
/// section labels.
struct WidgetHeader: View {
  let p: Palette
  let title: String
  var right: String? = nil

  var body: some View {
    HStack(spacing: 6) {
      Text(title.uppercased())
        .font(.system(size: 11, weight: .semibold))
        .tracking(0.6)
        .foregroundStyle(p.fgMuted)
      Spacer(minLength: 4)
      if let right {
        Text(right).font(.system(size: 10, weight: .medium)).foregroundStyle(p.fgFaint)
      }
    }
  }
}

struct EmptyNote: View {
  let p: Palette
  let text: String
  var body: some View {
    Text(text)
      .font(.system(size: 13, weight: .medium))
      .foregroundStyle(p.fgMuted)
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

/// Signed out, or the app has not written a snapshot yet.
struct SignedOut: View {
  let p: Palette
  var body: some View {
    EmptyNote(p: p, text: Locale.preferredLanguages.first?.hasPrefix("ar") == true
      ? "افتح tazdan لإعداد هذه الأداة"
      : "Open tazdan to set up this widget")
  }
}

/// Widget gallery names, in the device language.
enum Gallery {
  static var ar: Bool { Locale.preferredLanguages.first?.hasPrefix("ar") == true }
  static var payments: String { ar ? "المدفوعات" : "Payments" }
  static var paymentsDesc: String { ar ? "أرسل واستلم وامسح، وآخر مدفوعاتك." : "Send, receive, scan to pay — and your latest payments." }
  static var chats: String { ar ? "المحادثات" : "Chats" }
  static var chatsDesc: String { ar ? "الرسائل غير المقروءة وأحدث المحادثات." : "Unread messages and your latest conversations." }
  static var holdings: String { ar ? "الأسعار وأصولك" : "Prices & holdings" }
  static var holdingsDesc: String { ar ? "أسعار العملات والعملات الرقمية التي تملكها، محدّثة تلقائياً." : "Live prices of the crypto and currencies you hold." }
}

func url(_ path: String) -> URL { URL(string: "tazdan://\(path)")! }
