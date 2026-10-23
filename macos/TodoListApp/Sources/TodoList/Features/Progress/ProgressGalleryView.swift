import SwiftUI

struct ProgressGalleryView: View {
    let model: AppModel
    let repository: any ItemRepository

    @State private var selectedType: ProgressTypeFilter = .all
    @State private var sortOrder: ProgressSortOrder = .nearest
    @State private var includeCompleted = true

    private var cards: [CalendarItem] {
        let projected = ProgressProjection.cards(from: model.visibleItems)
            .filter { includeCompleted || $0.completion != .completed }
            .filter { selectedType.matches($0) }
        return projected.sorted { lhs, rhs in
            switch sortOrder {
            case .nearest:
                let left = ProgressProjection.targetDate(for: lhs) ?? .distantFuture
                let right = ProgressProjection.targetDate(for: rhs) ?? .distantFuture
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
                        ContentUnavailableView {
                            Label("진행 항목이 없습니다", systemImage: "chart.bar.xaxis")
                        } description: {
                            Text("마감이나 기간을 가진 Progress를 추가해 중요한 날짜를 관리하세요.")
                        } actions: {
                            Button("Progress 추가", systemImage: "plus") { model.requestCreateItem(kind: .deadline) }
                                .buttonStyle(.borderedProminent)
                                .tint(Theme.accent)
                        }
                        .frame(maxWidth: .infinity, minHeight: 300)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 270, maximum: 420), spacing: 17)], alignment: .leading, spacing: 17) {
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
                .frame(maxWidth: 1120, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .background(Theme.canvas)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 5) {
                Text("YOUR TIMELINE")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(Color(red: 0.61, green: 0.66, blue: 0.61))
                    .padding(.bottom, 1)
                Text("Progress")
                    .font(.system(size: 34, weight: .semibold))
                    .tracking(-1.4)
                Text("시작을 기다리는 순간부터, 끝내야 하는 일까지.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(red: 0.57, green: 0.62, blue: 0.58))
                    .padding(.top, 1)
            }
            Spacer()
            Button("Progress 추가", systemImage: "plus") {
                model.requestCreateItem(kind: .deadline)
            }
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 13)
            .frame(height: 34)
            .background(Color(red: 0.18, green: 0.28, blue: 0.23), in: RoundedRectangle(cornerRadius: 7))
            .buttonStyle(.plain)
        }
    }

    private var controls: some View {
        HStack(spacing: 7) {
            ForEach(filters) { filter in
                Button {
                    selectedType = filter
                } label: {
                    HStack(spacing: 5) {
                        Text(filter == .all ? "전체" : filter.title)
                        if filter == .all { Text("\(ProgressProjection.cards(from: model.visibleItems).count)").foregroundStyle(selectedType == filter ? Theme.accent : Color.secondary) }
                    }
                    .font(.system(size: 10, weight: selectedType == filter ? .semibold : .regular))
                    .foregroundStyle(selectedType == filter ? Color(red: 0.23, green: 0.36, blue: 0.28) : Color(red: 0.54, green: 0.59, blue: 0.55))
                    .padding(.horizontal, 11)
                    .frame(height: 29)
                    .background(selectedType == filter ? Theme.sageSelection : .clear, in: RoundedRectangle(cornerRadius: 7))
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 10)
            Text("정렬")
                .font(.system(size: 10))
                .foregroundStyle(Color(red: 0.62, green: 0.66, blue: 0.62))
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
                Text(sortOrder.title).font(.system(size: 10))
                .foregroundStyle(Color(red: 0.42, green: 0.49, blue: 0.43))
                .padding(.horizontal, 9)
                .frame(height: 28)
                .background(.white, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.separator, lineWidth: 1))
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .help("정렬 및 완료 항목 표시 설정")
        }
        .controlSize(.small)
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
