import SwiftUI

struct YearCalendarView: View {
    let model: WindowModel
    let index: CalendarItemIndex
    @State private var months: [YearMonthDates] = []
    @State private var markedDates: Set<String> = []

    private var projectionInput: YearCalendarInput {
        YearCalendarInput(
            date: model.selectedDate,
            weekStartsOn: model.calendarWeekStartsOn,
            timeZone: model.preferences.timeZone,
            indexID: index.id
        )
    }

    var body: some View {
        let todayDate = TodayView.currentDate(timeZone: model.preferences.timeZone)

        return ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 205, maximum: 275), spacing: 18)], alignment: .leading, spacing: 18) {
                ForEach(months) { month in
                    YearMonthGrid(model: model, month: month.month, dates: month.dates, markedDates: markedDates, todayDate: todayDate)
                }
            }
            .padding(22)
            .frame(maxWidth: 1120, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .onAppear { updateProjection(projectionInput) }
        .onChange(of: projectionInput) { _, input in updateProjection(input) }
    }

    private func updateProjection(_ input: YearCalendarInput) {
        let monthDates = CalendarProjection.dates(for: .year, around: input.date, timeZone: input.timeZone)
        let months = monthDates.map { month in
            YearMonthDates(month: month, dates: TodayProjection.monthGrid(around: month, weekStartsOn: input.weekStartsOn, timeZone: input.timeZone))
        }
        self.months = months
        markedDates = index.visibleDates(in: months.flatMap(\.dates))
    }
}

private struct YearMonthGrid: View {
    let model: WindowModel
    let month: String
    let dates: [String]
    let markedDates: Set<String>
    let todayDate: String
    @State private var titleHovered = false

    private var title: String {
        guard let monthNumber = Int(month.dropFirst(5).prefix(2)) else { return month }
        return "\(monthNumber)월"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                model.selectedDate = month
                model.calendarViewMode = .month
            } label: {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(height: 24, alignment: .leading)
                    .background(titleHovered ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
            .onHover { titleHovered = $0 }
            .help("\(month.prefix(4))년 \(title) 보기")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 4) {
                ForEach(weekdayLabels, id: \.self) { label in
                    Text(label)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(maxWidth: .infinity, minHeight: 16, maxHeight: 16)
                }
                ForEach(dates, id: \.self) { date in
                    if date.hasPrefix(String(month.prefix(7))) {
                        let hasItems = markedDates.contains(date)
                        Button {
                            model.selectedDate = date
                            model.calendarViewMode = .day
                        } label: {
                            VStack(spacing: 1) {
                                Text(String(Int(date.suffix(2)) ?? 0))
                                    .font(.system(size: 11, weight: date == model.selectedDate ? .semibold : .regular, design: .rounded))
                                Circle().fill(hasItems ? Theme.accent : .clear).frame(width: 2.5, height: 2.5)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 24)
                        }
                        .buttonStyle(
                            CalendarDateButtonStyle(
                                selected: date == model.selectedDate, today: date == todayDate)
                        )
                        .accessibilityLabel(date)
                        .accessibilityAddTraits(date == model.selectedDate ? .isSelected : [])
                    } else {
                        Color.clear.frame(height: 24).accessibilityHidden(true)
                    }
                }
            }
        }
        .padding(12)
        .frame(height: 244, alignment: .topLeading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.separator, lineWidth: 1))
    }

    private var weekdayLabels: [String] {
        let labels = ["일", "월", "화", "수", "목", "금", "토"]
        return model.calendarWeekStartsOn == 0 ? labels : Array(labels[1...]) + [labels[0]]
    }
}

private struct YearCalendarInput: Equatable {
    let date: String
    let weekStartsOn: Int
    let timeZone: String
    let indexID: UUID
}

private struct YearMonthDates: Identifiable {
    let month: String
    let dates: [String]
    var id: String { month }
}
