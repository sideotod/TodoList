import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    var selectedSection: AppSection = .today
    var selectedDate: String
    private(set) var items: [CalendarItem] = []
    private(set) var repositoryStatus: RepositoryStatus = .loading
    let repository: any ItemRepository

    private let startupWarning: String?

    init(repository: any ItemRepository, selectedDate: String? = nil, startupWarning: String? = nil) {
        self.repository = repository
        self.selectedDate = selectedDate ?? Self.todayDate()
        self.startupWarning = startupWarning
    }

    func load() async {
        do {
            items = try await repository.listItems()
            repositoryStatus = startupWarning.map(RepositoryStatus.memoryFallback) ?? .local
        } catch {
            repositoryStatus = .loadFailed(error.localizedDescription)
        }
    }

    func refresh() async {
        await load()
    }

    private static func todayDate() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    static func bootstrap() -> AppModel {
        do {
            return AppModel(repository: try SwiftDataItemRepository())
        } catch {
            return AppModel(
                repository: InMemoryItemRepository(),
                startupWarning: "영구 저장소를 열지 못해 이번 실행에서는 메모리 저장을 사용합니다. 원인: \(error.localizedDescription)"
            )
        }
    }
}

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case today
    case progress
    case calendar

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "오늘"
        case .progress: "Progress"
        case .calendar: "캘린더"
        }
    }

    var symbol: String {
        switch self {
        case .today: "checklist"
        case .progress: "chart.bar.xaxis"
        case .calendar: "calendar"
        }
    }
}

enum RepositoryStatus: Equatable {
    case loading
    case local
    case memoryFallback(String)
    case loadFailed(String)

    var title: String {
        switch self {
        case .loading: "로컬 데이터 불러오는 중"
        case .local: "이 Mac에 저장됨 · 동기화 설정 없음"
        case .memoryFallback: "메모리 저장 · 재실행 시 유지되지 않음"
        case .loadFailed: "로컬 데이터를 불러오지 못함"
        }
    }

    var detail: String? {
        switch self {
        case .memoryFallback(let message), .loadFailed(let message): message
        case .loading, .local: nil
        }
    }
}
