import SwiftUI

/// Shared v4 surface and accent colors. Content surfaces stay warm and neutral;
/// selection uses the soft sage accent visible in the design reference.
@MainActor
enum Theme {
    static private(set) var colorTheme = "sage"
    static var accent: Color {
        switch colorTheme {
        case "arctic", "apple-blue": Color(red: 0.27, green: 0.49, blue: 0.62)
        case "rose": Color(red: 0.69, green: 0.39, blue: 0.47)
        case "amber": Color(red: 0.71, green: 0.55, blue: 0.30)
        default: Color(red: 0.20, green: 0.40, blue: 0.32)
        }
    }
    static let blue = Color(red: 0.28, green: 0.51, blue: 0.64)
    static let sageSelection = Color(red: 0.89, green: 0.92, blue: 0.89)
    static let sidebar = Color(red: 0.957, green: 0.961, blue: 0.949)
    static let titlebar = Color(red: 0.980, green: 0.984, blue: 0.976)
    static let ribbon = Color(red: 0.961, green: 0.969, blue: 0.949)
    static let canvas = Color(red: 0.996, green: 0.996, blue: 0.988)
    static let card = Color.white
    static let separator = Color(red: 0.91, green: 0.92, blue: 0.90)

    static func apply(colorTheme: String) {
        self.colorTheme = colorTheme
    }
}
