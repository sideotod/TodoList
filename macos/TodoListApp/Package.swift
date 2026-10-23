// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TodoList",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "TodoList", targets: ["TodoList"]),
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "TodoList",
            dependencies: [.product(name: "Supabase", package: "supabase-swift")]
        ),
        .testTarget(name: "TodoListTests", dependencies: ["TodoList"]),
    ]
)
