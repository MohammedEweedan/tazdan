// The widget data contract — mirrors src/widgets/snapshot.ts. The app writes
// one JSON string into the shared App Group; nothing here holds a login token.

import Foundation
import WidgetKit

// The App Group follows the app's bundle ID ("com.tazdan.app.widgets" →
// "group.com.tazdan.app"), so the local iPhone test build uses its own group.
let appGroup: String = {
  let bundle = Bundle.main.bundleIdentifier ?? "com.tazdan.app.widgets"
  let app = bundle.hasSuffix(".widgets") ? String(bundle.dropLast(".widgets".count)) : bundle
  return "group." + app
}()
let snapshotKey = "tazdan.widgets.snapshot"
let maskedAmount = "••••"

struct WidgetLabels: Codable {
  let payments, send, receive, scan, topUp, noPayments, chats, noChats, unread, newMessage: String
  let assets, total, noAssets, updated, openApp: String
}

struct DisplayCurrency: Codable {
  let code: String
  let symbol: String
  var perUsd: Double
  let decimals: Int
  let symbolAfter: Bool
}

struct Holding: Codable, Identifiable {
  var id: String { code }
  let code: String
  let name: String
  let kind: String          // "crypto" | "fiat"
  let amount: Double
  var usdPrice: Double
  var change24hPct: Double?
}

struct Payment: Codable, Identifiable {
  let id: String
  let title: String
  let amountText: String
  let incoming: Bool
  let failed: Bool
  let pending: Bool
  let at: String
}

struct ChatRow: Codable, Identifiable {
  var id: String { partnerId }
  let partnerId: String
  let name: String
  let initial: String
  let preview: String
  let unread: Int
  let at: String
  let support: Bool
}

struct ChatSummary: Codable {
  let unread: Int
  let items: [ChatRow]
}

struct Snapshot: Codable {
  let v: Int
  let updatedAt: String
  let locale: String
  let apiBase: String
  let hidden: Bool
  let labels: WidgetLabels
  var display: DisplayCurrency
  var holdings: [Holding]
  let payments: [Payment]
  let chats: ChatSummary

  var totalUsd: Double { holdings.reduce(0) { $0 + $1.amount * $1.usdPrice } }
}

enum SnapshotStore {
  static func load() -> Snapshot? {
    guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey),
          let data = raw.data(using: .utf8),
          let s = try? JSONDecoder().decode(Snapshot.self, from: data),
          s.v == 1 else { return nil }
    return s
  }
}

// MARK: - Public price feeds (no account data)

private struct TickerFeed: Decodable {
  struct Ticker: Decodable { let base: String; let price: Double; let changePct24h: Double? }
  let tickers: [Ticker]
}

private struct FiatFeed: Decodable {
  struct Fiat: Decodable { let usd: Double; let perUsd: Double; let change24hPct: Double? }
  let currencies: [String: Fiat]
}

