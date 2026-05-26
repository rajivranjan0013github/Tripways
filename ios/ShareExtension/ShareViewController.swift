/**
 * Share Extension for TripWays — Fire-and-Forget + Live Results
 *
 * 1. Receives shared URL
 * 2. Immediately POSTs to /api/extract-and-save (returns 202)
 * 3. Shows animated timeline progress
 * 4. Polls for results — shows extracted places when backend finishes
 * 5. User can close anytime — backend handles everything independently
 *
 * Uses pure UIKit to stay under iOS's ~120MB extension memory limit.
 */

import UIKit
import UniformTypeIdentifiers

// MARK: - Data Model

struct ExtractedPlace {
    let name: String
    let photoUrl: String?
    let city: String?
    let country: String?
}

// MARK: - Image Cache

class ImageCache {
    static let shared = NSCache<NSString, UIImage>()
}

// MARK: - ShareViewController

@objc(ShareViewController)
class ShareViewController: UIViewController {

    private let appGroupId = "group.com.thousandways.travel"
    private var backendUrl: String {
        let defaults = UserDefaults(suiteName: appGroupId)
        return defaults?.string(forKey: "backendUrl") ?? "http://172.20.10.6:3000"
    }

    // UI Components
    private let cardView = UIView()
    private let handleBar = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let urlLabel = UILabel()
    private var timelineSteps: [TimelineStepView] = []
    private let hintLabel = UILabel()
    private let placesHeaderLabel = UILabel()
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let premiumContainer = UIView()
    private let checkingSpinner = UIActivityIndicatorView(style: .large)
    private let checkingLabel = UILabel()
    private let timelineStack = UIStackView()

