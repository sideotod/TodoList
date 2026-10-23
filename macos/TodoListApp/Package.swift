// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TodoList",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "TodoList", targets: ["TodoList"]),
    ],
    targets: [
        .executableTarget(name: "TodoList"),
        .testTarget(name: "TodoListTests", dependencies: ["TodoList"]),
    ]
)
