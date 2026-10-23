import SwiftUI

struct MonthCalendarView: View {
    let model: AppModel
    let items: [CalendarItem]

    private var dates: [String] {
        CalendarProjection.dates(
            for: .month,
            around: model.selectedDate,
            timeZone: model.preferences.timeZone,
            weekStartsOn: model.preferences.weekStartsOn
        )
    }

    var body: some View {
        GeometryReader { geometry in
            let cellHeight = max(76, (geometry.size.height - 44) / 6)
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(weekdayLabels, id: \.self) { label in
                        Text(label)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, minHeight: 32)
                    }
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
                    ForEach(dates, id: \.self) { date in
                        monthCell(date)
                            .frame(maxWidth: .infinity, minHeight: cellHeight, maxHeight: cellHeight, alignment: .topLeading)
                    }
                }
                .overlay(alignment: .top) { Rectangle().fill(Theme.separator).frame(height: 1) }
            }
            .padding(.horizontal, 15)
            .padding(.bottom, 12)
        }
    }

    private func monthCell(_ date: String) -> some View {
        let currentMonth = String(date.prefix(7)) == String(model.selectedDate.prefix(7))
        let today = date == TodayProjection.localDate(ISO8601DateFormatter.todoListTimestamp(), zone: model.preferences.timeZone)
        let selected = date == model.selectedDate
        let dayItems = CalendarProjection.visibleItems(
            on: date,
            items: items,
            layers: model.preferences.calendarVisibility,
            timeZone: model.preferences.timeZone,
            taskOrder: model.preferences.taskOrders[date]
        )

        return ZStack(alignment: .topLeading) {
            Button {
                model.requestCreateItem(kind: .event, context: ItemEditorContext(dateOnly: date, startInstant: nil, timeZone: model.preferences.timeZone))
            } label: {
                Color.clear.contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(date)에 종일 일정 추가")

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Button {
                        model.selectedDate = date
                        model.calendarViewMode = .day
                    } label: {
                        Text(String(Int(date.suffix(2)) ?? 0))
                            .font(.system(size: 11, weight: today || selected ? .semibold : .regular, design: .rounded))
                            .foregroundStyle(selected ? Color.white : today ? Theme.accent : currentMonth ? Color.primary : Color.secondary.opacity(0.42))
                            .frame(width: 23, height: 22)
                            .background(selected ? Theme.accent : Color.clear, in: Circle())
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                    if dayItems.count > 3 {
                        Button("+\(dayItems.count - 3)") {
                            model.selectedDate = date
                            model.calendarViewMode = .day
                        }
                        .buttonStyle(.plain)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.accent)
                        .help("이 날의 나머지 항목 보기")
                    }
                }
                ForEach(dayItems.prefix(3)) { item in
                    CalendarItemButton(item: item, compact: true) { model.selectItem(item.id) }
                        .frame(height: 18)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 5)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(selected ? Theme.sageSelection.opacity(0.55) : Theme.canvas)
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.separator.opacity(0.75)).frame(width: 0.5) }
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.separator.opacity(0.75)).frame(height: 0.5) }
    }

    private var weekdayLabels: [String] {
        let labels = ["일", "월", "화", "수", "목", "금", "토"]
        return model.preferences.weekStartsOn == 0 ? labels : Array(labels[1...]) + [labels[0]]
    }
}
