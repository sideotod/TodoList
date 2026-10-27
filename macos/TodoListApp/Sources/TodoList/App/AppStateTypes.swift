enum AppRoute: String, CaseIterable, Identifiable, Hashable {
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
        case .today: "sun.max"
        case .progress: "circle.lefthalf.filled"
        case .calendar: "calendar"
        }
    }
}

enum CalendarViewMode: String, CaseIterable, Identifiable {
    case day
    case week
    case month
    case year

    var id: String { rawValue }
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
