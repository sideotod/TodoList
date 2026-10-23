import SwiftUI

struct RootView: View {
    let model: AppModel

    var body: some View {
        NavigationSplitView {
            List(selection: selection) {
                Section {
                    ForEach(AppSection.allCases) { section in
                        Label(section.title, systemImage: section.symbol)
                            .tag(section)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 190, ideal: 216, max: 260)
            .scrollContentBackground(.hidden)
            .tint(Theme.accent)
        } detail: {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .firstTextBaseline) {
                    Text(model.selectedSection.title)
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(.primary)
                    Spacer()
                    Label(model.repositoryStatus.title, systemImage: "externaldrive")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                if let detail = model.repositoryStatus.detail {
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
                if model.items.filter({ $0.deletedAt == nil }).isEmpty {
                    ContentUnavailableView("아직 할 일이 없습니다", systemImage: "checklist", description: Text("새 작업을 추가하면 이 공간에서 날짜와 진행 상황을 확인할 수 있습니다."))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(model.items.filter { $0.deletedAt == nil }) { item in
                        Label(item.title, systemImage: item.kind == .task ? "circle" : "calendar")
                    }
                    .listStyle(.inset)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 30)
            .padding(.top, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Theme.canvas)
        }
        .navigationSplitViewStyle(.balanced)
        .navigationTitle("TodoList")
        .tint(Theme.accent)
    }

    private var selection: Binding<AppSection?> {
        Binding(
            get: { model.selectedSection },
            set: { if let section = $0 { model.selectedSection = section } }
        )
    }
}
