import SwiftUI

struct ItemEditorView: View {
    let initialItem: CalendarItem?
    let defaultKind: ItemKind
    let context: ItemEditorContext
    let repository: any ItemRepository
    let onSaved: (CalendarItem) -> Void
    let onCancel: () -> Void

    @State private var draft: ItemEditorDraft
    @State private var availableTasks: [CalendarItem] = []
    @State private var errorMessage: String?
    @State private var saving = false

    init(
        initialItem: CalendarItem?,
        defaultKind: ItemKind,
        context: ItemEditorContext,
        repository: any ItemRepository,
        onSaved: @escaping (CalendarItem) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.initialItem = initialItem
        self.defaultKind = defaultKind
        self.context = context
        self.repository = repository
        self.onSaved = onSaved
        self.onCancel = onCancel
        _draft = State(initialValue: ItemEditorDraft(item: initialItem, defaultKind: defaultKind, context: context))
    }

    var body: some View {
        VStack(spacing: 0) {
            Form {
                Section("항목") {
                    TextField("제목", text: $draft.title)
                    Picker("종류", selection: $draft.kind) {
                        Text("일정").tag(ItemKind.event)
                        Text("할 일").tag(ItemKind.task)
                        Text("마감형 Progress").tag(ItemKind.deadline)
                        Text("기간형 Progress").tag(ItemKind.window)
                    }
                    TextField("카테고리", text: $draft.category)
                    Picker("카테고리 색상", selection: $draft.categoryColor) {
                        ForEach(Self.categoryColors, id: \.id) { color in
                            Text(color.title).tag(color.id)
                        }
                    }
                    if draft.kind != .event {
                        Picker("완료 상태", selection: $draft.completion) {
                            Text("진행 중").tag(ItemCompletion.pending)
                            Text("완료").tag(ItemCompletion.completed)
                        }
                    }
                }

                Section("날짜 및 시간") {
                    Picker("입력 방식", selection: $draft.timingMode) {
                        ForEach(ItemTimingMode.allCases) { mode in Text(mode.title).tag(mode) }
                    }
                    if draft.timingMode != .unscheduled {
                        TextField("시간대", text: $draft.timeZone)
                        timingFields
                    }
                }

                if draft.kind == .deadline || draft.kind == .window {
                    Section("준비 작업") {
                        ForEach($draft.checklist) { $row in
                            VStack(alignment: .leading, spacing: 7) {
                                HStack {
                                    Toggle("완료", isOn: $row.completed)
                                        .labelsHidden()
                                    TextField("준비 작업", text: $row.title)
                                    Button(role: .destructive) {
                                        draft.checklist.removeAll { $0.id == row.id }
                                    } label: {
                                        Image(systemName: "minus.circle")
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("준비 작업 삭제")
                                }
                                Picker("연결된 할 일", selection: linkedTaskSelection(for: $row)) {
                                    Text("연결 안 함").tag("")
                                    ForEach(availableTasks.filter { $0.id != draft.id && $0.deletedAt == nil }, id: \.id) { task in
                                        Text(task.title).tag(task.id)
                                    }
                                }
                            }
                        }
                        if draft.checklist.count < 4 {
                            Button("준비 작업 추가", systemImage: "plus") {
                                draft.checklist.append(ChecklistRow(id: UUID().uuidString.lowercased(), title: "", completed: false, linkedTaskId: nil))
                            }
                        }
                        if draft.kind == .window || draft.hasPeriodStart {
                            Toggle("시작 카운트다운", isOn: $draft.startCountdownEnabled)
                            Stepper("시작 \(draft.startCountdownDays)일 전", value: $draft.startCountdownDays, in: 0...30)
                        }
                        Picker("기준", selection: $draft.focus) {
                            Text("시작").tag(PeriodFocus.start)
                            Text("마감").tag(PeriodFocus.deadline)
                        }
                    }
                }

                if draft.kind == .event {
                    Section("일정 표시") {
                        Toggle("진행 화면에도 표시", isOn: $draft.showInProgressSummary)
                        Toggle("카운트다운", isOn: $draft.eventCountdownEnabled)
                        if draft.eventCountdownEnabled {
                            Stepper("\(draft.eventCountdownDays)일 전부터", value: $draft.eventCountdownDays, in: 0...30)
                            Picker("기준", selection: $draft.eventCountdownReference) {
                                Text("시작").tag(EventCountdown.Reference.start)
                                Text("종료").tag(EventCountdown.Reference.end)
                            }
                        }
                        Toggle("매주 반복", isOn: $draft.isRecurring)
                        if draft.isRecurring {
                            HStack(spacing: 3) {
                                ForEach(Self.weekdays, id: \.number) { day in
                                    Toggle(day.title, isOn: weekdayBinding(day.number))
                                        .toggleStyle(.button)
                                        .controlSize(.small)
                                }
                            }
                            TextField("반복 종료일 (선택)", text: $draft.recurrenceUntilDate, prompt: Text("YYYY-MM-DD"))
                        }
                    }
                }

                Section("메모 및 링크") {
                    TextEditor(text: $draft.notes)
                        .frame(minHeight: 68, maxHeight: 110)
                    TextField("https://…", text: $draft.sourceUrl)
                }
            }
            .formStyle(.grouped)
            .environment(\.timeZone, TimeZone(identifier: draft.timeZone) ?? .current)
            .environment(\.calendar, editorCalendar)
            .onChange(of: draft.kind) { _, newKind in draft.changeKind(to: newKind) }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
            }
            Divider().padding(.top, 8)
            HStack {
                Spacer()
                Button("취소", action: onCancel)
                    .keyboardShortcut(.cancelAction)
                Button(saving ? "저장 중…" : "저장") { Task { await save() } }
                    .keyboardShortcut(.defaultAction)
                    .disabled(saving)
            }
            .padding(16)
        }
        .frame(minWidth: 520, idealWidth: 580, minHeight: 540, idealHeight: 680)
        .task { availableTasks = (try? await repository.listItems())?.filter { $0.kind == .task } ?? [] }
    }

