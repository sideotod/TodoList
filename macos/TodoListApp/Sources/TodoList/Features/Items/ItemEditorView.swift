import SwiftUI

struct ItemEditorView: View {
    let initialItem: CalendarItem?
    let defaultKind: ItemKind
    let context: ItemEditorContext
    let repository: any ItemRepository
    let categoryItems: [CalendarItem]
    let categoryPreferences: [TaskCategoryPreference]
    let onSaved: (CalendarItem) -> Void
    let onCancel: () -> Void
    let timeFormat: String

    @State private var draft: ItemEditorDraft
    @State private var initialSnapshot: CalendarItem?
    @State private var availableTasks: [CalendarItem] = []
    @State private var categorySuggestions: [EditorCategoryOption] = []
    @State private var errorMessage: String?
    @State private var saving = false

    init(
        initialItem: CalendarItem?,
        defaultKind: ItemKind,
        context: ItemEditorContext,
        repository: any ItemRepository,
        categoryItems: [CalendarItem] = [],
        categoryPreferences: [TaskCategoryPreference] = [],
        onSaved: @escaping (CalendarItem) -> Void,
        onCancel: @escaping () -> Void,
        timeFormat: String = "24h"
    ) {
        self.initialItem = initialItem
        self.defaultKind = defaultKind
        self.context = context
        self.repository = repository
        self.categoryItems = categoryItems
        self.categoryPreferences = categoryPreferences
        self.onSaved = onSaved
        self.onCancel = onCancel
        self.timeFormat = timeFormat
        _draft = State(initialValue: ItemEditorDraft(item: initialItem, defaultKind: defaultKind, context: context))
        _initialSnapshot = State(initialValue: initialItem)
        _categorySuggestions = State(initialValue: EditorCategoryOptions.from(items: categoryItems, configuredCategories: categoryPreferences))
    }

