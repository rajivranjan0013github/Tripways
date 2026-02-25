import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import GoogleMaps

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Load Google Maps API key from .env file
    if let apiKey = Self.readEnvValue(forKey: "GOOGLE_MAPS_API_KEY"), !apiKey.isEmpty {
      GMSServices.provideAPIKey(apiKey)
    }
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "TripWays",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  /// Reads a value from the .env file in the project root
  static func readEnvValue(forKey key: String) -> String? {
    // The .env file is at the project root (one level above the ios folder)
    guard let projectRoot = Bundle.main.infoDictionary?["PROJECT_DIR"] as? String ?? ProcessInfo.processInfo.environment["INIT_CWD"] else {
      // Fallback: try common paths during development
      let possiblePaths = [
        URL(fileURLWithPath: #file).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent(".env").path,
        "\(NSHomeDirectory())/../../../.env"
      ]
      for path in possiblePaths {
        if let value = readKeyFromFile(path: path, key: key) {
          return value
        }
      }
      return nil
    }
    let envPath = "\(projectRoot)/.env"
    return readKeyFromFile(path: envPath, key: key)
  }

  static func readKeyFromFile(path: String, key: String) -> String? {
    guard let content = try? String(contentsOfFile: path, encoding: .utf8) else { return nil }
    for line in content.components(separatedBy: .newlines) {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.hasPrefix("#") || trimmed.isEmpty { continue }
      let parts = trimmed.split(separator: "=", maxSplits: 1)
      if parts.count == 2 && String(parts[0]).trimmingCharacters(in: .whitespaces) == key {
        return String(parts[1]).trimmingCharacters(in: .whitespaces)
      }
    }
    return nil
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
