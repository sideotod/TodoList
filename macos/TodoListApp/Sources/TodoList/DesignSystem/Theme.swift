import SwiftUI

/// Shared v4 surface and accent colors. Content surfaces stay warm and neutral;
/// selection uses the soft sage accent visible in the design reference.
enum Theme {
    static let accent = Color(red: 0.40, green: 0.53, blue: 0.43)
    static let sageSelection = Color(red: 0.90, green: 0.94, blue: 0.90)
    static let canvas = Color(nsColor: .windowBackgroundColor)
    static let card = Color(nsColor: .controlBackgroundColor)
    static let separator = Color(nsColor: .separatorColor)
}
