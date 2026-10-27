import AppKit
import SwiftUI

/// Semantic v4 surfaces. The light palette stays faithful to the reference while
/// system appearance changes receive a separate, legible dark palette.
@MainActor
enum Theme {
    static private(set) var colorTheme = "sage"

    static var accent: Color {
        switch colorTheme {
        case "arctic", "apple-blue": adaptive(light: (0.27, 0.49, 0.62), dark: (0.54, 0.76, 0.90))
        case "rose": adaptive(light: (0.69, 0.39, 0.47), dark: (0.87, 0.61, 0.68))
        case "amber": adaptive(light: (0.71, 0.55, 0.30), dark: (0.91, 0.75, 0.47))
        default: adaptive(light: (0.20, 0.40, 0.32), dark: (0.52, 0.74, 0.58))
        }
    }

    static let blue = Color(red: 0.28, green: 0.51, blue: 0.64)
    static let sage = adaptive(light: (0.20, 0.40, 0.32), dark: (0.52, 0.74, 0.58))
    static let sageSelection = adaptive(light: (0.89, 0.92, 0.89), dark: (0.22, 0.30, 0.25))
    static let sidebar = adaptive(light: (0.957, 0.961, 0.949), dark: (0.135, 0.145, 0.137))
    static var rowHover: Color { accent.opacity(0.09) }
    static let titlebar = adaptive(light: (0.980, 0.984, 0.976), dark: (0.15, 0.16, 0.15))
    static let ribbon = adaptive(light: (0.961, 0.969, 0.949), dark: (0.18, 0.205, 0.185))
    static let canvas = adaptive(light: (0.996, 0.996, 0.988), dark: (0.105, 0.112, 0.106))
    static let card = adaptive(light: (1, 1, 1), dark: (0.15, 0.16, 0.15))
    static let control = adaptive(light: (1, 1, 1), dark: (0.19, 0.20, 0.19))
    static let separator = adaptive(light: (0.91, 0.92, 0.90), dark: (0.27, 0.29, 0.27))
    static let primaryText = adaptive(light: (0.16, 0.20, 0.17), dark: (0.91, 0.93, 0.91))
    static let secondaryText = adaptive(light: (0.38, 0.43, 0.39), dark: (0.70, 0.74, 0.70))
    static let tertiaryText = adaptive(light: (0.52, 0.57, 0.52), dark: (0.61, 0.66, 0.61))
    static let faintText = adaptive(light: (0.62, 0.66, 0.62), dark: (0.52, 0.57, 0.52))

    static func apply(colorTheme: String) {
        self.colorTheme = colorTheme
    }

    static func categoryColor(_ value: String) -> Color {
        switch value {
        case "sage": sage
        case "teal": Color(red: 0.27, green: 0.57, blue: 0.54)
        case "amber": Color(red: 0.71, green: 0.55, blue: 0.30)
        case "blue", "arctic", "apple-blue": blue
        case "violet": Color(red: 0.47, green: 0.40, blue: 0.65)
        case "coral": Color(red: 0.72, green: 0.40, blue: 0.35)
        case "rose": Color(red: 0.69, green: 0.39, blue: 0.47)
        default:
            if value.hasPrefix("#"), value.count == 7, let rgb = UInt32(value.dropFirst(), radix: 16) {
                Color(red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255)
            } else { sage }
        }
    }

    private static func adaptive(light: (CGFloat, CGFloat, CGFloat), dark: (CGFloat, CGFloat, CGFloat)) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let palette = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
            return NSColor(calibratedRed: palette.0, green: palette.1, blue: palette.2, alpha: 1)
        })
    }
}
