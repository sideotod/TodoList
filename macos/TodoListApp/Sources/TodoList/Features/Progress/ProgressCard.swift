import SwiftUI

struct ProgressCard: View {
    let item: CalendarItem
    let allItems: [CalendarItem]
    let now: Date
    let onSelect: () -> Void
    let onEdit: () -> Void
    let onToggleCompletion: () -> Void
    let onDelete: () -> Void

    @State private var confirmsDelete = false

    private var metrics: ProgressMetrics {
        ProgressProjection.metrics(for: item, now: now, items: allItems)
    }

    private var typeLabel: String {
        if item.kind == .event { return "일정" }
        if item.kind == .window { return "진행 기간" }
        if item.focus == .start { return "시작 대기" }
        return "마감 목표"
    }

    private var tint: Color {
        switch item.categoryColor {
        case "amber": Color(red: 0.71, green: 0.55, blue: 0.30)
        case "blue": Color(red: 0.28, green: 0.51, blue: 0.64)
        case "violet": Color(red: 0.47, green: 0.40, blue: 0.65)
        case "coral": Color(red: 0.72, green: 0.40, blue: 0.35)
        default: Theme.accent
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 5) {
                Text(item.category ?? "내 일정")
                Text("/")
                Text(typeLabel)
                Spacer(minLength: 5)
                Text(dateRange)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .font(.system(size: 9, weight: .medium))
            .foregroundStyle(tint)

            HStack(alignment: .firstTextBaseline, spacing: 7) {
                Button(action: onSelect) {
                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Text(ProgressProjection.compactCountdownLabel(for: item, now: now))
                    .font(.system(size: 21, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            if let notes = item.notes, !notes.isEmpty {
                Text(notes)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            if let fraction = metrics.elapsedFraction {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("기간 경과 \(Int((fraction * 100).rounded()))%")
                        Spacer()
                        Text("\(100 - Int((fraction * 100).rounded()))% 남음")
                    }
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                    ProgressView(value: fraction)
                        .tint(tint.opacity(0.8))
                        .scaleEffect(x: 1, y: 0.72, anchor: .center)
                        .accessibilityLabel("기간 경과율")
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(item.focus == .start ? "시작 시각까지" : "마감까지")
                        Spacer()
                        Text(item.focus == .start ? "정확한 시작 시각이 중요합니다" : metrics.countdownLabel)
                    }
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                    Rectangle()
                        .fill(tint.opacity(0.16))
                        .frame(height: 2)
                }
            }

            HStack(spacing: 6) {
                Image(systemName: "checklist")
                    .foregroundStyle(tint)
                if metrics.totalTasks == 0 {
                    Text("준비 작업 없음")
                } else {
                    Text("준비한 할 일 \(metrics.completedTasks)/\(metrics.totalTasks)")
                }
                Spacer()
                if item.completion == .completed {
                    Label("완료", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Theme.accent)
                }
                Button(action: onSelect) {
                    Label("상세 보기", systemImage: "arrow.up.right")
                        .labelStyle(.titleAndIcon)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(tint)
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.secondary)
        }
        .padding(15)
        .frame(maxWidth: .infinity, minHeight: 210, alignment: .topLeading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.separator, lineWidth: 1))
        .overlay(alignment: .top) {
            tint
                .frame(height: 3)
                .padding(.horizontal, 1)
                .clipShape(RoundedRectangle(cornerRadius: 3))
        }
        .contextMenu {
            Button("편집", systemImage: "pencil", action: onEdit)
            if item.kind != .event {
                Button(item.completion == .completed ? "완료 취소" : "완료 처리", systemImage: "checkmark.circle", action: onToggleCompletion)
            }
            Divider()
            Button("삭제", systemImage: "trash", role: .destructive) { confirmsDelete = true }
        }
        .confirmationDialog("Progress를 삭제할까요?", isPresented: $confirmsDelete, titleVisibility: .visible) {
            Button("삭제", role: .destructive, action: onDelete)
            Button("취소", role: .cancel) {}
        }
    }

    private var dateRange: String {
        switch item.timing {
        case .unscheduled:
            return "날짜 미정"
        case let .date(start, end, _):
            return start.map { "\(shortDate($0)) — \(shortDate(end))" } ?? shortDate(end)
        case let .time(start, end, zone):
            if item.kind == .deadline, item.focus == .start, let start {
                return formatInstant(start, zone: zone)
            }
            let first = start.flatMap { TodayProjection.localDate($0, zone: zone) }.map(shortDate)
            let last = end.flatMap { TodayProjection.localDate($0, zone: zone) }.map(shortDate)
            switch (first, last) {
            case let (first?, last?) where item.kind == .event:
                return "\(start.map { formatInstant($0, zone: zone) } ?? first) — \(end.map { formatInstant($0, zone: zone) } ?? last)"
            case let (first?, last?): return first == last ? first : "\(first) — \(last)"
            case let (first?, nil): return first
            case let (nil, last?): return last
            case (nil, nil): return "날짜 미정"
            }
        }
    }

    private func shortDate(_ value: String) -> String {
        String(value.dropFirst(5)).replacingOccurrences(of: "-", with: ".")
    }

    private func formatInstant(_ value: String, zone: String) -> String {
        guard let date = ISO8601DateFormatter.todoListDate(from: value) else { return value }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: zone) ?? .current
        formatter.dateFormat = "MM.dd HH:mm"
        return formatter.string(from: date)
    }
}
