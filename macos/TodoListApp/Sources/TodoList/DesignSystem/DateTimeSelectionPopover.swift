import SwiftUI

struct DateTimeSelectionField: View {
    let title: String
    let showsTime: Bool
    let calendar: Calendar
    let weekStartsOn: Int
    let timeFormat: String
    @Binding var date: Date

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            HStack(spacing: 8) {
                Text(formattedDate)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "calendar")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.tertiaryText)
            }
            .font(.system(size: 12))
            .foregroundStyle(Theme.primaryText)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 34)
            .background(Theme.control, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(Theme.separator, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(PopoverFieldButtonStyle())
        .accessibilityLabel(title)
        .accessibilityValue(isPresented ? "\(formattedDate), 달력 열림" : formattedDate)
        .overlay {
            DateTimeSelectionPanelHost(
                isPresented: $isPresented,
                date: $date,
                showsTime: showsTime,
                calendar: calendar,
                weekStartsOn: weekStartsOn,
                timeFormat: timeFormat
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .allowsHitTesting(false)
        }
    }

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: timeFormat == "12h" ? "ko_KR@hours=h12" : "ko_KR@hours=h23")
        formatter.dateFormat = showsTime
            ? (timeFormat == "12h" ? "yyyy.MM.dd. a h:mm" : "yyyy.MM.dd. HH:mm")
            : "yyyy.MM.dd. EEE"
        return formatter.string(from: date)
    }
}

struct DateTimeSelectionPopover: View {
    @Binding var date: Date
    let showsTime: Bool
    let calendar: Calendar
    let weekStartsOn: Int
    let timeFormat: String

    @State private var displayedMonth: Date
    @State private var repeatedTimePolicy: Calendar.RepeatedTimePolicy

    private enum DayHalf: String, CaseIterable, Hashable {
        case am
        case pm

        var title: String { self == .am ? "오전" : "오후" }
    }

    private let weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    private let columns = Array(repeating: GridItem(.fixed(32), spacing: 4), count: 7)

