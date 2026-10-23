import Foundation

enum DesignPreviewFixture {
    static let date = "2026-10-23"

    static let items: [CalendarItem] = {
        let tasks = [
            CalendarItem(id: "preview-task-paper", kind: .task, title: "논문 3장 데이터 분석 정리", category: "대학원 연구", categoryColor: "sage", timing: .date(startDate: nil, endDate: date, timeZone: "Asia/Seoul"), completion: .pending),
            CalendarItem(id: "preview-task-mail", kind: .task, title: "교수님께 세미나 자료 메일 보내기", category: "학교", categoryColor: "amber", timing: .date(startDate: nil, endDate: date, timeZone: "Asia/Seoul"), completion: .pending),
            CalendarItem(id: "preview-task-course", kind: .task, title: "수강신청 과목 우선순위 확인", category: "학교", categoryColor: "amber", timing: .date(startDate: nil, endDate: date, timeZone: "Asia/Seoul"), completion: .pending),
            CalendarItem(id: "preview-task-grant", kind: .task, title: "장학금 신청서 초안 작성", category: "학교", categoryColor: "amber", timing: .date(startDate: nil, endDate: date, timeZone: "Asia/Seoul"), completion: .pending),
            CalendarItem(id: "preview-task-meeting", kind: .task, title: "연구실 회의록 정리", category: "대학원 연구", categoryColor: "sage", timing: .date(startDate: nil, endDate: date, timeZone: "Asia/Seoul"), completion: .completed)
        ]

        let periods = [
            CalendarItem(id: "preview-paper", kind: .deadline, title: "논문 초안 제출", category: "대학원 연구", categoryColor: "sage", notes: "연구 논문의 1차 초안을 마무리하고 지도교수님께 전달합니다.", timing: .time(startAt: instant("2026-10-03", "00:00"), endAt: instant("2026-10-28", "18:00"), timeZone: "Asia/Seoul"), completion: .pending, checklist: [
                ChecklistRow(id: "paper-ref", title: "참고 문헌 정리", completed: true, linkedTaskId: nil),
                ChecklistRow(id: "paper-outline", title: "초안 목차 설계", completed: true, linkedTaskId: nil),
                ChecklistRow(id: "paper-intro", title: "1장 초안 작성", completed: true, linkedTaskId: nil),
                ChecklistRow(id: "paper-chapter", title: "3장 데이터 분석", completed: false, linkedTaskId: "preview-task-paper"),
                ChecklistRow(id: "paper-review", title: "전체 검토 및 교정", completed: false, linkedTaskId: nil),
                ChecklistRow(id: "paper-send", title: "교수님께 제출", completed: false, linkedTaskId: nil)
            ], focus: .deadline),
            CalendarItem(id: "preview-course", kind: .deadline, title: "수강신청 본신청", category: "학교", categoryColor: "blue", notes: "대학원 다음 학기 수강신청이 열립니다.", timing: .time(startAt: instant("2026-10-24", "10:00"), endAt: instant("2026-10-24", "10:00"), timeZone: "Asia/Seoul"), completion: .pending, checklist: [
                ChecklistRow(id: "course-choose", title: "신청 과목 결정", completed: true, linkedTaskId: nil),
                ChecklistRow(id: "course-priority", title: "과목별 우선순위 확인", completed: false, linkedTaskId: "preview-task-course"),
                ChecklistRow(id: "course-login", title: "신청 사이트 로그인 확인", completed: false, linkedTaskId: nil)
            ], focus: .start),
            CalendarItem(id: "preview-grant", kind: .window, title: "대학원 장학금 신청", category: "학교", categoryColor: "amber", timing: .time(startAt: instant("2026-10-20", "00:00"), endAt: instant("2026-11-03", "17:00"), timeZone: "Asia/Seoul"), completion: .pending, checklist: [
                ChecklistRow(id: "grant-eligibility", title: "자격 요건 검토", completed: true, linkedTaskId: nil),
                ChecklistRow(id: "grant-draft", title: "신청서 작성", completed: false, linkedTaskId: "preview-task-grant"),
                ChecklistRow(id: "grant-docs", title: "증빙자료 제출", completed: false, linkedTaskId: nil)
            ]),
            CalendarItem(id: "preview-concert", kind: .deadline, title: "콘서트 선예매", category: "개인", categoryColor: "violet", timing: .time(startAt: instant("2026-10-26", "20:00"), endAt: instant("2026-10-26", "20:00"), timeZone: "Asia/Seoul"), completion: .pending, checklist: [], focus: .start),
            CalendarItem(id: "preview-poster", kind: .deadline, title: "학회 포스터 제출", category: "대학원 연구", categoryColor: "coral", timing: .time(startAt: instant("2026-10-15", "00:00"), endAt: instant("2026-11-08", "23:59"), timeZone: "Asia/Seoul"), completion: .pending, checklist: [], focus: .deadline),
            CalendarItem(id: "preview-graduation", kind: .deadline, title: "졸업 요건 서류 제출", category: "학교", categoryColor: "sage", timing: .time(startAt: instant("2026-10-01", "00:00"), endAt: instant("2026-11-30", "17:00"), timeZone: "Asia/Seoul"), completion: .pending, checklist: [], focus: .deadline)
        ]

        let events = [
            CalendarItem(id: "preview-lab", kind: .event, title: "연구실 세미나", category: "대학원 연구", categoryColor: "sage", timing: .time(startAt: instant("2026-10-23", "13:00"), endAt: instant("2026-10-23", "14:30"), timeZone: "Asia/Seoul"), recurrence: WeeklyRecurrence(daysOfWeek: [5], untilDate: "2026-12-15")),
            CalendarItem(id: "preview-advisor", kind: .event, title: "지도교수 면담", category: "대학원 연구", categoryColor: "sage", timing: .time(startAt: instant("2026-10-23", "16:00"), endAt: instant("2026-10-23", "16:50"), timeZone: "Asia/Seoul")),
            CalendarItem(id: "preview-class", kind: .event, title: "연구방법론 수업", category: "학교", categoryColor: "amber", timing: .time(startAt: instant("2026-10-20", "10:00"), endAt: instant("2026-10-20", "11:30"), timeZone: "Asia/Seoul"), recurrence: WeeklyRecurrence(daysOfWeek: [2], untilDate: "2026-12-15"))
        ]
        return periods + tasks + events
    }()

    private static func instant(_ date: String, _ time: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        let parsed = formatter.date(from: "\(date) \(time)") ?? Date()
        return ISO8601DateFormatter.todoListTimestamp(for: parsed)
    }
}