    // State
    private var sharedUrl: String = ""
    private var importId: String?
    private var extractedPlaces: [ExtractedPlace] = []
    private var pollTimer: Timer?

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        setupUI()

        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(backdropTapped(_:)))
        view.addGestureRecognizer(tapGesture)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extractSharedUrl()
    }

    deinit {
        pollTimer?.invalidate()
    }

    // MARK: - UI Setup

    private func setupUI() {
        // Card
        cardView.backgroundColor = .white
        cardView.layer.cornerRadius = 24
        cardView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        cardView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cardView)

        // Handle bar
        handleBar.backgroundColor = UIColor(red: 0.85, green: 0.87, blue: 0.9, alpha: 1.0)
        handleBar.layer.cornerRadius = 2.5
        handleBar.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(handleBar)

        // Title
        titleLabel.text = "Importing spots"
        titleLabel.font = UIFont.systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(titleLabel)

        // Close button
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        closeButton.tintColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(closeButton)

        // URL label
        urlLabel.font = UIFont.systemFont(ofSize: 12, weight: .regular)
        urlLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        urlLabel.numberOfLines = 1
        urlLabel.lineBreakMode = .byTruncatingMiddle
        urlLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(urlLabel)

        // Timeline steps
        let stepData = [
            ("Reel received", "🔗"),
            ("Extracting places...", "🔍"),
            ("Saving to your bucket list", "✨"),
        ]

        timelineStack.axis = .vertical
        timelineStack.spacing = 0
        timelineStack.alpha = 0 // Hidden until request is accepted
        timelineStack.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(timelineStack)

        for (index, data) in stepData.enumerated() {
            let stepView = TimelineStepView(
                label: data.0,
                emoji: data.1,
                isLast: index == stepData.count - 1
            )
            stepView.setStatus(.pending)
            timelineSteps.append(stepView)
            timelineStack.addArrangedSubview(stepView)
        }

        // Places header
        placesHeaderLabel.font = UIFont.systemFont(ofSize: 15, weight: .bold)
        placesHeaderLabel.textColor = UIColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0)
        placesHeaderLabel.alpha = 0
        placesHeaderLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(placesHeaderLabel)

        // Table View for places
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .white
        tableView.separatorStyle = .none
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(SharePlaceCell.self, forCellReuseIdentifier: "SharePlaceCell")
        tableView.alpha = 0
        tableView.rowHeight = 56
        cardView.addSubview(tableView)

        // Hint label
        hintLabel.text = "You can close this screen — spots will be saved automatically ✨"
        hintLabel.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        hintLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        hintLabel.textAlignment = .center
        hintLabel.numberOfLines = 0
        hintLabel.alpha = 0
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(hintLabel)

        // Premium container (hidden by default)
        premiumContainer.alpha = 0
        premiumContainer.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(premiumContainer)
        setupPremiumUI()

        // Checking spinner (shown initially while waiting for server response)
        checkingSpinner.color = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
        checkingSpinner.translatesAutoresizingMaskIntoConstraints = false
        checkingSpinner.startAnimating()
        cardView.addSubview(checkingSpinner)

        checkingLabel.text = "Checking..."
        checkingLabel.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        checkingLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        checkingLabel.textAlignment = .center
        checkingLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(checkingLabel)

        // Layout
        NSLayoutConstraint.activate([
            cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            cardView.topAnchor.constraint(equalTo: view.topAnchor),

            handleBar.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 10),
            handleBar.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
            handleBar.widthAnchor.constraint(equalToConstant: 40),
            handleBar.heightAnchor.constraint(equalToConstant: 5),

            titleLabel.topAnchor.constraint(equalTo: handleBar.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),

            closeButton.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            closeButton.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),

            urlLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            urlLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
            urlLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),

            timelineStack.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 24),
            timelineStack.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 28),
            timelineStack.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -28),

            placesHeaderLabel.topAnchor.constraint(equalTo: timelineStack.bottomAnchor, constant: 16),
            placesHeaderLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
            placesHeaderLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),

            tableView.topAnchor.constraint(equalTo: placesHeaderLabel.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: cardView.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: cardView.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: cardView.safeAreaLayoutGuide.bottomAnchor, constant: -16),

            hintLabel.topAnchor.constraint(equalTo: timelineStack.bottomAnchor, constant: 24),
            hintLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 40),
            hintLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -40),

            premiumContainer.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 24),
            premiumContainer.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 32),
            premiumContainer.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -32),

            checkingSpinner.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
            checkingSpinner.centerYAnchor.constraint(equalTo: cardView.centerYAnchor, constant: -20),
            checkingLabel.topAnchor.constraint(equalTo: checkingSpinner.bottomAnchor, constant: 12),
            checkingLabel.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
        ])
    }

    private func setupPremiumUI() {
        let lockLabel = UILabel()
        lockLabel.text = "🔒"
        lockLabel.font = UIFont.systemFont(ofSize: 48)
        lockLabel.textAlignment = .center
        lockLabel.translatesAutoresizingMaskIntoConstraints = false
        premiumContainer.addSubview(lockLabel)

        let titleLbl = UILabel()
        titleLbl.text = "Free Import Limit Reached"
        titleLbl.font = UIFont.systemFont(ofSize: 20, weight: .bold)
        titleLbl.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        titleLbl.textAlignment = .center
        titleLbl.translatesAutoresizingMaskIntoConstraints = false
        premiumContainer.addSubview(titleLbl)

        let subtitleLbl = UILabel()
        subtitleLbl.text = "You've used all 5 free reel imports.\nUpgrade to Premium for unlimited imports!"
        subtitleLbl.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        subtitleLbl.textColor = UIColor(red: 0.39, green: 0.45, blue: 0.55, alpha: 1.0)
        subtitleLbl.numberOfLines = 0
        subtitleLbl.textAlignment = .center
        subtitleLbl.translatesAutoresizingMaskIntoConstraints = false
        premiumContainer.addSubview(subtitleLbl)

        let upgradeBtn = UIButton(type: .system)
        upgradeBtn.setTitle("Upgrade to Premium", for: .normal)
        upgradeBtn.setTitleColor(.white, for: .normal)
        upgradeBtn.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        upgradeBtn.backgroundColor = UIColor(red: 0, green: 0.76, blue: 0.98, alpha: 1.0)
        upgradeBtn.layer.cornerRadius = 26
        upgradeBtn.translatesAutoresizingMaskIntoConstraints = false
        upgradeBtn.addTarget(self, action: #selector(upgradeTapped), for: .touchUpInside)
        premiumContainer.addSubview(upgradeBtn)

        let dismissBtn = UIButton(type: .system)
        dismissBtn.setTitle("Not now", for: .normal)
        dismissBtn.setTitleColor(UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0), for: .normal)
        dismissBtn.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        dismissBtn.translatesAutoresizingMaskIntoConstraints = false
        dismissBtn.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        premiumContainer.addSubview(dismissBtn)

        NSLayoutConstraint.activate([
            lockLabel.topAnchor.constraint(equalTo: premiumContainer.topAnchor, constant: 16),
            lockLabel.centerXAnchor.constraint(equalTo: premiumContainer.centerXAnchor),

            titleLbl.topAnchor.constraint(equalTo: lockLabel.bottomAnchor, constant: 16),
            titleLbl.centerXAnchor.constraint(equalTo: premiumContainer.centerXAnchor),

            subtitleLbl.topAnchor.constraint(equalTo: titleLbl.bottomAnchor, constant: 8),
            subtitleLbl.leadingAnchor.constraint(equalTo: premiumContainer.leadingAnchor),
            subtitleLbl.trailingAnchor.constraint(equalTo: premiumContainer.trailingAnchor),

            upgradeBtn.topAnchor.constraint(equalTo: subtitleLbl.bottomAnchor, constant: 24),
            upgradeBtn.centerXAnchor.constraint(equalTo: premiumContainer.centerXAnchor),
            upgradeBtn.widthAnchor.constraint(equalToConstant: 220),
            upgradeBtn.heightAnchor.constraint(equalToConstant: 52),

            dismissBtn.topAnchor.constraint(equalTo: upgradeBtn.bottomAnchor, constant: 12),
            dismissBtn.centerXAnchor.constraint(equalTo: premiumContainer.centerXAnchor),
            dismissBtn.bottomAnchor.constraint(equalTo: premiumContainer.bottomAnchor),
        ])
    }

    // MARK: - Extract Shared URL

    private func extractSharedUrl() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError("No content to process")
            return
        }

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            DispatchQueue.main.async {
                                self?.sharedUrl = url.absoluteString
                                self?.urlLabel.text = url.absoluteString
                                self?.fireAndForget()
                            }
                        }
                    }
                    return
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                        if let text = item as? String, let url = self?.extractUrl(from: text) {
                            DispatchQueue.main.async {
                                self?.sharedUrl = url
                                self?.urlLabel.text = url
                                self?.fireAndForget()
                            }
                        }
                    }
                    return
                }
            }
        }

        showError("No URL found in shared content")
    }

    private func extractUrl(from text: String) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let matches = detector?.matches(in: text, range: NSRange(text.startIndex..., in: text)) ?? []
        for match in matches {
            if let range = Range(match.range, in: text) {
                let url = String(text[range])
                if url.hasPrefix("http") { return url }
            }
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.hasPrefix("http") ? trimmed : nil
    }

    // MARK: - Fire and Forget + Polling

    private func fireAndForget() {
        let defaults = UserDefaults(suiteName: appGroupId)
        guard let userId = defaults?.string(forKey: "userId") else {
            showError("Please open TripWays first to sign in")
            return
        }

        // Build request (don't animate timeline yet — wait for response)
        guard let url = URL(string: "\(backendUrl)/api/extract-and-save") else {
            showError("Invalid backend URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = ["videoUrl": sharedUrl, "userId": userId]
        let isPremium = defaults?.bool(forKey: "isPremium") ?? false
        body["isPremium"] = isPremium

        let lower = sharedUrl.lowercased()
        if lower.contains("instagram.com") || lower.contains("instagr.am") {
            body["platform"] = "instagram"
        } else if lower.contains("tiktok.com") || lower.contains("vm.tiktok.com") {
            body["platform"] = "tiktok"
        }

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }

                if let error = error {
                    self.showError("Network error: \(error.localizedDescription)")
                    return
                }

                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    self.showError("Invalid response from server")
                    return
                }

                let success = json["success"] as? Bool ?? false
                if !success {
                    let code = json["code"] as? String ?? ""
                    if code == "IMPORT_LIMIT_REACHED" {
                        self.showPremiumUpgrade()
                        return
                    }
                    self.showError(json["error"] as? String ?? "Something went wrong")
                    return
                }

                // Backend accepted — NOW show & animate the timeline
                self.checkingSpinner.stopAnimating()
                UIView.animate(withDuration: 0.3) {
                    self.checkingSpinner.alpha = 0
                    self.checkingLabel.alpha = 0
                    self.timelineStack.alpha = 1
                }

                // Animate steps: reel received done → extracting active
                self.advanceToStep(0, status: .done)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.advanceToStep(1, status: .active)
                }

                // Show hint
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                    UIView.animate(withDuration: 0.5) {
                        self.hintLabel.alpha = 1
                    }
                }

                self.importId = (json["importId"] as? String) ?? {
                    // importId might be an ObjectId dict
                    if let idObj = json["importId"] {
                        return "\(idObj)"
                    }
                    return nil
                }()

                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    self.advanceToStep(1, status: .done)
                    self.advanceToStep(2, status: .active)
                }

                // Start polling for results
                if let importId = self.importId {
                    self.pollTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
                        self?.pollForResults(importId: importId)
                    }
                }
            }
        }.resume()
    }

    private func pollForResults(importId: String) {
        guard let url = URL(string: "\(backendUrl)/api/imports/\(importId)") else { return }

        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self = self, let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let importData = json["import"] as? [String: Any] else { return }

            let status = importData["status"] as? String ?? ""

            DispatchQueue.main.async {
                if status == "completed" {
                    self.pollTimer?.invalidate()
                    self.pollTimer = nil

                    // Parse places
                    if let resolvedPlaces = importData["resolvedPlaces"] as? [[String: Any]] {
                        self.extractedPlaces = resolvedPlaces.map { dict in
                            ExtractedPlace(
                                name: dict["name"] as? String ?? "Unknown",
                                photoUrl: dict["photoUrl"] as? String,
                                city: dict["city"] as? String,
                                country: dict["country"] as? String
                            )
                        }
                    }

                    // Animate to done
                    self.advanceToStep(2, status: .done)
                    self.titleLabel.text = "\(self.extractedPlaces.count) spots found"

                    // Show places list
                    if !self.extractedPlaces.isEmpty {
                        self.placesHeaderLabel.text = "Saved \(self.extractedPlaces.count) spots ✨"
                        self.tableView.reloadData()
                        UIView.animate(withDuration: 0.4) {
                            self.hintLabel.alpha = 0
                            self.placesHeaderLabel.alpha = 1
                            self.tableView.alpha = 1
                        }
                    }

                } else if status == "failed" {
                    self.pollTimer?.invalidate()
                    self.pollTimer = nil
                    let reason = importData["failureReason"] as? String ?? "Processing failed"
                    self.showError(reason)
                }
            }
        }.resume()
    }

    // MARK: - Step Animation

    private func advanceToStep(_ index: Int, status: TimelineStepView.StepStatus) {
        guard index < timelineSteps.count else { return }
        timelineSteps[index].setStatus(status, animated: true)
    }

    private func showError(_ message: String) {
        pollTimer?.invalidate()
        pollTimer = nil
        checkingSpinner.stopAnimating()
        UIView.animate(withDuration: 0.3) {
            self.checkingSpinner.alpha = 0
            self.checkingLabel.alpha = 0
            self.timelineStack.alpha = 1
        }
        for step in timelineSteps { step.alpha = 0.3 }
        hintLabel.text = message
        hintLabel.textColor = UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)
        hintLabel.alpha = 1
    }

    private func showPremiumUpgrade() {
        checkingSpinner.stopAnimating()
        UIView.animate(withDuration: 0.3) {
            self.checkingSpinner.alpha = 0
            self.checkingLabel.alpha = 0
            for step in self.timelineSteps { step.alpha = 0 }
            self.timelineStack.alpha = 0
            self.hintLabel.alpha = 0
            self.premiumContainer.alpha = 1
        }
    }

    // MARK: - Animations

    // MARK: - Actions

    @objc private func backdropTapped(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: view)
        if !cardView.frame.contains(point) { close() }
    }

    @objc private func closeTapped() { close() }

    @objc private func upgradeTapped() {
        extensionContext?.open(URL(string: "tripways://premium")!, completionHandler: { [weak self] _ in
            self?.close()
        })
    }

    private func close() {
        pollTimer?.invalidate()
        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

// MARK: - UITableViewDelegate & DataSource

extension ShareViewController: UITableViewDelegate, UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return extractedPlaces.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "SharePlaceCell", for: indexPath) as! SharePlaceCell
        let place = extractedPlaces[indexPath.row]
        cell.configure(with: place, number: indexPath.row + 1)
        return cell
    }
}

