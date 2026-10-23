import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    let model: AppModel
    let onClose: (() -> Void)?

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

    init(model: AppModel, onClose: (() -> Void)? = nil) {
        self.model = model
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: 0) {
            if let onClose {
                HStack {
                    Text("설정 · 이 Mac")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color(red: 0.49, green: 0.56, blue: 0.50))
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color(red: 0.47, green: 0.55, blue: 0.48))
                            .frame(width: 27, height: 27)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("설정 닫기")
                }
                .padding(.horizontal, 22)
                .frame(height: 48)
                Divider()
            }

            VStack(alignment: .leading, spacing: 0) {
                Text("PREFERENCES")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(Color(red: 0.36, green: 0.53, blue: 0.41))
                    .padding(.bottom, 7)
                Text("설정")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color(red: 0.16, green: 0.20, blue: 0.17))
                    .padding(.bottom, 12)
                sectionPicker
                    .padding(.bottom, 14)
                Divider()
                    .padding(.bottom, 7)
                selectedContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
            .padding(.horizontal, onClose == nil ? 18 : 22)
            .padding(.top, onClose == nil ? 18 : 21)
            .padding(.bottom, 12)
        }
        .frame(width: onClose == nil ? 690 : nil, height: onClose == nil ? 560 : nil)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.white)
        .onAppear { timezoneDraft = model.preferences.timeZone }
        .onChange(of: model.preferences.timeZone) { _, value in timezoneDraft = value }
        .fileExporter(
            isPresented: $isExporting,
            document: exportFile,
            contentType: .json,
            defaultFilename: "TodoList-local-backup"
        ) { result in
            switch result {
            case .success(let url): statusMessage = "백업을 저장했습니다: \(url.lastPathComponent)"; errorMessage = nil
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

    private var sectionPicker: some View {
        HStack(spacing: 7) {
            ForEach(SettingsSection.allCases) { section in
                Button {
                    selectedSection = section
                } label: {
                    Text(section.title)
                        .font(.system(size: 10, weight: selectedSection == section ? .semibold : .regular))
                        .foregroundStyle(selectedSection == section ? Color(red: 0.26, green: 0.42, blue: 0.31) : Color(red: 0.42, green: 0.48, blue: 0.43))
                        .padding(.horizontal, 11)
                        .frame(height: 29)
                        .background(selectedSection == section ? Theme.sageSelection : .white, in: RoundedRectangle(cornerRadius: 7))
                        .overlay(RoundedRectangle(cornerRadius: 7).stroke(selectedSection == section ? Theme.accent.opacity(0.22) : Theme.separator, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var selectedContent: some View {
        switch selectedSection {
        case .screen: generalTab
        case .calendar: calendarTab
        case .data: dataTab
        case .account: AccountSettingsView(authService: model.authService)
        }
    }

    private var generalTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                settingsGroupTitle("강조 색상")
                HStack(spacing: 5) {
                    accentChoice("세이지", value: "sage", color: Theme.accent)
                    accentChoice("아크틱", value: "arctic", color: Theme.blue)
                    accentChoice("로즈", value: "rose", color: Color(red: 0.69, green: 0.39, blue: 0.47))
                    accentChoice("앰버", value: "amber", color: Color(red: 0.71, green: 0.55, blue: 0.30))
                }
                .padding(.bottom, 14)

                settingsDivider
                HStack {
                    settingsGroupTitle("모양")
                    Spacer()
                    Picker("모양", selection: preferenceBinding(\.appearance)) {
                        Text("시스템").tag("system")
                        Text("라이트").tag("light")
                        Text("다크").tag("dark")
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(width: 100, alignment: .trailing)
                }
                .padding(.vertical, 9)

                settingsDivider
                    .padding(.bottom, 13)
                settingsGroupTitle("카테고리")
                ForEach(model.preferences.taskCategories, id: \.name) { category in
                    HStack {
                        Circle().fill(categoryColor(category.color)).frame(width: 9, height: 9)
                        Text(category.name).font(.system(size: 11))
                        Spacer()
                        Button(role: .destructive) {
                            model.updatePreferences { $0.taskCategories.removeAll { $0.name == category.name } }
                        } label: {
                            Image(systemName: "minus.circle")
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(category.name) 카테고리 제거")
                    }
                    .frame(height: 31)
                }
                HStack {
                    TextField("새 카테고리", text: $newCategoryName)
                        .textFieldStyle(.roundedBorder)
                    Picker("색상", selection: $newCategoryColor) {
                        Text("세이지").tag("sage")
                        Text("틸").tag("teal")
                        Text("블루").tag("blue")
                        Text("앰버").tag("amber")
                        Text("바이올렛").tag("violet")
                        Text("코랄").tag("coral")
                    }
                    .frame(width: 125)
                    Button("추가") { addCategory() }
                        .buttonStyle(.bordered)
                        .disabled(newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.top, 7)
                .padding(.bottom, 12)

                if let errorMessage {
                    Text(errorMessage).font(.system(size: 10)).foregroundStyle(.red)
                }
                if let statusMessage {
                    Text(statusMessage).font(.system(size: 10)).foregroundStyle(Theme.accent)
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private func settingsGroupTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Color(red: 0.28, green: 0.32, blue: 0.29))
            .padding(.vertical, 7)
    }

    private var settingsDivider: some View {
        Rectangle()
            .fill(Theme.separator)
            .frame(height: 1)
    }

    private func accentChoice(_ title: String, value: String, color: Color) -> some View {
        let isSelected = model.preferences.colorTheme == value
        return Button {
            model.updatePreferences { $0.colorTheme = value }
        } label: {
            HStack(spacing: 4) {
                Circle().fill(color).frame(width: 6, height: 6)
                Text(title)
                    .font(.system(size: 9, weight: isSelected ? .semibold : .regular))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(isSelected ? color : Color.primary.opacity(0.74))
            .frame(maxWidth: .infinity)
            .frame(height: 28)
            .background(.white, in: RoundedRectangle(cornerRadius: 7))
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(color.opacity(isSelected ? 0.75 : 0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var calendarTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                settingsGroupTitle("표시 항목")
                settingRow("할 일") { Toggle("할 일", isOn: preferenceBinding(\.calendarVisibility.tasks)).labelsHidden() }
                settingsDivider
                settingRow("일정") { Toggle("일정", isOn: preferenceBinding(\.calendarVisibility.events)).labelsHidden() }
                settingsDivider
                settingRow("Progress") { Toggle("Progress", isOn: preferenceBinding(\.calendarVisibility.progress)).labelsHidden() }
                settingsDivider

                settingsGroupTitle("날짜와 시간")
                settingRow("주 시작 요일") {
                    Picker("주 시작 요일", selection: preferenceBinding(\.weekStartsOn)) {
                        Text("월요일").tag(1)
                        Text("일요일").tag(0)
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(width: 100, alignment: .trailing)
                }
                settingsDivider
                settingRow("시간 표시") {
                    Picker("시간 표시", selection: preferenceBinding(\.timeFormat)) {
                        Text("24시간").tag("24h")
                        Text("12시간").tag("12h")
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(width: 100, alignment: .trailing)
                }
                settingsDivider
                settingRow("시간대") {
                    TextField("IANA 시간대", text: $timezoneDraft)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 135)
                        .onSubmit { model.updatePreferences { $0.timeZone = timezoneDraft } }
                }
                settingsDivider

                settingsGroupTitle("일간 및 주간 보기")
                settingRow("시작 시간") {
                    Picker("시작 시간", selection: preferenceBinding(\.visibleHours.start)) {
                        ForEach(0..<23, id: \.self) { hour in Text(String(format: "%02d:00", hour)).tag(hour) }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(width: 100, alignment: .trailing)
                }
                settingsDivider
                settingRow("종료 시간") {
                    Picker("종료 시간", selection: preferenceBinding(\.visibleHours.end)) {
                        ForEach(1...24, id: \.self) { hour in Text(hour == 24 ? "24:00" : String(format: "%02d:00", hour)).tag(hour) }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(width: 100, alignment: .trailing)
                }
            }
        }.scrollIndicators(.hidden)
    }

    private var dataTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                settingsGroupTitle("로컬 JSON 백업")
                Text("이 백업에는 이 Mac에 저장된 항목과 캘린더 설정이 포함됩니다. 가져오기는 같은 ID 항목을 갱신하고 나머지 기존 항목을 보존합니다.")
                    .font(.system(size: 10))
                    .foregroundStyle(Color(red: 0.61, green: 0.66, blue: 0.61))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 12)
                HStack {
                    Button("JSON 내보내기", systemImage: "square.and.arrow.up") { Task { await prepareExport() } }
                        .buttonStyle(.bordered)
                    Button("JSON 가져오기", systemImage: "square.and.arrow.down") { isImporting = true }
                        .buttonStyle(.bordered)
                }
                if let statusMessage { Text(statusMessage).font(.system(size: 10)).foregroundStyle(Theme.accent).padding(.top, 9) }
                if let errorMessage { Text(errorMessage).font(.system(size: 10)).foregroundStyle(.red).padding(.top, 9) }

                settingsDivider.padding(.vertical, 13)
                settingsGroupTitle("저장 상태")
                settingRow("로컬 저장") {
                    Text(model.repositoryStatus.title)
                        .font(.system(size: 10))
                        .foregroundStyle(Color(red: 0.46, green: 0.57, blue: 0.48))
                        .lineLimit(1)
                }
                if let detail = model.repositoryStatus.detail {
                    Text(detail)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 10)
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private func settingRow<Control: View>(_ title: String, @ViewBuilder control: () -> Control) -> some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(Color(red: 0.31, green: 0.35, blue: 0.32))
            Spacer(minLength: 4)
            control()
        }
        .frame(minHeight: 37)
    }

    private func preferenceBinding<Value: Equatable>(_ keyPath: WritableKeyPath<AppPreferences, Value>) -> Binding<Value> {
        Binding(get: { model.preferences[keyPath: keyPath] }, set: { value in
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
        switch name {
        case "amber": Color(red: 0.71, green: 0.55, blue: 0.30)
        case "blue": Theme.blue
        case "violet": Color(red: 0.47, green: 0.40, blue: 0.65)
        case "coral": Color(red: 0.72, green: 0.40, blue: 0.35)
        default: Theme.accent
        }
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
}
