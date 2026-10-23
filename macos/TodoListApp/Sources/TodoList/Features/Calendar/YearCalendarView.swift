import SwiftUI

struct YearCalendarView: View {
    let model: AppModel
    let items: [CalendarItem]

    private var monthDates: [String] {
        CalendarProjection.dates(for: .year, around: model.selectedDate, timeZone: model.preferences.timeZone)
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 205, maximum: 275), spacing: 18)], alignment: .leading, spacing: 22) {
                ForEach(monthDates, id: \.self) { month in
                    YearMonthGrid(model: model, month: month, items: items)
                }
            }
            .padding(22)
            .frame(maxWidth: 1120, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }
}

private struct YearMonthGrid: View {
    let model: AppModel
    let month: String
    let items: [CalendarItem]

    private var dates: [String] {
        TodayProjection.monthGrid(around: month, weekStartsOn: model.preferences.weekStartsOn, timeZone: model.preferences.timeZone)
            .filter { $0.hasPrefix(String(month.prefix(7))) }
    }

    private var title: String {
        guard let date = TodayProjection.parseDate(month, timeZone: model.preferences.timeZone) else { return month }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        formatter.dateFormat = "M월"
        return formatter.string(from: date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Button {
                model.selectedDate = month
                model.calendarViewMode = .month
            } label: {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }
            .buttonStyle(.plain)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 4) {
                ForEach(weekdayLabels, id: \.self) { label in
                    Text(label)
                        .font(.system(size: 8, weight: .medium))
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity)
                }
                ForEach(dates, id: \.self) { date in
                    let hasItems = !CalendarProjection.visibleItems(on: date, items: items, layers: model.preferences.calendarVisibility, timeZone: model.preferences.timeZone).isEmpty
                    Button {
                        model.selectedDate = date
                        model.calendarViewMode = .month
                    } label: {
                        VStack(spacing: 1) {
                            Text(String(Int(date.suffix(2)) ?? 0))
                                .font(.system(size: 9, weight: date == model.selectedDate ? .semibold : .regular, design: .rounded))
                            Circle().fill(hasItems ? Theme.accent : .clear).frame(width: 2.5, height: 2.5)
                        }
                        .foregroundStyle(date == model.selectedDate ? Theme.accent : Color.primary.opacity(0.8))
                        .frame(maxWidth: .infinity, minHeight: 19)
                        .background(date == model.selectedDate ? Theme.sageSelection : .clear, in: RoundedRectangle(cornerRadius: 4))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(date)
                }
            }
        }
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.separator, lineWidth: 1))
    }

    private var weekdayLabels: [String] {
        let labels = ["일", "월", "화", "수", "목", "금", "토"]
        return model.preferences.weekStartsOn == 0 ? labels : Array(labels[1...]) + [labels[0]]
    }
}