    init(date: Binding<Date>, showsTime: Bool, calendar: Calendar, weekStartsOn: Int, timeFormat: String) {
        self._date = date
        self.showsTime = showsTime
        self.calendar = calendar
        self.weekStartsOn = weekStartsOn
        self.timeFormat = timeFormat
        self._displayedMonth = State(initialValue: calendar.dateInterval(of: .month, for: date.wrappedValue)?.start ?? date.wrappedValue)
        self._repeatedTimePolicy = State(initialValue: EditorDateTime.occurrencePolicy(for: date.wrappedValue, calendar: calendar))
    }

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                monthButton("chevron.left", title: "이전 달", amount: -1)
                Text(monthTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.primaryText)
                    .frame(maxWidth: .infinity)
                monthButton("chevron.right", title: "다음 달", amount: 1)
            }
            HStack(spacing: 4) {
                ForEach(orderedWeekdays, id: \.self) { weekday in
                    Text(weekday)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: 32, height: 20)
                }
            }
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(EditorCalendarGrid.dates(in: displayedMonth, weekStartsOn: weekStartsOn, calendar: calendar), id: \.self) { day in
                    dateButton(day)
                }
            }
            if showsTime {
                Rectangle().fill(Theme.separator).frame(height: 1)
                HStack(spacing: 6) {
                    Label("시간", systemImage: "clock")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.secondaryText)
                    Spacer()
                    if timeFormat == "12h" {
                        PopoverSelectionField(title: "오전 또는 오후", choices: halfChoices, selection: halfBinding)
                            .frame(width: 68)
                    }
                    PopoverSelectionField(title: "시", choices: hourChoices, selection: hourBinding)
                        .frame(width: timeFormat == "12h" ? 56 : 64)
                    Text(":")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.secondaryText)
                    PopoverSelectionField(title: "분", choices: minuteChoices, selection: minuteBinding)
                        .frame(width: timeFormat == "12h" ? 56 : 64)
                }
            }
        }
        .padding(12)
        .frame(width: 292)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.separator, lineWidth: 1))
        .environment(\.calendar, calendar)
        .environment(\.timeZone, calendar.timeZone)
        .environment(\.locale, Locale(identifier: timeFormat == "12h" ? "ko_KR@hours=h12" : "ko_KR@hours=h23"))
        .onChange(of: date) { _, newDate in
            if !calendar.isDate(newDate, equalTo: displayedMonth, toGranularity: .month) {
                displayedMonth = calendar.dateInterval(of: .month, for: newDate)?.start ?? newDate
            }
        }
    }

    private var orderedWeekdays: [String] {
        let start = ((weekStartsOn % 7) + 7) % 7
        return Array(weekdays[start...]) + Array(weekdays[..<start])
    }

    private var hourChoices: [PopoverChoice<Int>] {
        let hours = timeFormat == "12h" ? Array(1...12) : Array(0...23)
        return hours.map { PopoverChoice(value: $0, title: String(format: "%02d", $0)) }
    }

    private var minuteChoices: [PopoverChoice<Int>] {
        (0...59).map { PopoverChoice(value: $0, title: String(format: "%02d", $0)) }
    }

    private var halfChoices: [PopoverChoice<DayHalf>] {
        DayHalf.allCases.map { PopoverChoice(value: $0, title: $0.title) }
    }

    private var hourBinding: Binding<Int> {
        Binding(
            get: {
                let hour = calendar.component(.hour, from: date)
                return timeFormat == "12h" ? (hour + 11) % 12 + 1 : hour
            },
            set: { updateTime(displayHour: $0) }
        )
    }

    private var minuteBinding: Binding<Int> {
        Binding(
            get: { calendar.component(.minute, from: date) },
            set: { updateTime(minute: $0) }
        )
    }

    private var halfBinding: Binding<DayHalf> {
        Binding(
            get: { calendar.component(.hour, from: date) < 12 ? .am : .pm },
            set: { updateTime(half: $0) }
        )
    }

    private func updateTime(displayHour: Int? = nil, minute: Int? = nil, half: DayHalf? = nil) {
        let currentHour = calendar.component(.hour, from: date)
        let currentDisplayHour = timeFormat == "12h" ? (currentHour + 11) % 12 + 1 : currentHour
        let selectedDisplayHour = displayHour ?? currentDisplayHour
        let selectedHalf = half ?? (currentHour < 12 ? .am : .pm)
        let hour = timeFormat == "12h"
            ? selectedDisplayHour % 12 + (selectedHalf == .pm ? 12 : 0)
            : selectedDisplayHour
        let minute = minute ?? calendar.component(.minute, from: date)
        date = EditorDateTime.settingTime(
            on: date,
            hour: hour,
            minute: minute,
            second: calendar.component(.second, from: date),
            preservingOccurrenceOf: date,
            calendar: calendar,
            repeatedTimePolicy: repeatedTimePolicy
        ) ?? date
    }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        return formatter.string(from: displayedMonth)
    }

    private func monthButton(_ symbol: String, title: String, amount: Int) -> some View {
        Button {
            displayedMonth = calendar.date(byAdding: .month, value: amount, to: displayedMonth) ?? displayedMonth
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.secondaryText)
                .frame(width: 26, height: 26)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private func dateButton(_ day: Date) -> some View {
        let selected = calendar.isDate(day, inSameDayAs: date)
        let today = calendar.isDateInToday(day)
        let currentMonth = calendar.isDate(day, equalTo: displayedMonth, toGranularity: .month)
        return Button {
            let parts = calendar.dateComponents([.hour, .minute, .second], from: date)
            date = EditorDateTime.settingTime(
                on: day,
                hour: parts.hour ?? 0,
                minute: parts.minute ?? 0,
                second: parts.second ?? 0,
                preservingOccurrenceOf: date,
                calendar: calendar,
                repeatedTimePolicy: repeatedTimePolicy
            ) ?? day
        } label: {
            Text(String(calendar.component(.day, from: day)))
                .font(.system(size: 11, weight: selected || today ? .semibold : .regular))
                .opacity(currentMonth ? 1 : 0.38)
                .frame(width: 32, height: 32)
        }
        .buttonStyle(CalendarDateButtonStyle(selected: selected, today: today))
        .accessibilityLabel(accessibilityDate(day))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func accessibilityDate(_ day: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월 d일 EEEE"
        return formatter.string(from: day)
    }
}
