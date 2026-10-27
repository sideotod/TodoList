import SwiftUI

struct GlobalSearchView: View {
    let items: [CalendarItem]
    let onSelect: (CalendarItem) -> Void
    let onClose: () -> Void
    var timeFormat = "24h"

    @State private var query = ""
    @FocusState private var queryFocused: Bool
    @State private var selectedID: String?
    @State private var matches: [CalendarItem] = []
    @State private var isSearching = false

    private var searchInput: SearchInput {
        SearchInput(query: query, items: items)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("할 일, 일정, 메모, 링크 검색", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .focused($queryFocused)
                    .onSubmit {
                        guard !isSearching else { return }
                        if let item = matches.first(where: { $0.id == selectedID }) ?? matches.first { onSelect(item) }
                    }
                    .onKeyPress(.downArrow) {
                        moveSelection(1)
                        return .handled
                    }
                    .onKeyPress(.upArrow) {
                        moveSelection(-1)
                        return .handled
                    }
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary).frame(width: 24, height: 24).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("검색 닫기")
            }
            .padding(17)
            Divider()
            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                emptyState("검색어를 입력하세요")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isSearching {
                ProgressView().controlSize(.small)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if matches.isEmpty {
                emptyState("검색 결과가 없습니다")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                    List(matches) { item in
                        Button {
                            onSelect(item)
                        } label: {
                            HStack(spacing: 11) {
                                Image(systemName: item.kind == .task ? "checklist" : item.kind == .event ? "calendar" : "hourglass")
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 18)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title).font(.system(size: 13, weight: .medium)).foregroundStyle(.primary)
                                    Text([kindLabel(item), item.category, dateLabel(item)].compactMap { $0 }.joined(separator: " · "))
                                        .font(.system(size: 10)).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.up.left").font(.system(size: 10)).foregroundStyle(.tertiary)
                            }
                            .padding(.vertical, 4)
                            .contentShape(Rectangle())
                            .background(selectedID == item.id ? Theme.sageSelection : .clear, in: RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                        .id(item.id)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.inset)
                    .onChange(of: selectedID) { _, value in
                        if let value { proxy.scrollTo(value) }
                    }
                }
            }
        }
        .frame(width: 580, height: 470)
        .background(Theme.canvas)
        .onAppear { queryFocused = true }
        .onChange(of: query) { _, value in
            matches = []
            selectedID = nil
            isSearching = !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        .task(id: searchInput) {
            let input = searchInput
            guard !input.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                matches = []
                selectedID = nil
                isSearching = false
                return
            }
            isSearching = true
            let worker = Task.detached(priority: .userInitiated) {
                ItemSearchProjection.matches(query: input.query, in: input.items)
            }
            let results = await withTaskCancellationHandler {
                await worker.value
            } onCancel: {
                worker.cancel()
            }
            guard !Task.isCancelled else { return }
            matches = results
            selectedID = results.first?.id
            isSearching = false
        }
        .onExitCommand(perform: onClose)
    }

    private func kindLabel(_ item: CalendarItem) -> String {
        switch item.kind {
        case .task: "할 일"
        case .event: "일정"
        case .deadline: "마감"
        case .window: "기간"
        }
    }

    private func dateLabel(_ item: CalendarItem) -> String? {
        ItemSearchProjection.dateLabel(item, timeFormat: timeFormat)
    }

    private func emptyState(_ title: String) -> some View {
        Text(title).font(.system(size: 12)).foregroundStyle(Theme.secondaryText)
    }

    private func moveSelection(_ offset: Int) {
        guard !matches.isEmpty else { return }
        let current = matches.firstIndex { $0.id == selectedID } ?? (offset > 0 ? -1 : matches.count)
        selectedID = matches[min(matches.count - 1, max(0, current + offset))].id
    }
}

private struct SearchInput: Equatable, Sendable {
    let query: String
    let items: [CalendarItem]
}

enum ItemSearchProjection {
    static func dateLabel(_ item: CalendarItem, timeFormat: String) -> String? {
        switch item.timing {
        case .unscheduled: nil
        case .date(let start, let end, _): start.map { "\($0)–\(end)" } ?? end
        case .time(let start, let end, let zone):
            (start ?? end).flatMap(ISO8601DateFormatter.todoListDate(from:)).map { date in
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "ko_KR")
                formatter.timeZone = TimeZone(identifier: zone) ?? .current
                formatter.dateFormat = timeFormat == "12h" ? "M월 d일 a h:mm" : "M월 d일 HH:mm"
                return formatter.string(from: date)
            }
        }
    }
    static func matches(query: String, in items: [CalendarItem]) -> [CalendarItem] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return [] }
        return items.filter { item in
            guard !Task.isCancelled else { return false }
            return [item.title, item.category, item.notes, item.sourceUrl]
                .compactMap { $0 }
                .contains { $0.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}