    @ViewBuilder
    private var timingFields: some View {
        switch draft.kind {
        case .event:
            DatePicker("시작", selection: dateBinding(.start), displayedComponents: pickerComponents)
            if draft.timingMode == .date || draft.hasPeriodEnd {
                DatePicker("종료", selection: dateBinding(.end), displayedComponents: pickerComponents)
            }
            if draft.timingMode == .time {
                Toggle("종료 시각 포함", isOn: $draft.hasPeriodEnd)
            }
        case .task:
            if draft.timingMode == .date {
                DatePicker("할 일 날짜", selection: dateBinding(.end), displayedComponents: .date)
            } else if draft.timingMode == .time {
                DatePicker("마감", selection: dateBinding(.end), displayedComponents: [.date, .hourAndMinute])
            }
        case .deadline:
            if draft.timingMode == .date {
                Toggle("시작일 포함", isOn: $draft.hasPeriodStart)
                if draft.hasPeriodStart { DatePicker("시작", selection: dateBinding(.start), displayedComponents: .date) }
                DatePicker("마감", selection: dateBinding(.end), displayedComponents: .date)
            } else {
                Toggle("시작 시각 포함", isOn: $draft.hasPeriodStart)
                if draft.hasPeriodStart { DatePicker("시작", selection: dateBinding(.start), displayedComponents: [.date, .hourAndMinute]) }
                DatePicker("마감", selection: dateBinding(.end), displayedComponents: [.date, .hourAndMinute])
            }
        case .window:
            DatePicker("시작", selection: dateBinding(.start), displayedComponents: draft.timingMode == .date ? .date : [.date, .hourAndMinute])
            if draft.timingMode == .date || draft.hasPeriodEnd {
                DatePicker("종료", selection: dateBinding(.end), displayedComponents: draft.timingMode == .date ? .date : [.date, .hourAndMinute])
            }
            if draft.timingMode == .time { Toggle("종료 시각 포함", isOn: $draft.hasPeriodEnd) }
        }
    }

    private enum DateField { case start, end }

    private var pickerComponents: DatePickerComponents {
        draft.timingMode == .date ? .date : [.date, .hourAndMinute]
    }

    private var editorCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: draft.timeZone) ?? .current
        return calendar
    }

    private func dateBinding(_ field: DateField) -> Binding<Date> {
        Binding {
            let raw = field == .start ? draft.startDate : draft.endDate
            if draft.timingMode == .time {
                let instant = field == .start ? draft.startAt : draft.endAt
                if let date = ISO8601DateFormatter.todoListDate(from: instant) { return date }
            }
            if let parsed = TodayProjection.parseDate(raw, timeZone: draft.timeZone) { return parsed }
            return Date()
        } set: { date in
            if draft.timingMode == .time {
                let value = ISO8601DateFormatter.todoListTimestamp(for: date)
                if field == .start { draft.startAt = value } else { draft.endAt = value }
            } else {
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.calendar = editorCalendar
                formatter.timeZone = editorCalendar.timeZone
                formatter.dateFormat = "yyyy-MM-dd"
                if field == .start { draft.startDate = formatter.string(from: date) } else { draft.endDate = formatter.string(from: date) }
            }
        }
    }

    private func linkedTaskSelection(for row: Binding<ChecklistRow>) -> Binding<String> {
        Binding {
            row.wrappedValue.linkedTaskId ?? ""
        } set: { id in
            if id.isEmpty {
                row.wrappedValue.linkedTaskId = nil
                return
            }
            row.wrappedValue.linkedTaskId = id
            if let task = availableTasks.first(where: { $0.id == id }) {
                row.wrappedValue.title = task.title
                row.wrappedValue.completed = task.completion == .completed
            }
        }
    }

    private func weekdayBinding(_ weekday: Int) -> Binding<Bool> {
        Binding {
            draft.recurrenceDays.contains(weekday)
        } set: { selected in
            if selected { draft.recurrenceDays.insert(weekday) }
            else { draft.recurrenceDays.remove(weekday) }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            let item = draft.makeItem()
            try ItemValidator.validate(item)
            try await repository.upsert(item)
            onSaved(item)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static let categoryColors: [(id: String, title: String)] = [
        ("teal", "청록"), ("amber", "앰버"), ("blue", "블루"),
        ("violet", "바이올렛"), ("coral", "코랄"), ("sage", "세이지")
    ]

    private static let weekdays: [(number: Int, title: String)] = [
        (0, "일"), (1, "월"), (2, "화"), (3, "수"), (4, "목"), (5, "금"), (6, "토")
    ]

}
