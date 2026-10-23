import SwiftUI

struct CalendarView: View {
    let model: AppModel
    let repository: any ItemRepository

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                pageHeading
                    .padding(.horizontal, pageInset(geometry.size.width))
                    .padding(.top, 31)
                    .padding(.bottom, 23)
                HStack(alignment: .center) {
                    Text(periodTitle)
                        .font(.system(size: 16, weight: .semibold))
                        .tracking(-0.3)
                    Spacer(minLength: 20)
                    layerLegend
                }
                .padding(.horizontal, pageInset(geometry.size.width))
                .padding(.bottom, 14)
                Group {
                    switch model.calendarViewMode {
                    case .day:
                        DayCalendarView(model: model, items: calendarItems)
                    case .week:
                        WeekCalendarView(model: model, items: calendarItems)
                    case .month:
                        MonthCalendarView(model: model, items: calendarItems)
                    case .year:
                        YearCalendarView(model: model, items: calendarItems)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Theme.canvas)
        }
    }

    private var calendarItems: [CalendarItem] {
        model.visibleItems
    }

    private var pageHeading: some View {
        HStack(alignment: .bottom, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("YOUR SCHEDULE")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(Color(red: 0.61, green: 0.66, blue: 0.61))
                Text("캘린더")
                    .font(.system(size: 34, weight: .semibold))
                    .tracking(-1.4)
            }
            Spacer(minLength: 8)
            HStack(spacing: 10) {
                HStack(spacing: 4) {
                    Button { moveDate(-1) } label: { Image(systemName: "chevron.left") }
                        .accessibilityLabel("이전 기간")
                    Button { moveDate(1) } label: { Image(systemName: "chevron.right") }
                        .accessibilityLabel("다음 기간")
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color(red: 0.58, green: 0.64, blue: 0.59))
                Button("오늘") {
                    model.selectedDate = TodayProjection.localDate(
                        ISO8601DateFormatter.todoListTimestamp(),
                        zone: model.preferences.timeZone
                    ) ?? model.selectedDate
                }
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color(red: 0.49, green: 0.55, blue: 0.50))
                .padding(.horizontal, 10)
                .frame(height: 27)
                .background(.white, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.separator, lineWidth: 1))
                HStack(spacing: 3) {
                    ForEach(CalendarViewMode.allCases) { mode in
                        Button {
                            model.calendarViewMode = mode
                        } label: {
                            Text(modeTitle(mode))
                                .font(.system(size: 10, weight: model.calendarViewMode == mode ? .semibold : .regular))
                                .foregroundStyle(model.calendarViewMode == mode ? Color(red: 0.28, green: 0.38, blue: 0.31) : Color(red: 0.58, green: 0.63, blue: 0.58))
                                .frame(width: 33, height: 27)
                                .background(model.calendarViewMode == mode ? .white : .clear, in: RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .background(Color(red: 0.94, green: 0.95, blue: 0.93), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private var layerLegend: some View {
        HStack(spacing: 17) {
            layerButton("일정", color: Theme.accent, keyPath: \.calendarVisibility.events)
            layerButton("할 일", color: Color(red: 0.80, green: 0.62, blue: 0.38), keyPath: \.calendarVisibility.tasks)
            layerButton("마감·시작", color: Color(red: 0.72, green: 0.54, blue: 0.60), keyPath: \.calendarVisibility.progress)
        }
    }

    private var periodTitle: String {
        guard let date = TodayProjection.parseDate(model.selectedDate, timeZone: model.preferences.timeZone) else { return model.selectedDate }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        switch model.calendarViewMode {
        case .day: formatter.dateFormat = "yyyy년 M월 d일 EEEE"
        case .week: formatter.dateFormat = "yyyy년 M월"
        case .month: formatter.dateFormat = "yyyy년 M월"
        case .year: formatter.dateFormat = "yyyy년"
        }
        return formatter.string(from: date)
    }

    private func layerButton(_ title: String, color: Color, keyPath: WritableKeyPath<AppPreferences, Bool>) -> some View {
        let isVisible = model.preferences[keyPath: keyPath]
        return Button {
            model.updatePreferences { $0[keyPath: keyPath].toggle() }
        } label: {
            HStack(spacing: 6) {
                Circle().fill(color).frame(width: 7, height: 7)
                Text(title).font(.system(size: 9))
            }
            .foregroundStyle(Color(red: 0.58, green: 0.63, blue: 0.58))
            .opacity(isVisible ? 1 : 0.38)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title) \(isVisible ? "표시 중" : "숨김")")
    }

    private func modeTitle(_ mode: CalendarViewMode) -> String {
        switch mode {
        case .day: "일"
        case .week: "주"
        case .month: "월"
        case .year: "년"
        }
    }

    private func pageInset(_ width: CGFloat) -> CGFloat {
        min(64, max(30, width * 0.05))
    }

    private func moveDate(_ amount: Int) {
        model.selectedDate = CalendarProjection.move(
            model.selectedDate,
            mode: model.calendarViewMode,
            by: amount,
            timeZone: model.preferences.timeZone
        )
    }

}

struct CalendarItemButton: View {
    let item: CalendarItem
    let compact: Bool
    let action: () -> Void

    private var color: Color {
        switch item.kind {
        case .task:
            Color(red: 0.80, green: 0.62, blue: 0.38)
        case .event:
            Theme.accent
        case .deadline, .window:
            Color(red: 0.72, green: 0.54, blue: 0.60)
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 5) {
                RoundedRectangle(cornerRadius: 1).fill(color).frame(width: 3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: compact ? 9 : 11, weight: .medium))
                        .lineLimit(compact ? 1 : 2)
                        .multilineTextAlignment(.leading)
                    if !compact, let label = timeLabel {
                        Text(label).font(.system(size: 9)).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, compact ? 2 : 5)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, minHeight: compact ? 18 : 28, alignment: .leading)
            .background(color.opacity(0.09), in: RoundedRectangle(cornerRadius: 4))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(item.title)
    }

    private var timeLabel: String? {
        guard case let .time(startAt, endAt, zone) = item.timing else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = "HH:mm"
        let start = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:)).map(formatter.string(from:))
        let end = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:)).map(formatter.string(from:))
        if let start, let end { return "\(start)–\(end)" }
        return start ?? end
    }
}