// MARK: - SharePlaceCell

class SharePlaceCell: UITableViewCell {
    private let numberLabel = UILabel()
    private let spotImageView = UIImageView()
    private let nameLabel = UILabel()
    private let locationLabel = UILabel()
    private let savedBadge = UIView()
    private let savedCheck = UILabel()
    private var imageTask: URLSessionDataTask?

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .clear

        numberLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        numberLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        numberLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(numberLabel)

        spotImageView.contentMode = .scaleAspectFill
        spotImageView.layer.cornerRadius = 10
        spotImageView.layer.masksToBounds = true
        spotImageView.backgroundColor = UIColor(red: 0.94, green: 0.96, blue: 0.97, alpha: 1.0)
        spotImageView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(spotImageView)

        nameLabel.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        nameLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        nameLabel.numberOfLines = 1
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(nameLabel)

        locationLabel.font = UIFont.systemFont(ofSize: 12, weight: .medium)
        locationLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        locationLabel.numberOfLines = 1
        locationLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(locationLabel)

        savedBadge.backgroundColor = UIColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0)
        savedBadge.layer.cornerRadius = 12
        savedBadge.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(savedBadge)

        savedCheck.text = "✓"
        savedCheck.font = UIFont.systemFont(ofSize: 12, weight: .bold)
        savedCheck.textColor = .white
        savedCheck.textAlignment = .center
        savedCheck.translatesAutoresizingMaskIntoConstraints = false
        savedBadge.addSubview(savedCheck)

        NSLayoutConstraint.activate([
            numberLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            numberLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            numberLabel.widthAnchor.constraint(equalToConstant: 24),

            spotImageView.leadingAnchor.constraint(equalTo: numberLabel.trailingAnchor, constant: 4),
            spotImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            spotImageView.widthAnchor.constraint(equalToConstant: 40),
            spotImageView.heightAnchor.constraint(equalToConstant: 40),

            nameLabel.leadingAnchor.constraint(equalTo: spotImageView.trailingAnchor, constant: 10),
            nameLabel.topAnchor.constraint(equalTo: spotImageView.topAnchor, constant: 2),
            nameLabel.trailingAnchor.constraint(equalTo: savedBadge.leadingAnchor, constant: -8),

            locationLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            locationLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 2),
            locationLabel.trailingAnchor.constraint(equalTo: nameLabel.trailingAnchor),

            savedBadge.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            savedBadge.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            savedBadge.widthAnchor.constraint(equalToConstant: 24),
            savedBadge.heightAnchor.constraint(equalToConstant: 24),

            savedCheck.centerXAnchor.constraint(equalTo: savedBadge.centerXAnchor),
            savedCheck.centerYAnchor.constraint(equalTo: savedBadge.centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        imageTask?.cancel()
        spotImageView.image = nil
    }

    func configure(with place: ExtractedPlace, number: Int) {
        numberLabel.text = "\(number)"
        nameLabel.text = place.name
        locationLabel.text = [place.city, place.country].compactMap { $0 }.joined(separator: ", ")

        if let urlString = place.photoUrl, let url = URL(string: urlString) {
            if let cached = ImageCache.shared.object(forKey: urlString as NSString) {
                spotImageView.image = cached
            } else {
                imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                    if let data = data, let image = UIImage(data: data) {
                        ImageCache.shared.setObject(image, forKey: urlString as NSString)
                        DispatchQueue.main.async { self?.spotImageView.image = image }
                    }
                }
                imageTask?.resume()
            }
        } else {
            let label = UILabel()
            label.text = "📍"
            label.font = UIFont.systemFont(ofSize: 16)
            label.textAlignment = .center
            label.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
            spotImageView.addSubview(label)
        }
    }
}

