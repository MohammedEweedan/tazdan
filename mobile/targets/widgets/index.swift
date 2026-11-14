import SwiftUI
import WidgetKit

@main
struct TazdanWidgetBundle: WidgetBundle {
  var body: some Widget {
    PaymentsWidget()
    ChatsWidget()
    HoldingsWidget()
    ScanWidget()
    if #available(iOSApplicationExtension 18.0, *) {
      ScanControl()
    }
  }
}
