// "Scan to pay" from the Lock Screen and Control Center.
//
// Lock Screen (iOS 16+): a circular, rectangular or inline widget that opens
// the app's scanner (tazdan://scanner). Control Center / Lock Screen controls
// and the Action button (iOS 18+): a control that does the same.

import SwiftUI
import WidgetKit
import AppIntents

private let scannerURL = URL(string: "tazdan://scanner")!

struct ScanEntry: TimelineEntry { let date: Date }

struct ScanProvider: TimelineProvider {
  func placeholder(in context: Context) -> ScanEntry { ScanEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (ScanEntry) -> Void) { completion(ScanEntry(date: .now)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<ScanEntry>) -> Void) {
    completion(Timeline(entries: [ScanEntry(date: .now)], policy: .never))
  }
}

struct ScanWidgetView: View {
  @Environment(\.widgetFamily) private var family
  var entry: ScanEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryRectangular:
        HStack(spacing: 8) {
          Image(systemName: "qrcode.viewfinder").font(.system(size: 22, weight: .semibold))
          VStack(alignment: .leading, spacing: 1) {
            Text("Scan to pay").font(.headline).widgetAccentable()
            Text("tazdan").font(.caption).foregroundStyle(.secondary)
          }
        }
      case .accessoryInline:
        Label("Scan to pay", systemImage: "qrcode.viewfinder")
      default:
        ZStack {
          AccessoryWidgetBackground()
          Image(systemName: "qrcode.viewfinder").font(.system(size: 24, weight: .semibold)).widgetAccentable()
        }
      }
    }
    .widgetURL(scannerURL)
    .modifier(ScanContainerBackground())
  }
}

/// iOS 17 requires a container background; older systems ignore it.
private struct ScanContainerBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      content.containerBackground(for: .widget) { Color.clear }
    } else {
      content
    }
  }
}

struct ScanWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazdanScan", provider: ScanProvider()) { entry in
      ScanWidgetView(entry: entry)
    }
    .configurationDisplayName("Scan to pay")
    .description("Open the tazdan scanner from your Lock Screen.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

// MARK: - Control Center / Lock Screen control (iOS 18+)

@available(iOS 18.0, *)
struct OpenScannerIntent: AppIntent {
  static let title: LocalizedStringResource = "Scan to pay"
  static let description = IntentDescription("Open the tazdan scanner.")
  static let openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(scannerURL))
  }
}

@available(iOS 18.0, *)
struct ScanControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "TazdanScanControl") {
      ControlWidgetButton(action: OpenScannerIntent()) {
        Label("Scan to pay", systemImage: "qrcode.viewfinder")
      }
    }
    .displayName("Scan to pay")
    .description("Open the tazdan scanner.")
  }
}