// MARK: - TimelineStepView

class TimelineStepView: UIView {

    enum StepStatus {
        case pending, active, done
    }

    private let circleView = UIView()
    private let emojiLabel = UILabel()
    private let checkmarkLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let lineView = UIView()
    private let textLabel = UILabel()
    private let isLast: Bool

    init(label: String, emoji: String, isLast: Bool) {
        self.isLast = isLast
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        circleView.layer.cornerRadius = 16
        circleView.backgroundColor = UIColor(red: 0.94, green: 0.96, blue: 0.97, alpha: 1.0)
        circleView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(circleView)

        emojiLabel.text = emoji
        emojiLabel.font = UIFont.systemFont(ofSize: 12)
        emojiLabel.textAlignment = .center
        emojiLabel.translatesAutoresizingMaskIntoConstraints = false
        circleView.addSubview(emojiLabel)

        checkmarkLabel.text = "✓"
        checkmarkLabel.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        checkmarkLabel.textColor = .white
        checkmarkLabel.textAlignment = .center
        checkmarkLabel.alpha = 0
        checkmarkLabel.translatesAutoresizingMaskIntoConstraints = false
        circleView.addSubview(checkmarkLabel)

        spinner.color = .white
        spinner.hidesWhenStopped = true
        spinner.translatesAutoresizingMaskIntoConstraints = false
        circleView.addSubview(spinner)

        lineView.backgroundColor = UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0)
        lineView.isHidden = isLast
        lineView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(lineView)

