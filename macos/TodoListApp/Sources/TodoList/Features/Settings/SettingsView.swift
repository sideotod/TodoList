import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    let model: AppModel

    @State private var timezoneDraft = "Asia/Seoul"
    @State private var selectedSection: SettingsSection = .screen
    @State private var newCategoryName = ""
    @State private var newCategoryColor = "sage"
    @State private var isExporting = false
    @State private var exportFile = BackupFile(data: Data())
    @State private var isImporting = false
    @State private var candidate: LocalBackupV1?
    @State private var confirmsRestore = false
    @State private var statusMessage: String?
    @State private var errorMessage: String?
    @FocusState private var timezoneFocused: Bool
    @State private var hoveredAccent: String?
    @State private var hoveredSection: SettingsSection?

    var body: some View {
        VStack(spacing: 0) {
            settingsNavigation
            Group {
                switch selectedSection {
                case .screen: generalTab
                case .calendar: calendarTab
                case .data: dataTab
                case .account: AccountSettingsView(authService: model.authService, syncManager: model.syncManager)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 640, height: settingsWindowHeight)
        .font(.system(size: 12))
        .controlSize(.regular)
        .background(Theme.canvas)
        .onAppear { timezoneDraft = model.preferences.timeZone }
        .onChange(of: model.preferences.timeZone) { _, value in timezoneDraft = value }
        .onChange(of: timezoneFocused) { _, focused in if !focused { saveTimezone() } }
        .onChange(of: selectedSection) { _, _ in saveTimezone() }
        .fileExporter(
            isPresented: $isExporting,
            document: exportFile,
            contentType: .json,
            defaultFilename: "TodoList-local-backup"
        ) { result in
            switch result {
            case .success(let url):
                statusMessage = "백업을 저장했습니다: \(url.lastPathComponent)"
                errorMessage = nil
            case .failure(let error): errorMessage = error.localizedDescription
            }
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json], allowsMultipleSelection: false) { result in
            do {
                let url = try result.get().first
                guard let url else { return }
                let data = try Data(contentsOf: url)
                candidate = try BackupCodec.decodeLocal(data)
                confirmsRestore = true
                statusMessage = nil
                errorMessage = nil
            } catch {
                errorMessage = error.localizedDescription
                statusMessage = nil
            }
        }
        .confirmationDialog("백업 항목을 이 Mac에 가져올까요?", isPresented: $confirmsRestore, titleVisibility: .visible) {
            if let candidate {
                Button("\(candidate.items.count)개 항목 병합", role: .none) { Task { await restore(candidate) } }
            }
            Button("취소", role: .cancel) { candidate = nil }
        } message: {
            Text("같은 ID의 항목은 백업 내용으로 갱신하고, 백업에 없는 현재 항목은 유지합니다. 기존 데이터는 삭제되지 않습니다.")
        }
        .alert("설정 저장 오류", isPresented: Binding(get: { model.preferencesError != nil }, set: { if !$0 { model.clearPreferencesError() } })) {
            Button("확인") { model.clearPreferencesError() }
        } message: {
            Text(model.preferencesError ?? "설정 저장에 실패했습니다.")
        }
    }

    private var settingsWindowHeight: CGFloat {
        switch selectedSection {
        case .screen, .calendar: 520
        case .data: 340
        case .account: 360
        }
    }

    private var settingsNavigation: some View {
        HStack(spacing: 6) {
            ForEach(SettingsSection.allCases) { section in
                let isSelected = selectedSection == section
                Button {
                    selectedSection = section
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 17, weight: isSelected ? .semibold : .regular))
                        Text(section.title)
                            .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
                    }
                    .foregroundStyle(isSelected ? Theme.accent : Theme.secondaryText)
                    .frame(width: 72, height: 48)
                    .background(
                        isSelected ? Theme.accent.opacity(0.10) : hoveredSection == section ? Theme.rowHover : Color.clear,
                        in: RoundedRectangle(cornerRadius: 8)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .onHover { hoveredSection = $0 ? section : nil }
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Theme.titlebar)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.separator).frame(height: 1)
        }
    }

    private var generalTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                FormSectionCard(title: "강조 색상") {
                    HStack(spacing: 8) {
                        accentChoice("세이지", value: "sage", color: Theme.sage)
                        accentChoice("아크틱", value: "arctic", color: Theme.blue)
                        accentChoice("로즈", value: "rose", color: Theme.categoryColor("rose"))
                        accentChoice("앰버", value: "amber", color: Theme.categoryColor("amber"))
                    }
                }
                FormSectionCard(title: "") {
                    FormFieldRow(title: "모양") {
                        Picker("모양", selection: preferenceBinding(\.appearance)) {
                            Text("시스템").tag("system")
                            Text("라이트").tag("light")
                            Text("다크").tag("dark")
                        }.labelsHidden().frame(width: 140)
                    }
                }
                FormSectionCard(title: "카테고리") {
                    ForEach(model.preferences.taskCategories, id: \.name) { category in
                        HStack(spacing: 8) {
                            Circle().fill(categoryColor(category.color)).frame(width: 8, height: 8)
                            Text(category.name)
                            Spacer()
                            Button(role: .destructive) {
                                model.updatePreferences { $0.taskCategories.removeAll { $0.name == category.name } }
                            } label: {
                                Image(systemName: "minus.circle").frame(width: 24, height: 24).contentShape(Rectangle())
                            }.buttonStyle(.plain).accessibilityLabel("\(category.name) 카테고리 제거")
                        }.frame(minHeight: 28)
                    }
                    HStack(spacing: 8) {
                        TextField("새 카테고리", text: $newCategoryName).textFieldStyle(.roundedBorder)
                        Picker("색상", selection: $newCategoryColor) {
                            Text("세이지").tag("sage")
                            Text("틸").tag("teal")
                            Text("블루").tag("blue")
                            Text("앰버").tag("amber")
                            Text("바이올렛").tag("violet")
                            Text("코랄").tag("coral")
                        }.labelsHidden().frame(width: 106)
                        Button("추가") { addCategory() }
                            .buttonStyle(FormActionButtonStyle())
                            .disabled(newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
                }
            }.padding(24)
        }.scrollIndicators(.automatic)
    }

    private func accentChoice(_ title: String, value: String, color: Color) -> some View {
        let isSelected = model.preferences.colorTheme == value
        return Button {
            model.updatePreferences { $0.colorTheme = value }
        } label: {
            HStack(spacing: 4) {
                Circle().fill(color).frame(width: 6, height: 6)
                Text(title)
                    .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(isSelected ? color : Color.primary.opacity(0.74))
            .frame(maxWidth: .infinity)
            .frame(height: 32)
            .background(isSelected ? Theme.sageSelection : hoveredAccent == value ? Theme.rowHover : Theme.card, in: RoundedRectangle(cornerRadius: 7))
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(isSelected ? color.opacity(0.55) : Theme.separator, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .onHover { hoveredAccent = $0 ? value : nil }
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var calendarTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                FormSectionCard(title: "표시 항목") {
                    HStack(spacing: 26) {
                        Toggle("할 일", isOn: preferenceBinding(\.calendarVisibility.tasks))
                        Toggle("일정", isOn: preferenceBinding(\.calendarVisibility.events))
                        Toggle("Progress", isOn: preferenceBinding(\.calendarVisibility.progress))
                    }.toggleStyle(.checkbox).frame(minHeight: 28)
                }
                FormSectionCard(title: "날짜와 시간") {
                    FormFieldRow(title: "주 시작 요일") {
                        Text("일요일")
                    }
                    FormFieldRow(title: "시간 표시") {
                        Picker("시간 표시", selection: preferenceBinding(\.timeFormat)) {
                            Text("24시간").tag("24h")
                            Text("12시간").tag("12h")
                        }.labelsHidden().frame(width: 140)
                    }
                    FormFieldRow(title: "시간대") {
                        TextField("IANA 시간대", text: $timezoneDraft)
                            .textFieldStyle(.roundedBorder)
                            .focused($timezoneFocused)
                            .onSubmit { saveTimezone() }
                    }
                }
                FormSectionCard(title: "일간 및 주간 시간 범위") {
                    HStack(spacing: 20) {
                        FormFieldRow(title: "시작") {
                            Picker("시작 시간", selection: preferenceBinding(\.visibleHours.start)) {
                                ForEach(0..<23, id: \.self) { hour in Text(String(format: "%02d:00", hour)).tag(hour) }
                            }.labelsHidden()
                        }
                        FormFieldRow(title: "종료") {
                            Picker("종료 시간", selection: preferenceBinding(\.visibleHours.end)) {
                                ForEach(1...24, id: \.self) { hour in Text(String(format: "%02d:00", hour)).tag(hour) }
                            }.labelsHidden()
                        }
                    }
                }
            }.padding(24)
        }.scrollIndicators(.automatic)
    }

    private var dataTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                FormSectionCard(title: "JSON 백업") {
                    HStack(spacing: 8) {
                        Button("내보내기", systemImage: "square.and.arrow.up") { Task { await prepareExport() } }
                            .buttonStyle(FormActionButtonStyle())
                        Button("가져오기", systemImage: "square.and.arrow.down") { isImporting = true }
                            .buttonStyle(FormActionButtonStyle())
                    }
                    if let statusMessage { Text(statusMessage).foregroundStyle(Theme.accent) }
                    if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
                }
                FormSectionCard(title: "저장 상태") {
                    FormFieldRow(title: "로컬 저장") {
                        Text(model.syncManager?.status ?? model.repositoryStatus.title).foregroundStyle(Theme.secondaryText)
                    }
                    if let detail = model.repositoryStatus.detail {
                        Text(detail).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }.padding(24)
        }.scrollIndicators(.automatic)
    }

    private func preferenceBinding<Value: Equatable>(_ keyPath: WritableKeyPath<AppPreferences, Value>) -> Binding<Value> {
        Binding(
            get: { model.preferences[keyPath: keyPath] },
            set: { value in
                model.updatePreferences { $0[keyPath: keyPath] = value }
            })
    }

    private func addCategory() {
        let name = newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !model.categoryNames.contains(where: { $0.localizedCaseInsensitiveCompare(name) == .orderedSame }) else {
            errorMessage = "같은 이름의 카테고리가 이미 있습니다."
            return
        }
        model.updatePreferences { $0.taskCategories.append(TaskCategoryPreference(name: name, color: newCategoryColor)) }
        newCategoryName = ""
        errorMessage = nil
    }

    private func saveTimezone() {
        let value = timezoneDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value != model.preferences.timeZone else { return }
        model.updatePreferences { $0.timeZone = value }
        timezoneDraft = model.preferences.timeZone
    }

    private func prepareExport() async {
        do {
            let items = try await model.repository.listItems()
            exportFile = BackupFile(data: try BackupCodec.encodeLocal(items: items, preferences: model.preferences))
            isExporting = true
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func restore(_ backup: LocalBackupV1) async {
        do {
            try await model.repository.upsertMany(backup.items)
            var preferences = backup.preferences
            preferences.taskOrders = backup.taskOrders
            preferences.reminderOffsets = backup.reminderOffsets
            preferences.remindersEnabled = backup.remindersEnabled
            model.updatePreferences { $0 = preferences }
            await model.refresh()
            statusMessage = "\(backup.items.count)개 백업 항목을 병합했습니다."
            errorMessage = nil
            candidate = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func categoryColor(_ name: String) -> Color {
        Theme.categoryColor(name)
    }
}

private enum SettingsSection: String, CaseIterable, Identifiable {
    case screen
    case calendar
    case data
    case account

    var id: String { rawValue }

    var title: String {
        switch self {
        case .screen: "화면"
        case .calendar: "캘린더"
        case .data: "데이터"
        case .account: "계정"
        }
    }

    var symbol: String {
        switch self {
        case .screen: "paintpalette"
        case .calendar: "calendar"
        case .data: "externaldrive"
        case .account: "person.crop.circle"
        }
    }
}
