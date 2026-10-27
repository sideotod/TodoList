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
    @State private var isHovered = false

    private let cardHeight: CGFloat = 154
    private let cardCornerRadius: CGFloat = 11

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
        Button(action: onSelect) {
            VStack(spacing: 0) {
                tint.frame(height: 3)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 5) {
                        Text(item.category ?? "내 일정")
                        Text("/")
                        Text(typeLabel)
                        Spacer(minLength: 5)
                        Text(dateRange)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(tint)
                    .frame(height: 14)

                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text(item.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        if item.kind != .event {
                            TimelineView(.periodic(from: .now, by: 1)) { context in
                                HStack(alignment: .firstTextBaseline, spacing: 4) {
                                    if let label = ProgressProjection.countdownReferenceLabel(for: item, now: context.date) {
                                        Text(label)
                                            .font(.system(size: 10, weight: .medium))
                                            .foregroundStyle(Theme.secondaryText)
                                    }
                                    Text(ProgressProjection.compactCountdownLabel(for: item, now: context.date))
                                        .font(.system(size: 21, weight: .semibold, design: .rounded).monospacedDigit())
                                        .foregroundStyle(ProgressProjection.isCountdownUrgent(for: item, now: context.date) ? Color.red : tint)
                                }
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                            }
                        }
                    }
                    .frame(height: 38)

                    Group {
                        if let fraction = metrics.elapsedFraction {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("기간 경과 \(Int((fraction * 100).rounded()))%")
                                    Spacer()
                                    Text("\(100 - Int((fraction * 100).rounded()))% 남음")
                                }
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                                ProgressView(value: fraction)
                                    .tint(tint.opacity(0.8))
                                    .scaleEffect(x: 1, y: 0.72, anchor: .center)
                                    .accessibilityLabel("기간 경과율")
                            }
                        } else {
                            Capsule()
                                .fill(Theme.separator)
                                .frame(height: 4)
                                .accessibilityHidden(true)
                        }
                    }
                    .frame(height: 26)

                    Spacer(minLength: 0)
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
                        Label("상세 보기", systemImage: "arrow.up.right")
                            .labelStyle(.titleAndIcon)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(tint)
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(height: 15)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 13)
            }
            .frame(maxWidth: .infinity)
            .frame(height: cardHeight, alignment: .topLeading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous).stroke(
                    isHovered ? Theme.accent.opacity(0.32) : Theme.separator, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.12)) { isHovered = hovering }
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