        textLabel.text = label
        textLabel.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        textLabel.textColor = UIColor(red: 0.39, green: 0.45, blue: 0.55, alpha: 1.0)
        textLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(textLabel)

        NSLayoutConstraint.activate([
            self.heightAnchor.constraint(equalToConstant: isLast ? 36 : 48),

            circleView.leadingAnchor.constraint(equalTo: leadingAnchor),
            circleView.topAnchor.constraint(equalTo: topAnchor),
            circleView.widthAnchor.constraint(equalToConstant: 32),
            circleView.heightAnchor.constraint(equalToConstant: 32),

            emojiLabel.centerXAnchor.constraint(equalTo: circleView.centerXAnchor),
            emojiLabel.centerYAnchor.constraint(equalTo: circleView.centerYAnchor),
            checkmarkLabel.centerXAnchor.constraint(equalTo: circleView.centerXAnchor),
            checkmarkLabel.centerYAnchor.constraint(equalTo: circleView.centerYAnchor),
            spinner.centerXAnchor.constraint(equalTo: circleView.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: circleView.centerYAnchor),

            lineView.centerXAnchor.constraint(equalTo: circleView.centerXAnchor),
            lineView.topAnchor.constraint(equalTo: circleView.bottomAnchor, constant: 3),
            lineView.bottomAnchor.constraint(equalTo: bottomAnchor),
            lineView.widthAnchor.constraint(equalToConstant: 2),

            textLabel.leadingAnchor.constraint(equalTo: circleView.trailingAnchor, constant: 12),
            textLabel.centerYAnchor.constraint(equalTo: circleView.centerYAnchor),
            textLabel.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setStatus(_ status: StepStatus, animated: Bool = false) {
        let updates = {
            switch status {
            case .pending:
                self.circleView.backgroundColor = UIColor(red: 0.94, green: 0.96, blue: 0.97, alpha: 1.0)
                self.emojiLabel.alpha = 0.4
                self.checkmarkLabel.alpha = 0
                self.spinner.stopAnimating()
                self.textLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
                self.lineView.backgroundColor = UIColor(red: 0.94, green: 0.96, blue: 0.97, alpha: 1.0)
                self.alpha = 0.5
            case .active:
                self.circleView.backgroundColor = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
                self.emojiLabel.alpha = 0
                self.checkmarkLabel.alpha = 0
                self.spinner.startAnimating()
                self.textLabel.textColor = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
                self.alpha = 1
            case .done:
                self.circleView.backgroundColor = UIColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0)
                self.emojiLabel.alpha = 0
                self.checkmarkLabel.alpha = 1
                self.spinner.stopAnimating()
                self.textLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
                self.lineView.backgroundColor = UIColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0)
                self.alpha = 1
            }
        }

        if animated {
            UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0.5, options: .curveEaseOut) {
                updates()
                self.circleView.transform = status == .done ? CGAffineTransform(scaleX: 1.15, y: 1.15) : .identity
            } completion: { _ in
                if status == .done {
                    UIView.animate(withDuration: 0.2) { self.circleView.transform = .identity }
                }
            }
        } else {
            updates()
        }
    }
}