    var body: some View {
        VStack(spacing: 0) {
            Text(editorTitle)
                .font(.system(size: 20, weight: .semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
            Divider()
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: 20) {
                    FormSectionCard(title: "", appearance: .plain) {
                        EditorTextField(
                            text: $draft.title,
                            placeholder: "제목",
                            font: .systemFont(ofSize: 24, weight: .semibold),
                            autofocus: true
                        )
                            .modifier(FormTextFieldStyle())
                            .accessibilityLabel("제목")
                        FormFieldRow(title: "종류") {
                            PopoverSelectionField(title: "종류", choices: kindChoices, selection: $draft.kind)
                        }
                        FormFieldRow(title: "카테고리") {
                            categoryField
                        }
                        if draft.kind != .event {
                            FormFieldRow(title: "완료 상태") {
                                PopoverSelectionField(title: "완료 상태", choices: completionChoices, selection: $draft.completion)
                            }
                        }
                    }
                    FormSectionCard(title: "날짜와 시간", appearance: .plain) {
                        FormFieldRow(title: "입력 방식") {
                            PopoverSelectionField(title: "입력 방식", choices: timingModeChoices, selection: timingModeBinding)
                        }
                        if draft.timingMode != .unscheduled {
                            timingFields
                            FormFieldRow(title: "시간대") {
                                EditorTextField(text: $draft.timeZone, placeholder: "IANA 시간대").modifier(FormTextFieldStyle())
                            }
                        }
                        if draft.kind == .deadline || draft.kind == .window {
                            FormFieldRow(title: "기준") {
                                PopoverSelectionField(title: "기준", choices: focusChoices, selection: $draft.focus)
                            }
                            if draft.kind == .window || draft.hasPeriodStart {
                                FormToggleRow(title: "시작 카운트다운", isOn: $draft.startCountdownEnabled)
                                if draft.startCountdownEnabled {
                                    Stepper("시작 \(draft.startCountdownDays)일 전", value: $draft.startCountdownDays, in: 0...30)
                                }
                            }
                        }
                    }
                    if draft.kind == .deadline || draft.kind == .window {
                        checklistFields
                    }
                    if draft.kind == .event {
                        eventFields
                    }
                    FormSectionCard(title: "추가 정보", appearance: .plain) {
                        TextEditor(text: $draft.notes)
                            .font(.system(size: 12))
                            .scrollContentBackground(.hidden)
                            .padding(7)
                            .frame(height: 84)
                            .overlay(RoundedRectangle(cornerRadius: 7).stroke(Theme.separator, lineWidth: 1))
                            .accessibilityLabel("메모")
                        EditorTextField(text: $draft.sourceUrl, placeholder: "https://…").modifier(FormTextFieldStyle())
                    }
                    if let errorMessage {
                        Text(errorMessage).foregroundStyle(.red).accessibilityLabel("저장 오류: \(errorMessage)")
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollIndicators(.automatic)
            Divider()
            HStack(spacing: 8) {
                Spacer()
                Button("취소", action: onCancel)
                    .buttonStyle(FormActionButtonStyle())
                    .keyboardShortcut(.cancelAction)
                Button(saving ? "저장 중…" : "저장") { Task { await save() } }
                    .buttonStyle(FormActionButtonStyle(primary: true))
                    .keyboardShortcut(.defaultAction)
                    .disabled(saving)
            }
            .padding(.horizontal, 24)
            .frame(height: 64)
        }
        .font(.system(size: 12))
        .controlSize(.regular)
        .toggleStyle(.switch)
        .tint(Theme.accent)
        .background(Theme.canvas)
        .background { SheetOutsideClickDismiss { if !saving { onCancel() } }.allowsHitTesting(false) }
        .focusEffectDisabled(true)
        .environment(\.timeZone, TimeZone(identifier: draft.timeZone) ?? .current)
        .environment(\.calendar, editorCalendar)
        .environment(\.locale, Locale(identifier: timeFormat == "12h" ? "ko_KR@hours=h12" : "ko_KR@hours=h23"))
        .onChange(of: draft.kind) { _, newKind in draft.changeKind(to: newKind) }
        .onChange(of: draft.hasPeriodStart) { _, enabled in if enabled { draft.ensureTimingDefaults() } }
        .onChange(of: draft.hasPeriodEnd) { _, enabled in if enabled { draft.ensureTimingDefaults() } }
        .onChange(of: categorySuggestions) { _, _ in draft.categoryColor = categoryColor(for: draft.category) }
        .frame(width: 580, height: 680)
        .task {
            let storedItems = (try? await repository.listItems()) ?? []
            let items = storedItems.isEmpty ? categoryItems : storedItems
            availableTasks = items.filter { $0.kind == .task }
            categorySuggestions = EditorCategoryOptions.from(items: items, configuredCategories: categoryPreferences)
        }
    }

    private var editorTitle: String {
        let name = draft.kind == .event ? "일정" : draft.kind == .task ? "할 일" : "Progress"
        return initialItem == nil ? "새 \(name)" : "\(name) 편집"
    }

    private var timingModeBinding: Binding<ItemTimingMode> {
        Binding(get: { draft.timingMode }, set: { draft.changeTimingMode(to: $0) })
    }

    private var kindChoices: [PopoverChoice<ItemKind>] {
        [
            .init(value: .event, title: "일정"),
            .init(value: .task, title: "할 일"),
            .init(value: .deadline, title: "마감형 Progress"),
            .init(value: .window, title: "기간형 Progress"),
        ]
    }

    private var completionChoices: [PopoverChoice<ItemCompletion>] {
        [
            .init(value: .pending, title: "진행 중"),
            .init(value: .completed, title: "완료"),
        ]
    }

    private var timingModeChoices: [PopoverChoice<ItemTimingMode>] {
        ItemTimingMode.allCases
            .filter { draft.kind == .task || $0 != .unscheduled }
            .map { .init(value: $0, title: $0.title) }
    }

    private var focusChoices: [PopoverChoice<PeriodFocus>] {
        [
            .init(value: .start, title: "시작"),
            .init(value: .deadline, title: "마감"),
        ]
    }

    private var eventCountdownChoices: [PopoverChoice<EventCountdown.Reference>] {
        [
            .init(value: .start, title: "시작"),
            .init(value: .end, title: "종료"),
        ]
    }

    private var categoryField: some View {
        PopoverSelectionField(title: "카테고리", choices: categoryChoices, selection: categorySelection)
    }

    private var categoryChoices: [PopoverChoice<String>] {
        [PopoverChoice(value: "", title: "카테고리 미지정", color: Theme.categoryColor(Self.defaultCategoryColor))]
            + categorySuggestions.map {
                PopoverChoice(value: $0.name, title: $0.name, color: Theme.categoryColor($0.color))
            }
    }

    private var categorySelection: Binding<String> {
        Binding(
            get: { draft.category },
            set: { value in
                draft.category = value
                draft.categoryColor = categoryColor(for: value)
            }
        )
    }

    private func categoryColor(for value: String) -> String {
        let name = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return Self.defaultCategoryColor }
        return categorySuggestions.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }?.color
            ?? Self.defaultCategoryColor
    }

    private var linkedTaskChoices: [PopoverChoice<String>] {
        let choices = [PopoverChoice(value: "", title: "연결 안 함")]
        return choices + availableTasks
            .filter { $0.id != draft.id && $0.deletedAt == nil }
            .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            .map { .init(value: $0.id, title: $0.title) }
    }

    private var checklistFields: some View {
        FormSectionCard(title: "준비 작업", appearance: .plain) {
            ForEach($draft.checklist) { $row in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Toggle("완료", isOn: $row.completed).labelsHidden().toggleStyle(.checkbox)
                        EditorTextField(text: $row.title, placeholder: "준비 작업").modifier(FormTextFieldStyle())
                        Button(role: .destructive) {
                            draft.checklist.removeAll { $0.id == row.id }
                        } label: {
                            Image(systemName: "minus.circle").frame(width: 24, height: 24).contentShape(Rectangle())
                        }.buttonStyle(.plain).accessibilityLabel("준비 작업 삭제")
                    }
                    FormFieldRow(title: "연결된 할 일") {
                        PopoverSelectionField(title: "연결된 할 일", choices: linkedTaskChoices, selection: linkedTaskSelection(for: $row))
                    }
                }
            }
            if draft.checklist.count < 4 {
                Button("준비 작업 추가", systemImage: "plus") {
                    draft.checklist.append(ChecklistRow(id: UUID().uuidString.lowercased(), title: "", completed: false, linkedTaskId: nil))
                }.buttonStyle(.borderless).foregroundStyle(Theme.accent).frame(minHeight: 28)
            }
        }
    }

    private var eventFields: some View {
        FormSectionCard(title: "일정 표시 및 반복", appearance: .plain) {
            FormToggleRow(title: "Progress에 표시", isOn: $draft.showInProgressSummary)
            FormToggleRow(title: "카운트다운", isOn: $draft.eventCountdownEnabled)
            if draft.eventCountdownEnabled {
                Stepper("\(draft.eventCountdownDays)일 전부터", value: $draft.eventCountdownDays, in: 0...30)
                FormFieldRow(title: "기준") {
                    PopoverSelectionField(title: "기준", choices: eventCountdownChoices, selection: $draft.eventCountdownReference)
                }
            }
            FormToggleRow(title: "매주 반복", isOn: $draft.isRecurring)
            if draft.isRecurring {
                HStack(spacing: 6) {
                    ForEach(Self.weekdays, id: \.number) { day in
                        Button {
                            weekdayBinding(day.number).wrappedValue.toggle()
                        } label: {
                            Text(day.title).frame(width: 32, height: 28)
                        }
                        .buttonStyle(CalendarDateButtonStyle(selected: draft.recurrenceDays.contains(day.number)))
                        .accessibilityLabel("\(day.title)요일 반복")
                        .accessibilityAddTraits(draft.recurrenceDays.contains(day.number) ? .isSelected : [])
                    }
                }
                FormToggleRow(title: "반복 종료일 지정", isOn: Binding(
                    get: { !draft.recurrenceUntilDate.isEmpty },
                    set: { enabled in
                        let date = draft.timingMode == .time
                            ? TodayProjection.localDate(draft.hasPeriodEnd ? draft.endAt : draft.startAt, zone: draft.timeZone) ?? draft.endDate
                            : draft.endDate
                        draft.recurrenceUntilDate = enabled ? date : ""
                    }
                ))
                if !draft.recurrenceUntilDate.isEmpty {
                    FormFieldRow(title: "반복 종료일") {
                        DateTimeSelectionField(
                            title: "반복 종료일",
                            showsTime: false,
                            calendar: editorCalendar,
                            weekStartsOn: context.weekStartsOn,
                            timeFormat: timeFormat,
                            date: recurrenceEndBinding
                        )
                    }
                }
            }
        }
    }

    private var recurrenceEndBinding: Binding<Date> {
        Binding(
            get: { TodayProjection.parseDate(draft.recurrenceUntilDate, timeZone: draft.timeZone) ?? Date() },
            set: { date in
                let formatter = DateFormatter()
                formatter.calendar = editorCalendar
                formatter.timeZone = editorCalendar.timeZone
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.dateFormat = "yyyy-MM-dd"
                draft.recurrenceUntilDate = formatter.string(from: date)
            }
        )
    }

    @ViewBuilder
    private var timingFields: some View {
        switch draft.kind {
        case .event:
            dateField("시작", field: .start, components: pickerComponents)
            if draft.timingMode == .date || draft.hasPeriodEnd { dateField("종료", field: .end, components: pickerComponents) }
            if draft.timingMode == .time { FormToggleRow(title: "종료 시각 포함", isOn: $draft.hasPeriodEnd) }
        case .task:
            dateField(draft.timingMode == .date ? "할 일 날짜" : "마감", field: .end, components: pickerComponents)
        case .deadline:
            FormToggleRow(title: draft.timingMode == .date ? "시작일 포함" : "시작 시각 포함", isOn: $draft.hasPeriodStart)
            if draft.hasPeriodStart { dateField("시작", field: .start, components: pickerComponents) }
            dateField("마감", field: .end, components: pickerComponents)
        case .window:
            dateField("시작", field: .start, components: pickerComponents)
            if draft.timingMode == .date || draft.hasPeriodEnd { dateField("종료", field: .end, components: pickerComponents) }
            if draft.timingMode == .time { FormToggleRow(title: "종료 시각 포함", isOn: $draft.hasPeriodEnd) }
        }
    }

    private func dateField(_ title: String, field: DateField, components: DatePickerComponents) -> some View {
        FormFieldRow(title: title) {
            DateTimeSelectionField(
                title: title,
                showsTime: components.contains(.hourAndMinute),
                calendar: editorCalendar,
                weekStartsOn: context.weekStartsOn,
                timeFormat: timeFormat,
                date: dateBinding(field)
            )
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
            if selected { draft.recurrenceDays.insert(weekday) } else { draft.recurrenceDays.remove(weekday) }
        }
    }

    private func save() async {
        guard !saving else { return }
        saving = true
        defer { saving = false }
        do {
            draft.categoryColor = categoryColor(for: draft.category)
            let item = draft.makeItem()
            try ItemValidator.validate(item)
            try await repository.upsert(item, expected: initialSnapshot)
            onSaved(item)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static let defaultCategoryColor = "teal"

    private static let weekdays: [(number: Int, title: String)] = [
        (0, "일"), (1, "월"), (2, "화"), (3, "수"), (4, "목"), (5, "금"), (6, "토"),
    ]

}