enum PriceFeed {
  private static func get<T: Decodable>(_ type: T.Type, _ url: String) async -> T? {
    guard let u = URL(string: url) else { return nil }
    var req = URLRequest(url: u)
    req.timeoutInterval = 8
    guard let (data, resp) = try? await URLSession.shared.data(for: req),
          (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }

  /// The snapshot with current prices; amounts never change. Nil when both
  /// feeds failed (the widget then keeps the app's last prices).
  static func refresh(_ s: Snapshot) async -> Snapshot? {
    async let tickers = get(TickerFeed.self, "\(s.apiBase)/markets/ticker")
    async let fiat = get(FiatFeed.self, "\(s.apiBase)/rates/live")
    let (t, f) = await (tickers, fiat)
    if t == nil && f == nil { return nil }
    let crypto = Dictionary((t?.tickers ?? []).map { ($0.base, $0) }, uniquingKeysWith: { a, _ in a })
    let fx = f?.currencies ?? [:]

    var out = s
    out.holdings = s.holdings.map { h in
      var h = h
      if h.kind == "crypto", let p = crypto[h.code], p.price > 0 {
        h.usdPrice = p.price; h.change24hPct = p.changePct24h
      } else if h.kind == "fiat", let p = fx[h.code], p.usd > 0 {
        h.usdPrice = p.usd; h.change24hPct = p.change24hPct
      }
      return h
    }
    if let d = fx[s.display.code], d.perUsd > 0 { out.display.perUsd = d.perUsd }
    else if let c = crypto[s.display.code], c.price > 0 { out.display.perUsd = 1 / c.price }
    return out
  }
}

// MARK: - Formatting (same rules as the app's useDisplayCurrency)

private func grouped(_ n: Double, min: Int, max: Int) -> String {
  let f = NumberFormatter()
  f.locale = Locale(identifier: "en_US")
  f.numberStyle = .decimal
  f.minimumFractionDigits = min
  f.maximumFractionDigits = max
  return f.string(from: NSNumber(value: n)) ?? String(n)
}

/// Money is always left-to-right, even with an Arabic symbol (د.ل). Without
/// the marks, digits after an Arabic letter join its right-to-left run and
/// "د.ل48.00" displays as "48.00د.ل".
private let lrm = "\u{200E}"

private func withSymbol(_ s: String, _ d: DisplayCurrency) -> String {
  d.symbolAfter ? "\(lrm)\(s) \(d.symbol)" : "\(lrm)\(d.symbol)\(lrm)\(s)"
}

func formatDisplay(_ usd: Double, _ d: DisplayCurrency) -> String {
  withSymbol(grouped(usd * d.perUsd, min: 2, max: d.decimals), d)
}

func formatPrice(_ usd: Double, _ d: DisplayCurrency) -> String {
  let n = usd * d.perUsd
  return withSymbol(grouped(n, min: 2, max: n >= 1 ? 2 : n >= 0.01 ? 4 : 8), d)
}

func formatChange(_ pct: Double?) -> String? {
  guard let pct, pct.isFinite else { return nil }
  let arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : ""
  return "\(arrow)\(String(format: "%.2f", abs(pct)))%"
}

/// A crypto price, or "$1 = 9.37 LYD" for a fiat holding.
func priceLine(_ h: Holding, _ d: DisplayCurrency) -> String {
  if h.kind == "crypto" { return formatPrice(h.usdPrice, d) }
  if h.code == "USD" || h.usdPrice <= 0 { return h.name }
  let perUsd = 1 / h.usdPrice
  return "$1 = \(grouped(perUsd, min: 0, max: perUsd >= 100 ? 0 : 2)) \(h.code)"
}

func parseDate(_ iso: String) -> Date? {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let d = f.date(from: iso) { return d }
  f.formatOptions = [.withInternetDateTime]
  return f.date(from: iso)
}

/// "14:32" today, "12 Oct" otherwise — in the app's language.
func clock(_ iso: String, _ locale: String) -> String {
  guard let d = parseDate(iso) else { return "" }
  let f = DateFormatter()
  f.locale = Locale(identifier: locale == "ar" ? "ar_LY" : "en_GB")
  f.setLocalizedDateFormatFromTemplate(Calendar.current.isDateInToday(d) ? "HH:mm" : "d MMM")
  return f.string(from: d)
}

// MARK: - Timeline

struct TazdanEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot?
  /// When prices were last refreshed by the widget itself.
  var pricesAt: Date? = nil
}

/// Payments and Chats: the app reloads these whenever it publishes.
struct SnapshotProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazdanEntry { TazdanEntry(date: .now, snapshot: SnapshotStore.load()) }
  func getSnapshot(in context: Context, completion: @escaping (TazdanEntry) -> Void) {
    completion(TazdanEntry(date: .now, snapshot: SnapshotStore.load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<TazdanEntry>) -> Void) {
    // Hourly re-read keeps "today" times right after midnight.
    completion(Timeline(entries: [TazdanEntry(date: .now, snapshot: SnapshotStore.load())],
                        policy: .after(.now.addingTimeInterval(3600))))
  }
}

/// Holdings: refreshes prices itself every 15 minutes (as WidgetKit allows).
struct PricesProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazdanEntry { TazdanEntry(date: .now, snapshot: SnapshotStore.load()) }
  func getSnapshot(in context: Context, completion: @escaping (TazdanEntry) -> Void) {
    completion(TazdanEntry(date: .now, snapshot: SnapshotStore.load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<TazdanEntry>) -> Void) {
    Task {
      let stored = SnapshotStore.load()
      var entry = TazdanEntry(date: .now, snapshot: stored)
      if let s = stored, !s.holdings.isEmpty, let fresh = await PriceFeed.refresh(s) {
        entry = TazdanEntry(date: .now, snapshot: fresh, pricesAt: .now)
      }
      completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
  }
}
