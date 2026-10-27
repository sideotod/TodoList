import SwiftUI

struct TodayView: View {
    let model: WindowModel
    let repository: any ItemRepository

    @State private var showingComposer = false
    @FocusState private var composerFocused: Bool
    @State private var composerFrame: CGRect = .zero
    @State private var composerDate = ""
    @State private var completedVisible = true
    @State private var miniMonthAnchor: String?
    @State private var deletingTaskID: String?
    @State private var hoveredTaskID: String?
    @State private var hoveredNearbyID: String?
    @State private var hoveredEventID: String?
    @State private var miniCalendarDays: [String] = []
    @State private var miniMarkedDates: Set<String> = []
    @State private var todayIndex: CalendarItemIndex?

    var body: some View {
        GeometryReader { geometry in
            Group {
                if model.inspectorPresented || geometry.size.width < 700 {
                    ScrollView(.vertical) {
                        VStack(alignment: .leading, spacing: 0) {
                            pageHeading.padding(.bottom, 26)
                            nearbyCard.padding(.bottom, 36)
                            miniCalendar.padding(.bottom, 24)
                            taskSection.padding(.bottom, 24)
                            selectedDayEvents
                        }
                        .padding(.bottom, 28)
                    }
                } else {
                    HStack(alignment: .top, spacing: 0) {
                        leftColumn
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                        Rectangle()
                            .fill(Theme.separator)
                            .frame(width: 1)
                            .padding(.leading, min(54, max(30, geometry.size.width * 0.05)))
                            .padding(.trailing, 28)
                        rightColumn
                            .frame(width: min(306, max(200, geometry.size.width * 0.236)), alignment: .topLeading)
                    }
                }
            }
            .padding(.horizontal, min(64, max(30, geometry.size.width * 0.05)))
            .padding(.top, 34)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(Theme.canvas)
        .coordinateSpace(name: "today-surface")
        .task(id: todayIndexInput) {
            let input = todayIndexInput
            let worker = Task.detached(priority: .userInitiated) {
                CalendarItemIndex(items: input.items, layers: .allVisible, timeZone: input.timeZone)
            }
            let index = await withTaskCancellationHandler {
                await worker.value
            } onCancel: {
                worker.cancel()
            }
            guard !Task.isCancelled else { return }
            todayIndex = index
        }
        .onAppear { updateMiniCalendar(miniCalendarInput) }
        .onChange(of: miniCalendarInput) { _, input in updateMiniCalendar(input) }
        .onPreferenceChange(InlineComposerFramePreferenceKey.self) { composerFrame = $0 }
        .simultaneousGesture(
            SpatialTapGesture(coordinateSpace: .named("today-surface")).onEnded { tap in
                guard showingComposer, !composerFrame.contains(tap.location) else { return }
                composerFocused = false
            }
        )
        .onChange(of: model.selectedDate) { _, _ in
            finishComposerOnOutsideAction()
        }
        .onChange(of: model.route) { _, _ in finishComposerOnOutsideAction() }
        .onChange(of: model.selectedItemID) { _, _ in finishComposerOnOutsideAction() }
        .onChange(of: model.selectedCategoryFilter) { _, _ in finishComposerOnOutsideAction() }
        .onChange(of: model.inspectorPresented) { _, _ in finishComposerOnOutsideAction() }
        .onChange(of: completedVisible) { _, _ in finishComposerOnOutsideAction() }
        .onChange(of: miniMonthAnchor) { _, _ in finishComposerOnOutsideAction() }
        .confirmationDialog(
            "할 일을 삭제할까요?",
            isPresented: Binding(
                get: { deletingTaskID != nil },
                set: { if !$0 { deletingTaskID = nil } }
            ), titleVisibility: .visible
        ) {
            Button("삭제", role: .destructive) {
                if let deletingTaskID { Task { await model.deleteItem(deletingTaskID) } }
                deletingTaskID = nil
            }
            Button("취소", role: .cancel) { deletingTaskID = nil }
        } message: {
            Text("삭제한 할 일은 이 Mac의 목록에서 숨겨집니다.")
        }
    }

    private var leftColumn: some View {
        ScrollView {
            leftContent
        }
        .scrollIndicators(.automatic)
    }

    private var leftContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            pageHeading.padding(.bottom, 26)
            nearbyCard.padding(.bottom, 36)
            taskSection
        }
        .padding(.bottom, 28)
    }

    private var rightColumn: some View {
        ScrollView(.vertical) {
            rightContent
        }
        .scrollIndicators(.automatic)
    }

    private var rightContent: some View {
        VStack(alignment: .leading, spacing: 24) {
            miniCalendar
            selectedDayEvents
        }
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private var pageHeading: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(fullDateTitle)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Text(model.selectedDate == todayDate ? "오늘" : shortDateTitle)
                .font(.system(size: 36, weight: .semibold))
                .tracking(-1.5)
                .padding(.top, 1)
        }
    }

    private var nearbyCard: some View {
        let nearby = TodayProjection.nearby(
            items: model.visibleItems,
            now: Date(),
            timeZone: model.preferences.timeZone,
            limit: 4
        )
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("가까운 마감과 시작")
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                Button {
                    model.route = .progress
                    model.selectedCategoryFilter = nil
                } label: {
                    Label("모두 보기", systemImage: "arrow.up.right")
                        .labelStyle(.titleAndIcon)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.secondaryText)
                }
                .buttonStyle(.plain)
                .help("Progress 전체 보기")
            }
            .padding(.bottom, 7)

            if nearby.isEmpty {
                Text("예정된 마감이나 시작이 없습니다")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity, minHeight: 53, alignment: .leading)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(nearby.enumerated()), id: \.element.id) { index, item in
                        Button { model.selectItem(item.id) } label: {
                            TimelineView(.periodic(from: .now, by: 1)) { context in
                                nearbyRow(item, now: context.date)
                            }
                        }
                            .buttonStyle(.plain)
                            .background {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(hoveredNearbyID == item.id ? Theme.rowHover : .clear)
                                    .padding(.horizontal, -10)
                            }
                            .contentShape(Rectangle())
                            .onHover { hoveredNearbyID = $0 ? item.id : nil }
                            .animation(.easeOut(duration: 0.12), value: hoveredNearbyID == item.id)
                        if index < nearby.count - 1 {
                            Rectangle()
                                .fill(Theme.separator)
                                .frame(height: 1)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 19)
        .padding(.top, 16)
        .padding(.bottom, nearby.isEmpty ? 13 : 9)
        .background(Theme.ribbon, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.separator, lineWidth: 1))
    }

    private var taskSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 10) {
                Text("오늘 할 일")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(height: 32, alignment: .center)
                if !taskRows.isEmpty {
                    Text("\(taskRows.filter { $0.completion != .completed }.count)개 남음")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(height: 32, alignment: .center)
                }
                Spacer(minLength: 12)
                Menu {
                    Button {
                        completedVisible = true
                    } label: {
                        if completedVisible { Label("완료 항목 포함", systemImage: "checkmark") }
                        else { Text("완료 항목 포함") }
                    }
                    Button {
                        completedVisible = false
                    } label: {
                        if !completedVisible { Label("미완료 항목만", systemImage: "checkmark") }
                        else { Text("미완료 항목만") }
                    }
                } label: {
                    Text(completedVisible ? "완료 포함" : "미완료만")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(height: 32, alignment: .center)
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                Button {
                    if showingComposer {
                        finishComposerOnOutsideAction()
                    } else {
                        composerDate = model.selectedDate
                        showingComposer = true
                    }
                } label: {
                    Label("새 할 일", systemImage: "plus")
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 11)
                        .frame(height: 32)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 7))
                        .overlay(RoundedRectangle(cornerRadius: 7).stroke(Theme.separator, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .help("선택한 날짜에 새 할 일 추가")
            }
            .frame(minHeight: 32, alignment: .center)
            .padding(.bottom, 9)
            Rectangle()
                .fill(Theme.separator)
                .frame(height: 1)
                .padding(.bottom, 8)

            if showingComposer {
                InlineTaskComposer(
                    focused: $composerFocused,
                    onCreate: { title in try await createInlineTask(title, on: composerDate) },
                    onCancel: { showingComposer = false }
                )
                .background {
                    GeometryReader { proxy in
                        Color.clear.preference(
                            key: InlineComposerFramePreferenceKey.self,
                            value: proxy.frame(in: .named("today-surface"))
                        )
                    }
                }
                .padding(.bottom, 5)
            }

            if taskRows.isEmpty {
                Text(completedVisible ? "이 날짜의 할 일이 없습니다" : "진행 중인 할 일이 없습니다")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(taskRows.enumerated()), id: \.element.id) { index, task in
                        taskRow(task, index: index)
                        if index < taskRows.count - 1 {
                            Rectangle()
                                .fill(Theme.separator)
                                .frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    private var selectedDayEvents: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(Theme.separator).frame(height: 1)
                .padding(.bottom, 22)
            HStack(alignment: .center) {
                Text("선택한 날의 일정")
                    .font(.system(size: 13, weight: .semibold))
                Spacer(minLength: 4)
                Button {
                    model.route = .calendar
                    model.calendarViewMode = .day
                } label: {
                    Label("일간 보기", systemImage: "arrow.up.right")
                        .labelStyle(.titleAndIcon)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.secondaryText)
                }
                .buttonStyle(.plain)
                .help("선택한 날짜의 일간 캘린더 보기")
            }
            .padding(.bottom, 8)

            let events = todayIndex?.visibleItems(on: model.selectedDate).filter { $0.kind == .event } ?? []
            if todayIndex == nil {
                ProgressView().controlSize(.small)
                    .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            } else if events.isEmpty {
                Text("일정이 없습니다")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(events.enumerated()), id: \.offset) { position, event in
                        Button { model.selectItem(event.id) } label: { eventRow(event) }
                            .buttonStyle(.plain)
                            .background(hoveredEventID == event.id ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 6))
                            .contentShape(Rectangle())
                            .onHover { hoveredEventID = $0 ? event.id : nil }
                            .animation(.easeOut(duration: 0.12), value: hoveredEventID == event.id)
                        if position < events.count - 1 {
                            Rectangle().fill(Theme.separator).frame(height: 1)
                        }
                    }
                }
            }
            Button {
                model.requestCreateItem(kind: .event, context: ItemEditorContext(
                    dateOnly: model.selectedDate,
                    startInstant: defaultEventStart(on: model.selectedDate),
                    timeZone: model.preferences.timeZone,
                    weekStartsOn: model.calendarWeekStartsOn
                ))
            } label: {
                Label("새 일정", systemImage: "plus")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.accent)
            }
            .buttonStyle(.plain)
            .padding(.top, events.isEmpty ? 2 : 11)
        }
    }

    private var fullDateTitle: String {
        guard let date = TodayProjection.parseDate(model.selectedDate, timeZone: model.preferences.timeZone) else { return model.selectedDate }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        formatter.dateFormat = "yyyy년 M월 d일 EEEE"
        return formatter.string(from: date)
    }

    private var shortDateTitle: String {
        guard let date = TodayProjection.parseDate(model.selectedDate, timeZone: model.preferences.timeZone) else { return model.selectedDate }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        formatter.dateFormat = "M월 d일"
        return formatter.string(from: date)
    }

    private var miniCalendar: some View {
        let anchor = miniMonthAnchor ?? model.selectedDate
        let days = miniCalendarDays
        let monthPrefix = String(anchor.prefix(7))
        let weekdays = weekdayLabels(startingAt: model.calendarWeekStartsOn)
        let markedDates = miniMarkedDates
        let currentDate = todayDate
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(TodayProjection.monthTitle(around: anchor, timeZone: model.preferences.timeZone))
                    .font(.system(size: 14, weight: .semibold))
                Spacer()
                Button { miniMonthAnchor = TodayProjection.moveMonth(anchor, by: -1, timeZone: model.preferences.timeZone) } label: { Image(systemName: "chevron.left") }
                    .buttonStyle(.plain).accessibilityLabel("이전 달")
                    .frame(minWidth: 28, minHeight: 28).contentShape(Rectangle())
                Button { miniMonthAnchor = TodayProjection.moveMonth(anchor, by: 1, timeZone: model.preferences.timeZone) } label: { Image(systemName: "chevron.right") }
                    .buttonStyle(.plain).accessibilityLabel("다음 달")
                    .frame(minWidth: 28, minHeight: 28).contentShape(Rectangle())
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 7), spacing: 4) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { _, label in
                    Text(label)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(maxWidth: .infinity, minHeight: 20)
                        .padding(.bottom, 3)
                }
                ForEach(days, id: \.self) { date in
                    let isCurrentMonth = date.hasPrefix(monthPrefix)
                    let isSelected = date == model.selectedDate
                    let containsItems = markedDates.contains(date)
                    Button { model.selectedDate = date } label: {
                        VStack(spacing: 2) {
                            Text(String(Int(date.suffix(2)) ?? 0))
                                .font(.system(size: 11, weight: isSelected ? .semibold : .regular, design: .rounded))
                                .foregroundStyle(isSelected ? Theme.accent : isCurrentMonth ? Color.primary.opacity(0.78) : Color.secondary.opacity(0.42))
                            Circle().fill(containsItems ? Theme.accent : .clear).frame(width: 3, height: 3)
                        }
                        .frame(maxWidth: .infinity, minHeight: 31)
                    }
                    .buttonStyle(CalendarDateButtonStyle(selected: isSelected, today: date == currentDate))
                    .accessibilityLabel(date)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var taskRows: [CalendarItem] {
        TodayProjection.tasks(
            on: model.selectedDate,
            items: model.visibleItems,
            order: model.preferences.taskOrders[model.selectedDate],
            completedVisible: completedVisible,
            categoryFilter: model.selectedCategoryFilter
        )
    }

    private var miniCalendarInput: MiniCalendarInput {
        MiniCalendarInput(
            anchor: miniMonthAnchor ?? model.selectedDate,
            weekStartsOn: model.calendarWeekStartsOn,
            timeZone: model.preferences.timeZone,
            layers: model.preferences.calendarVisibility,
            indexID: todayIndex?.id
        )
    }

    private func updateMiniCalendar(_ input: MiniCalendarInput) {
        let days = TodayProjection.monthGrid(around: input.anchor, weekStartsOn: input.weekStartsOn, timeZone: input.timeZone)
        miniCalendarDays = days
        miniMarkedDates = todayIndex?.visibleDates(in: days, layers: input.layers) ?? []
    }

    private var todayIndexInput: TodayIndexInput {
        TodayIndexInput(items: model.visibleItems, timeZone: model.preferences.timeZone)
    }

    static func currentDate(timeZone: String) -> String {
        TodayProjection.localDate(ISO8601DateFormatter.todoListTimestamp(), zone: timeZone) ?? ""
    }

    private var todayDate: String {
        Self.currentDate(timeZone: model.preferences.timeZone)
    }

    private func nearbyRow(_ item: CalendarItem, now: Date) -> some View {
        let fraction = ProgressProjection.elapsedFraction(item.timing, now: now)
        return HStack(spacing: 14) {
            Text(item.title)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(nearbyDateLabel(item, now: now))
                .font(.system(size: 11))
                .foregroundStyle(Theme.secondaryText)
                .lineLimit(1)
                .fixedSize()
            if let fraction {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.sageSelection)
                        Capsule().fill(Theme.accent).frame(width: geometry.size.width * fraction)
                    }
                }
                .frame(width: 48, height: 4)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                if let label = ProgressProjection.countdownReferenceLabel(for: item, now: now) {
                    Text(label)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.secondaryText)
                }
                Text(ProgressProjection.compactCountdownLabel(for: item, now: now))
                    .font(.system(size: 11, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(ProgressProjection.isCountdownUrgent(for: item, now: now) ? Color.red : Theme.accent)
            }
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .frame(minWidth: 37, alignment: .trailing)
        }
        .padding(.vertical, 9)
        .contentShape(Rectangle())
    }

    private func taskRow(_ task: CalendarItem, index: Int) -> some View {
        HStack(spacing: 11) {
            Button { Task { await model.toggleTask(task) } } label: {
                Image(systemName: task.completion == .completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(task.completion == .completed ? Theme.accent : Theme.tertiaryText)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(task.completion == .completed ? "완료 취소: \(task.title)" : "완료: \(task.title)")
            Button { model.selectItem(task.id) } label: {
                Text(task.title)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(task.completion == .completed ? Theme.secondaryText : Theme.primaryText)
                    .strikethrough(task.completion == .completed, color: .secondary.opacity(0.55))
                    .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if let progress = linkedProgress(for: task) {
                Button {
                    model.selectItem(progress.id)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.right").font(.system(size: 9))
                        Text(progress.title).lineLimit(1)
                    }
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.secondaryText)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(Theme.ribbon, in: RoundedRectangle(cornerRadius: 5))
                }
                .buttonStyle(.plain)
                .help("연결된 Progress 보기: \(progress.title)")
            } else if let category = task.category {
                Text(category)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .background(hoveredTaskID == task.id ? Theme.rowHover : .clear, in: RoundedRectangle(cornerRadius: 6))
        .onHover { hoveredTaskID = $0 ? task.id : nil }
        .animation(.easeOut(duration: 0.12), value: hoveredTaskID == task.id)
        .contextMenu {
            Button("상세 및 편집", systemImage: "pencil") { model.selectItem(task.id); model.requestEdit(task.id) }
            Button("위로 이동", systemImage: "arrow.up") { reorder(task, by: -1) }
                .disabled(index == 0)
            Button("아래로 이동", systemImage: "arrow.down") { reorder(task, by: 1) }
                .disabled(index == taskRows.count - 1)
            Divider()
            Button("삭제", systemImage: "trash", role: .destructive) { deletingTaskID = task.id }
        }
    }

    private func eventRow(_ event: CalendarItem) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(eventTime(event))
                .font(.system(size: 9, design: .rounded).monospacedDigit())
                .foregroundStyle(Theme.secondaryText)
                .frame(width: 58, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            RoundedRectangle(cornerRadius: 2).fill(Theme.accent.opacity(0.7)).frame(width: 3, height: 30)
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title).font(.system(size: 11, weight: .semibold)).lineLimit(2)
                Text(event.recurrence == nil ? (event.category ?? "일정") : "매주 반복")
                    .font(.system(size: 10)).foregroundStyle(Theme.secondaryText)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .font(.system(size: 9))
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }

    private func nearbyDateLabel(_ item: CalendarItem, now: Date) -> String {
        let date: String
        var time: String?
        switch item.timing {
        case .unscheduled:
            return "날짜 미정"
        case let .date(startDate, endDate, _):
            date = ProgressProjection.isWaitingForStart(item, now: now) ? startDate ?? endDate : endDate
        case let .time(startAt, endAt, zone):
            let useStart = item.kind == .window ? ProgressProjection.isWaitingForStart(item, now: now) : item.focus == .start
            let target = useStart
                ? startAt ?? endAt : endAt ?? startAt
            guard let target, let instant = ISO8601DateFormatter.todoListDate(from: target) else { return "날짜 미정" }
            date = TodayProjection.localDate(target, zone: zone) ?? model.selectedDate
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(identifier: zone) ?? .current
            formatter.dateFormat = model.preferences.timeFormat == "12h" ? "a h:mm" : "HH:mm"
            time = formatter.string(from: instant)
        }
        guard let parsed = TodayProjection.parseDate(date, timeZone: model.preferences.timeZone) else { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        formatter.dateFormat = "M월 d일 (E)"
        return [formatter.string(from: parsed), time].compactMap { $0 }.joined(separator: " · ")
    }

    private func linkedProgress(for task: CalendarItem) -> CalendarItem? {
        model.items.first { item in
            item.kind == .deadline || item.kind == .window
                ? item.checklist?.contains(where: { $0.linkedTaskId == task.id }) == true
                : false
        }
    }

    private func createInlineTask(_ title: String, on date: String) async throws {
        let task = CalendarItem(
            id: UUID().uuidString.lowercased(),
            kind: .task,
            title: title,
            category: model.selectedCategoryFilter,
            categoryColor: model.selectedCategoryFilter == nil ? nil : model.preferences.taskCategories.first(where: { $0.name == model.selectedCategoryFilter })?.color,
            timing: .date(startDate: nil, endDate: date, timeZone: model.preferences.timeZone),
            completion: .pending
        )
        try ItemValidator.validate(task)
        try await repository.upsert(task)
        await model.refresh()
    }

    private func finishComposerOnOutsideAction() {
        guard showingComposer else { return }
        composerFocused = false
    }

    private func reorder(_ task: CalendarItem, by offset: Int) {
        let tasks = TodayProjection.tasks(on: model.selectedDate, items: model.visibleItems, order: model.preferences.taskOrders[model.selectedDate], completedVisible: true, categoryFilter: nil)
        var order = model.preferences.taskOrders[model.selectedDate] ?? TaskOrderPreference(pending: [], completed: [])
        if order.pending.isEmpty && order.completed.isEmpty {
            order.pending = tasks.filter { $0.completion == .pending }.map(\.id)
            order.completed = tasks.filter { $0.completion == .completed }.map(\.id)
        }
        model.reorderTasks(on: model.selectedDate, order: order, moving: task.id, by: offset)
    }

    private func defaultEventStart(on date: String) -> String {
        let zone = TimeZone(identifier: model.preferences.timeZone) ?? .current
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        if let base = formatter.date(from: "\(date) 09:00") {
            return ISO8601DateFormatter.todoListTimestamp(for: base)
        }
        return ISO8601DateFormatter.todoListTimestamp()
    }

    private func weekdayLabels(startingAt start: Int) -> [String] {
        let labels = ["일", "월", "화", "수", "목", "금", "토"]
        let index = start == 1 ? 1 : 0
        return Array(labels[index...]) + Array(labels[..<index])
    }

    private func eventTime(_ item: CalendarItem) -> String {
        switch item.timing {
        case .unscheduled: return "시간 미정"
        case .date: return "종일"
        case let .time(startAt, endAt, zone):
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "ko_KR")
            formatter.timeZone = TimeZone(identifier: zone) ?? .current
            formatter.dateFormat = model.preferences.timeFormat == "12h" ? "a h:mm" : "HH:mm"
            let start = startAt.flatMap(ISO8601DateFormatter.todoListDate(from:)).map(formatter.string(from:))
            let end = endAt.flatMap(ISO8601DateFormatter.todoListDate(from:)).map(formatter.string(from:))
            if let start, let end { return "\(start)\n– \(end)" }
            return start ?? end ?? "시간 미정"
        }
    }
}

private struct MiniCalendarInput: Equatable {
    let anchor: String
    let weekStartsOn: Int
    let timeZone: String
    let layers: CalendarLayerPreferences
    let indexID: UUID?
}

private struct TodayIndexInput: Equatable, Sendable {
    let items: [CalendarItem]
    let timeZone: String
}
