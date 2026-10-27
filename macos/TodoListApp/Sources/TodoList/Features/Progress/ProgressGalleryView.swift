import SwiftUI

struct ProgressGalleryView: View {
    let model: WindowModel
    let repository: any ItemRepository

    @State private var selectedType: ProgressTypeFilter = .all
    @State private var sortOrder: ProgressSortOrder = .nearest
    @State private var includeCompleted = true
    @State private var hoveredFilter: ProgressTypeFilter?

    private var cards: [CalendarItem] {
        let now = Date()
        let projected = ProgressProjection.cards(from: model.visibleItems)
            .filter { includeCompleted || $0.completion != .completed }
            .filter { selectedType.matches($0) }
        return projected.sorted { lhs, rhs in
            switch sortOrder {
            case .nearest:
                let left = ProgressProjection.targetDate(for: lhs, now: now) ?? .distantFuture
                let right = ProgressProjection.targetDate(for: rhs, now: now) ?? .distantFuture
                return left == right
                    ? lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
                    : left < right
            case .title:
                return lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
            case .recentlyUpdated:
                return (lhs.updatedAt ?? "") > (rhs.updatedAt ?? "")
            }
        }
    }

    private var filters: [ProgressTypeFilter] {
        ProgressTypeFilter.allCases.filter { filter in
            filter != .event || model.visibleItems.contains { $0.kind == .event && $0.showInProgressSummary == true }
        }
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    controls
                    if cards.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "chart.bar.xaxis")
                                .font(.system(size: 24, weight: .light))
                                .foregroundStyle(Theme.tertiaryText)
                            Text("진행 항목이 없습니다")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.secondaryText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 300)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 270, maximum: 520), spacing: 17)], alignment: .center, spacing: 17) {
                            ForEach(cards) { item in
                                ProgressCard(
                                    item: item,
                                    allItems: model.items,
                                    now: Date(),
                                    onSelect: { model.selectItem(item.id) },
                                    onEdit: { model.requestEdit(item.id) },
                                    onToggleCompletion: { Task { await toggleCompletion(item) } },
                                    onDelete: { Task { await model.deleteItem(item.id) } }
                                )
                            }
                        }
                    }
                }
                .padding(.horizontal, min(64, max(30, geometry.size.width * 0.05)))
                .padding(.top, 34)
                .padding(.bottom, 28)
                .frame(maxWidth: 1200, alignment: .center)
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .background(Theme.canvas)
            .scrollIndicators(.automatic)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Progress")
                    .font(.system(size: 34, weight: .semibold))
                    .tracking(-1.4)
            }
            Spacer()
            Button("Progress 추가", systemImage: "plus") {
                model.requestCreateItem(kind: .deadline)
            }
            .buttonStyle(FormActionButtonStyle(primary: true))
        }
    }

    private var controls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 7) {
                typeFilters
                Spacer(minLength: 10)
                sortingMenu
            }
            VStack(alignment: .leading, spacing: 9) {
                ScrollView(.horizontal) { typeFilters }
                    .frame(height: 29)
                    .scrollIndicators(.automatic)
                HStack { Spacer(); sortingMenu }
            }
        }
        .controlSize(.small)
    }

    private var typeFilters: some View {
        HStack(spacing: 7) {
            ForEach(filters) { filter in
                Button {
                    selectedType = filter
                } label: {
                    HStack(spacing: 5) {
                        Text(filter == .all ? "전체" : filter.title)
                        if filter == .all { Text("\(ProgressProjection.cards(from: model.visibleItems).count)").foregroundStyle(selectedType == filter ? Theme.accent : Color.secondary) }
                    }
                    .font(.system(size: 11, weight: selectedType == filter ? .semibold : .regular))
                    .foregroundStyle(selectedType == filter ? Theme.accent : Theme.secondaryText)
                    .padding(.horizontal, 11)
                    .frame(height: 29)
                    .background(
                        selectedType == filter ? Theme.sageSelection : hoveredFilter == filter ? Theme.rowHover : .clear,
                        in: RoundedRectangle(cornerRadius: 7)
                    )
                }
                .buttonStyle(.plain)
                .onHover { hoveredFilter = $0 ? filter : nil }
                .animation(.easeOut(duration: 0.12), value: hoveredFilter == filter)
                .accessibilityAddTraits(selectedType == filter ? .isSelected : [])
            }
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private var sortingMenu: some View {
        HStack(spacing: 7) {
            Text("정렬")
                .font(.system(size: 11))
                .foregroundStyle(Theme.secondaryText)
            Menu {
                ForEach(ProgressSortOrder.allCases) { order in
                    Button {
                        sortOrder = order
                    } label: {
                        if sortOrder == order { Label(order.title, systemImage: "checkmark") }
                        else { Text(order.title) }
                    }
                }
                Divider()
                Toggle("완료 항목 포함", isOn: $includeCompleted)
            } label: {
                Text(sortOrder.title).font(.system(size: 11))
                .foregroundStyle(Theme.secondaryText)
                .padding(.horizontal, 9)
                .frame(height: 28)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.separator, lineWidth: 1))
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .help("정렬 및 완료 항목 표시 설정")
        }
        .fixedSize()
    }

    private func toggleCompletion(_ item: CalendarItem) async {
        guard let completion = item.completion else { return }
        var changed = item
        changed.completion = completion == .completed ? .pending : .completed
        do {
            try ItemValidator.validate(changed)
            try await repository.upsert(changed)
            await model.refresh()
        } catch {
            model.presentRepositoryError(error)
        }
    }
}

private enum ProgressTypeFilter: String, CaseIterable, Identifiable {
    case all, deadline, starting, window, event
    var id: String { rawValue }
    var title: String {
        switch self {
        case .all: "전체"
        case .deadline: "마감"
        case .starting: "시작 대기"
        case .window: "진행 기간"
        case .event: "일정"
        }
    }

    func matches(_ item: CalendarItem) -> Bool {
        switch self {
        case .all: true
        case .deadline: item.kind == .deadline && item.focus != .start
        case .starting: item.kind == .deadline && item.focus == .start
        case .window: item.kind == .window
        case .event: item.kind == .event
        }
    }
}

private enum ProgressSortOrder: String, CaseIterable, Identifiable {
    case nearest, title, recentlyUpdated
    var id: String { rawValue }
    var title: String {
        switch self {
        case .nearest: "가까운 날짜"
        case .title: "제목"
        case .recentlyUpdated: "최근 수정"
        }
    }
}
