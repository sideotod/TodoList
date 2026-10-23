import SwiftUI

struct GlobalSearchView: View {
    let items: [CalendarItem]
    let onSelect: (CalendarItem) -> Void
    let onClose: () -> Void

    @State private var query = ""
    @FocusState private var queryFocused: Bool

    private var matches: [CalendarItem] {
        ItemSearchProjection.matches(query: query, in: items)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("할 일, 일정, 메모, 링크 검색", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .focused($queryFocused)
                    .onSubmit { if let first = matches.first { onSelect(first) } }
                Button(action: onClose) { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                    .buttonStyle(.plain)
                    .accessibilityLabel("검색 닫기")
            }
            .padding(17)
            Divider()
            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                ContentUnavailableView("TodoList 검색", systemImage: "magnifyingglass", description: Text("제목, 카테고리, 메모, URL에서 찾습니다."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if matches.isEmpty {
                ContentUnavailableView.search(text: query)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(matches) { item in
                    Button { onSelect(item) } label: {
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
                    }
                    .buttonStyle(.plain)
                    .listRowSeparator(.hidden)
                }
                .listStyle(.inset)
            }
        }
        .frame(width: 580, height: 470)
        .background(Theme.canvas)
        .onAppear { queryFocused = true }
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
        switch item.timing {
        case .unscheduled: nil
        case let .date(start, end, _): start.map { "\($0)–\(end)" } ?? end
        case let .time(start, end, _): start ?? end
        }
    }
}

enum ItemSearchProjection {
    static func matches(query: String, in items: [CalendarItem]) -> [CalendarItem] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return [] }
        return items.filter { item in
            [item.title, item.category, item.notes, item.sourceUrl]
                .compactMap { $0 }
                .contains { $0.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}
