/**
 * Share Extension for TripWays
 *
 * WhatsApp-style share extension with a custom native UI:
 * 1. Shows the shared URL
 * 2. Calls backend to extract places from the video (SSE streaming)
 * 3. Shows live progress + place list
 * 4. Saves extracted places to user's bucket list
 *
 * All within the share sheet — no leaving to the main app.
 * Uses pure UIKit + URLSession to stay under iOS's ~120MB extension memory limit.
 */

import UIKit
import UniformTypeIdentifiers

// MARK: - Data Model

struct ExtractedPlace {
    let id: String
    let name: String
    let category: String
    let photoUrl: String?
    let placeId: String?
    let coordinates: (lat: Double, lng: Double)?
    let country: String?
    let city: String?
    let address: String?
    let rating: Double?
    let userRatingCount: Int?
    var isSelected: Bool = true
}

// MARK: - Image Cache

class ImageCache {
    static let shared = NSCache<NSString, UIImage>()
    
    static func cacheImage(_ image: UIImage, for url: String) {
        shared.setObject(image, forKey: url as NSString)
    }
    
    static func getImage(for url: String) -> UIImage? {
        return shared.object(forKey: url as NSString)
    }
}

// MARK: - ShareViewController

@objc(ShareViewController)
class ShareViewController: UIViewController {

    private let appGroupId = "group.com.thousandways.travel"
    // Read backend URL from App Group or use fallback
    private var backendUrl: String {
        let defaults = UserDefaults(suiteName: appGroupId)
        return defaults?.string(forKey: "backendUrl") ?? "http://172.20.10.6:3000"
    }

    // UI Components
    private let headerView = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let urlLabel = UILabel()
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var categoryCollectionView: UICollectionView!
    private let tableView = UITableView(frame: .zero, style: .grouped)
    private let saveButton = UIButton(type: .system)
    private let savedCheckView = UIImageView()
    private let addSpotsBar = UIView()

    // State
    private var sharedUrl: String = ""
    private var allPlaces: [ExtractedPlace] = []
    private var categories: [String] = ["All"]
    private var selectedCategory: String = "All"
    
    // Grouped data for table view: [(country, city, spots)]
    private var groupedSections: [(country: String, city: String, spots: [ExtractedPlace])] = []
    
    private var destination: String = ""
    private var isProcessing = false
    private var isSaving = false
    private var isSaved = false

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extractSharedUrl()
    }

    // MARK: - UI Setup

    private func setupUI() {
        view.backgroundColor = .white

        // Header
        headerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerView)

        titleLabel.text = "Discover spots"
        titleLabel.font = UIFont.systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)

        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .medium)
        closeButton.tintColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(closeButton)

        // URL display
        urlLabel.font = UIFont.systemFont(ofSize: 13, weight: .regular)
        urlLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.74, alpha: 1.0)
        urlLabel.numberOfLines = 1
        urlLabel.lineBreakMode = .byTruncatingMiddle
        urlLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(urlLabel)

        // Status area
        let statusStack = UIStackView(arrangedSubviews: [spinner, statusLabel])
        statusStack.axis = .horizontal
        statusStack.spacing = 10
        statusStack.alignment = .center
        statusStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusStack)

        spinner.hidesWhenStopped = true
        spinner.color = UIColor(red: 0.24, green: 0.74, blue: 0.97, alpha: 1.0)

        statusLabel.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        statusLabel.textColor = UIColor(red: 0.28, green: 0.33, blue: 0.41, alpha: 1.0)
        statusLabel.text = "Analyzing link..."

        // Categories
        setupCategoryCollectionView()
        categoryCollectionView.alpha = 0
        view.addSubview(categoryCollectionView)

        // Table View for places
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .white
        tableView.separatorStyle = .none
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(PlaceCell.self, forCellReuseIdentifier: "PlaceCell")
        tableView.register(CityHeaderCell.self, forHeaderFooterViewReuseIdentifier: "CityHeaderCell")
        tableView.alpha = 0
        tableView.sectionHeaderHeight = UITableView.automaticDimension
        tableView.estimatedSectionHeaderHeight = 44
        view.addSubview(tableView)

        // Save Button Bottom Bar
        addSpotsBar.translatesAutoresizingMaskIntoConstraints = false
        addSpotsBar.backgroundColor = .clear
        addSpotsBar.alpha = 0
        view.addSubview(addSpotsBar)

        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.backgroundColor = UIColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0) // Green #10B981
        saveButton.setTitle("Save spots", for: .normal)
        saveButton.setTitleColor(.white, for: .normal)
        saveButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .bold)
        saveButton.layer.cornerRadius = 24
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        addSpotsBar.addSubview(saveButton)

        // Saved checkmark (hidden initially)
        savedCheckView.image = UIImage(systemName: "checkmark.circle.fill")
        savedCheckView.tintColor = UIColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0)
        savedCheckView.translatesAutoresizingMaskIntoConstraints = false
        savedCheckView.alpha = 0
        view.addSubview(savedCheckView)

        // Layout
        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            headerView.heightAnchor.constraint(equalToConstant: 44),

            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            titleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor),

            closeButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            closeButton.trailingAnchor.constraint(equalTo: headerView.trailingAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),

            urlLabel.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 4),
            urlLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            urlLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            statusStack.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 20),
            statusStack.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            categoryCollectionView.topAnchor.constraint(equalTo: statusStack.bottomAnchor, constant: 16),
            categoryCollectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            categoryCollectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            categoryCollectionView.heightAnchor.constraint(equalToConstant: 40),

            tableView.topAnchor.constraint(equalTo: categoryCollectionView.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: addSpotsBar.topAnchor, constant: -12),

            addSpotsBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 22),
            addSpotsBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -22),
            addSpotsBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            addSpotsBar.heightAnchor.constraint(equalToConstant: 48),

            saveButton.topAnchor.constraint(equalTo: addSpotsBar.topAnchor),
            saveButton.leadingAnchor.constraint(equalTo: addSpotsBar.leadingAnchor),
            saveButton.trailingAnchor.constraint(equalTo: addSpotsBar.trailingAnchor),
            saveButton.bottomAnchor.constraint(equalTo: addSpotsBar.bottomAnchor),

            savedCheckView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            savedCheckView.centerYAnchor.constraint(equalTo: addSpotsBar.centerYAnchor),
            savedCheckView.widthAnchor.constraint(equalToConstant: 32),
            savedCheckView.heightAnchor.constraint(equalToConstant: 32),
        ])
    }

    private func setupCategoryCollectionView() {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.estimatedItemSize = UICollectionViewFlowLayout.automaticSize
        layout.minimumInteritemSpacing = 8
        layout.sectionInset = UIEdgeInsets(top: 0, left: 20, bottom: 0, right: 20)

        categoryCollectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        categoryCollectionView.translatesAutoresizingMaskIntoConstraints = false
        categoryCollectionView.backgroundColor = .clear
        categoryCollectionView.showsHorizontalScrollIndicator = false
        categoryCollectionView.delegate = self
        categoryCollectionView.dataSource = self
        categoryCollectionView.register(CategoryCell.self, forCellWithReuseIdentifier: "CategoryCell")
    }

    // MARK: - Extract Shared URL

    private func extractSharedUrl() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            updateStatus("No content to process", isError: true)
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
                                self?.startProcessing()
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
                                self?.startProcessing()
                            }
                        }
                    }
                    return
                }
            }
        }

        updateStatus("No URL found in shared content", isError: true)
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

    // MARK: - Backend Processing (SSE Streaming)

    private func startProcessing() {
        isProcessing = true
        spinner.startAnimating()
        updateStatus("Analyzing link...")

        guard let url = URL(string: "\(backendUrl)/api/extract-video-places") else {
            updateStatus("Invalid backend URL", isError: true)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Include userId so the backend creates an ImportedVideo record
        let defaults = UserDefaults(suiteName: appGroupId)
        var body: [String: Any] = ["videoUrl": sharedUrl]
        if let userId = defaults?.string(forKey: "userId") {
            body["userId"] = userId
        }
        // Detect platform from URL
        let lower = sharedUrl.lowercased()
        if lower.contains("instagram.com") || lower.contains("instagr.am") {
            body["platform"] = "instagram"
        } else if lower.contains("tiktok.com") || lower.contains("vm.tiktok.com") {
            body["platform"] = "tiktok"
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let session = URLSession(configuration: .default, delegate: nil, delegateQueue: nil)
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                DispatchQueue.main.async {
                    self.updateStatus("Error: \(error.localizedDescription)", isError: true)
                    self.spinner.stopAnimating()
                }
                return
            }

            guard let data = data, let text = String(data: data, encoding: .utf8) else {
                DispatchQueue.main.async {
                    self.updateStatus("No response from server", isError: true)
                    self.spinner.stopAnimating()
                }
                return
            }

            // Parse SSE events
            self.parseSSEEvents(text)
        }
        task.resume()
    }

    private func parseSSEEvents(_ text: String) {
        let eventBlocks = text.components(separatedBy: "\n\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }

        var allPlaces: [[String: Any]] = []
        var destinationName = ""

        for block in eventBlocks {
            let lines = block.components(separatedBy: "\n")
            var eventType = ""
            var eventData = ""

            for line in lines {
                if line.hasPrefix("event: ") {
                    eventType = String(line.dropFirst(7))
                }
                if line.hasPrefix("data: ") {
                    eventData = String(line.dropFirst(6))
                }
            }

            guard !eventType.isEmpty, !eventData.isEmpty,
                  let jsonData = eventData.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                continue
            }

            switch eventType {
            case "progress":
                let message = parsed["message"] as? String ?? "Processing..."
                DispatchQueue.main.async { [weak self] in
                    self?.updateStatus(message)
                }

            case "place_batch":
                if let batchPlaces = parsed["places"] as? [[String: Any]] {
                    allPlaces.append(contentsOf: batchPlaces)
                    let totalFound = parsed["totalFound"] as? Int ?? allPlaces.count
                    let totalExpected = parsed["totalExpected"] as? Int ?? totalFound
                    DispatchQueue.main.async { [weak self] in
                        self?.updateStatus("Found \(totalFound) of ~\(totalExpected) places...")
                        self?.updatePlaces(allPlaces)
                    }
                }

            case "places":
                if let finalPlaces = parsed["places"] as? [[String: Any]] {
                    allPlaces = finalPlaces
                }
                destinationName = parsed["destination"] as? String ?? ""
                DispatchQueue.main.async { [weak self] in
                    self?.destination = destinationName
                    self?.updatePlaces(allPlaces)
                    self?.finishProcessing(allPlaces.count)
                }

            case "error":
                let message = parsed["message"] as? String ?? "Unknown error"
                DispatchQueue.main.async { [weak self] in
                    self?.updateStatus("Error: \(message)", isError: true)
                    self?.spinner.stopAnimating()
                }

            default:
                break
            }
        }
    }

    private func updatePlaces(_ placeDicts: [[String: Any]]) {
        allPlaces = placeDicts.map { dict in
            let coords = dict["coordinates"] as? [String: Any]
            let placeId = dict["id"] as? String ?? dict["placeId"] as? String ?? UUID().uuidString
            return ExtractedPlace(
                id: placeId,
                name: dict["name"] as? String ?? "Unknown",
                category: dict["interest"] as? String ?? dict["category"] as? String ?? "sightseeing",
                photoUrl: dict["photoUrl"] as? String,
                placeId: placeId,
                coordinates: coords != nil ? (
                    lat: coords?["lat"] as? Double ?? 0,
                    lng: coords?["lng"] as? Double ?? 0
                ) : nil,
                country: dict["country"] as? String,
                city: dict["city"] as? String,
                address: dict["address"] as? String,
                rating: dict["rating"] as? Double,
                userRatingCount: dict["userRatingCount"] as? Int,
                isSelected: true
            )
        }
        
        // Update categories
        let countries = Set(allPlaces.compactMap { $0.country })
        categories = ["All"] + Array(countries).sorted()
        categoryCollectionView.reloadData()
        
        refreshGroupedSections()
    }

    private func refreshGroupedSections() {
        // Filter by category (which is country name for video places)
        let filtered = selectedCategory == "All" 
            ? allPlaces 
            : allPlaces.filter { $0.country == selectedCategory }
            
        // Group by country -> city
        var grouped: [String: [String: [ExtractedPlace]]] = [:]
        for place in filtered {
            let country = place.country ?? "Unknown"
            let city = place.city ?? "Unknown"
            if grouped[country] == nil { grouped[country] = [:] }
            if grouped[country]![city] == nil { grouped[country]![city] = [] }
            grouped[country]![city]!.append(place)
        }
        
        // Flatten into sections
        var newSections: [(country: String, city: String, spots: [ExtractedPlace])] = []
        let sortedCountries = grouped.keys.sorted()
        for country in sortedCountries {
            let sortedCities = grouped[country]!.keys.sorted()
            for city in sortedCities {
                newSections.append((country: country, city: city, spots: grouped[country]![city]!))
            }
        }
        
        self.groupedSections = newSections
        tableView.reloadData()

        // Show components with animation if needed
        if tableView.alpha == 0 {
            UIView.animate(withDuration: 0.3) {
                self.tableView.alpha = 1
                self.categoryCollectionView.alpha = 1
            }
        }
    }

    private func finishProcessing(_ count: Int) {
        isProcessing = false
        spinner.stopAnimating()

        if count > 0 {
            UIView.animate(withDuration: 0.3) {
                self.addSpotsBar.alpha = 1
            }
        } else {
            updateStatus("No places found in this video", isError: true)
        }
    }

    // MARK: - Save Spots

    @objc private func saveTapped() {
        guard !isSaving else { return }
        isSaving = true

        let selectedPlaces = allPlaces.filter { $0.isSelected }
        guard !selectedPlaces.isEmpty else { return }

        // Get userId from App Group UserDefaults
        let defaults = UserDefaults(suiteName: appGroupId)
        guard let userId = defaults?.string(forKey: "userId") else {
            updateStatus("Please open TripWays first to sign in", isError: true)
            isSaving = false
            return
        }

        saveButton.setTitle("Saving...", for: .normal)
        saveButton.alpha = 0.6

        let spotsArray: [[String: Any]] = selectedPlaces.map { place in
            var spot: [String: Any] = [
                "name": place.name,
                "country": place.country ?? "Unknown",
                "city": place.city ?? "Unknown",
                "source": "share_extension",
            ]
            if let placeId = place.placeId { spot["placeId"] = placeId }
            if let address = place.address { spot["address"] = address }
            if let photoUrl = place.photoUrl { spot["photoUrl"] = photoUrl }
            if let rating = place.rating { spot["rating"] = rating }
            if let count = place.userRatingCount { spot["userRatingCount"] = count }
            if let coords = place.coordinates {
                spot["coordinates"] = ["lat": coords.lat, "lng": coords.lng]
            }
            return spot
        }

        let body: [String: Any] = [
            "userId": userId,
            "spots": spotsArray
        ]

        guard let url = URL(string: "\(backendUrl)/api/spots"),
              let httpBody = try? JSONSerialization.data(withJSONObject: body) else {
            updateStatus("Failed to prepare save request", isError: true)
            isSaving = false
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = httpBody

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }

                if let error = error {
                    self.updateStatus("Save failed: \(error.localizedDescription)", isError: true)
                    self.saveButton.setTitle("Save to My Spots", for: .normal)
                    self.saveButton.alpha = 1
                    self.isSaving = false
                    return
                }

                // Success!
                self.isSaved = true
                self.updateStatus("Saved \(selectedPlaces.count) spots to your bucket list! ✓")
                self.statusLabel.textColor = UIColor(red: 0.06, green: 0.75, blue: 0.51, alpha: 1.0)

                UIView.animate(withDuration: 0.3) {
                    self.saveButton.alpha = 0
                    self.savedCheckView.alpha = 1
                }

                // Auto-close after 1.5s
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    self.close()
                }
            }
        }.resume()
    }

    // MARK: - Helpers

    private func updateStatus(_ text: String, isError: Bool = false) {
        statusLabel.text = text
        statusLabel.textColor = isError
            ? UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)
            : UIColor(red: 0.28, green: 0.33, blue: 0.41, alpha: 1.0)
    }

    @objc private func closeTapped() {
        close()
    }

    private func close() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

// MARK: - UICollectionViewDelegate & DataSource

extension ShareViewController: UICollectionViewDelegate, UICollectionViewDataSource {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return categories.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "CategoryCell", for: indexPath) as! CategoryCell
        let category = categories[indexPath.item]
        cell.configure(with: category, isSelected: category == selectedCategory)
        return cell
    }

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        selectedCategory = categories[indexPath.item]
        collectionView.reloadData()
        refreshGroupedSections()
    }
}

// MARK: - UITableViewDelegate & DataSource

extension ShareViewController: UITableViewDelegate, UITableViewDataSource {

    func numberOfSections(in tableView: UITableView) -> Int {
        return groupedSections.count
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return groupedSections[section].spots.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "PlaceCell", for: indexPath) as! PlaceCell
        let place = groupedSections[indexPath.section].spots[indexPath.row]
        cell.configure(with: place, number: indexPath.row + 1)
        return cell
    }

    func tableView(_ tableView: UITableView, viewForHeaderInSection section: Int) -> UIView? {
        let header = tableView.dequeueReusableHeaderFooterView(withIdentifier: "CityHeaderCell") as! CityHeaderCell
        let group = groupedSections[section]
        
        // Show country emoji header only for first city in country
        let showCountryHeader = section == 0 || groupedSections[section-1].country != group.country
        
        header.configure(
            country: group.country,
            city: group.city,
            count: group.spots.count,
            showCountryHeader: showCountryHeader,
            isSelected: group.spots.allSatisfy { $0.isSelected },
            isAnySelected: group.spots.contains { $0.isSelected }
        )
        
        header.onToggle = { [weak self] in
            guard let self = self else { return }
            let allSelected = group.spots.allSatisfy { $0.isSelected }
            let newState = !allSelected
            
            // Update all spots in this city
            for spot in group.spots {
                if let idx = self.allPlaces.firstIndex(where: { $0.id == spot.id }) {
                    self.allPlaces[idx].isSelected = newState
                }
            }
            self.refreshGroupedSections()
            self.updateSaveButton()
        }
        
        return header
    }

    func tableView(_ tableView: UITableView, heightForHeaderInSection section: Int) -> CGFloat {
        return UITableView.automaticDimension
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let place = groupedSections[indexPath.section].spots[indexPath.row]
        if let idx = allPlaces.firstIndex(where: { $0.id == place.id }) {
            allPlaces[idx].isSelected.toggle()
        }
        
        refreshGroupedSections()
        updateSaveButton()
    }
    
    private func updateSaveButton() {
        let selectedCount = allPlaces.filter { $0.isSelected }.count
        saveButton.setTitle(selectedCount > 0 ? "Save \(selectedCount) spots" : "Save spots", for: .normal)
        saveButton.alpha = selectedCount > 0 ? 1 : 0.4
    }
}

// MARK: - PlaceCell

class PlaceCell: UITableViewCell {

    private let numberLabel = UILabel()
    private let nameLabel = UILabel()
    private let descLabel = UILabel()
    private let spotImageView = UIImageView()
    private let checkmarkCircle = UIView()
    private let checkmarkIcon = UIImageView()
    private let cardView = UIView()
    
    private var imageDownloadTask: URLSessionDataTask?

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCell()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func prepareForReuse() {
        super.prepareForReuse()
        imageDownloadTask?.cancel()
        spotImageView.image = nil
    }

    private func setupCell() {
        backgroundColor = .clear
        selectionStyle = .none

        cardView.backgroundColor = .white
        cardView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(cardView)

        numberLabel.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        numberLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0)
        numberLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(numberLabel)

        spotImageView.contentMode = .scaleAspectFill
        spotImageView.layer.cornerRadius = 12
        spotImageView.layer.masksToBounds = true
        spotImageView.backgroundColor = UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0)
        spotImageView.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(spotImageView)

        nameLabel.font = UIFont.systemFont(ofSize: 15, weight: .bold)
        nameLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        nameLabel.numberOfLines = 1
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(nameLabel)

        descLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
        descLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0)
        descLabel.numberOfLines = 2
        descLabel.lineBreakMode = .byTruncatingTail
        descLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(descLabel)

        checkmarkCircle.layer.cornerRadius = 11
        checkmarkCircle.layer.borderWidth = 1.5
        checkmarkCircle.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(checkmarkCircle)
        
        checkmarkIcon.image = UIImage(systemName: "checkmark")
        checkmarkIcon.tintColor = .white
        checkmarkIcon.contentMode = .scaleAspectFit
        checkmarkIcon.translatesAutoresizingMaskIntoConstraints = false
        checkmarkCircle.addSubview(checkmarkIcon)

        NSLayoutConstraint.activate([
            cardView.topAnchor.constraint(equalTo: contentView.topAnchor),
            cardView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            cardView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            cardView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            cardView.heightAnchor.constraint(greaterThanOrEqualToConstant: 84),

            numberLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor),
            numberLabel.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 18),
            numberLabel.widthAnchor.constraint(equalToConstant: 22),

            spotImageView.leadingAnchor.constraint(equalTo: numberLabel.trailingAnchor, constant: 8),
            spotImageView.centerYAnchor.constraint(equalTo: cardView.centerYAnchor),
            spotImageView.widthAnchor.constraint(equalToConstant: 56),
            spotImageView.heightAnchor.constraint(equalToConstant: 56),

            nameLabel.leadingAnchor.constraint(equalTo: spotImageView.trailingAnchor, constant: 12),
            nameLabel.topAnchor.constraint(equalTo: spotImageView.topAnchor, constant: 2),
            nameLabel.trailingAnchor.constraint(equalTo: checkmarkCircle.leadingAnchor, constant: -12),

            descLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            descLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 2),
            descLabel.trailingAnchor.constraint(equalTo: nameLabel.trailingAnchor),
            descLabel.bottomAnchor.constraint(lessThanOrEqualTo: cardView.bottomAnchor, constant: -12),

            checkmarkCircle.trailingAnchor.constraint(equalTo: cardView.trailingAnchor),
            checkmarkCircle.centerYAnchor.constraint(equalTo: cardView.centerYAnchor),
            checkmarkCircle.widthAnchor.constraint(equalToConstant: 22),
            checkmarkCircle.heightAnchor.constraint(equalToConstant: 22),
            
            checkmarkIcon.centerXAnchor.constraint(equalTo: checkmarkCircle.centerXAnchor),
            checkmarkIcon.centerYAnchor.constraint(equalTo: checkmarkCircle.centerYAnchor),
            checkmarkIcon.widthAnchor.constraint(equalToConstant: 12),
            checkmarkIcon.heightAnchor.constraint(equalToConstant: 12),
        ])
    }

    func configure(with place: ExtractedPlace, number: Int) {
        numberLabel.text = "\(number)."
        nameLabel.text = place.name
        
        let cityText = place.city ?? ""
        let catText = place.category.replacingOccurrences(of: "_", with: " ").capitalized
        descLabel.text = place.address ?? (cityText.isEmpty ? catText : "\(catText) · \(cityText)")

        if place.isSelected {
            checkmarkCircle.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
            checkmarkCircle.layer.borderColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0).cgColor
            checkmarkIcon.isHidden = false
        } else {
            checkmarkCircle.backgroundColor = .clear
            checkmarkCircle.layer.borderColor = UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0).cgColor
            checkmarkIcon.isHidden = true
        }
        
        // Image loading
        if let urlString = place.photoUrl, let url = URL(string: urlString) {
            if let cachedImage = ImageCache.getImage(for: urlString) {
                spotImageView.image = cachedImage
            } else {
                imageDownloadTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                    if let data = data, let image = UIImage(data: data) {
                        ImageCache.cacheImage(image, for: urlString)
                        DispatchQueue.main.async {
                            self?.spotImageView.image = image
                        }
                    } else {
                        DispatchQueue.main.async {
                            self?.showPlaceholder()
                        }
                    }
                }
                imageDownloadTask?.resume()
            }
        } else {
            showPlaceholder()
        }
    }
    
    private func showPlaceholder() {
        spotImageView.image = nil
        let label = UILabel()
        label.text = "📍"
        label.font = UIFont.systemFont(ofSize: 22)
        label.textAlignment = .center
        label.frame = spotImageView.bounds
        spotImageView.addSubview(label)
    }
}

// MARK: - CityHeaderCell

class CityHeaderCell: UITableViewHeaderFooterView {
    
    private let countryHeader = UIView()
    private let countryLabel = UILabel()
    private let countryEmoji = UILabel()
    
    private let cityContent = UIView()
    private let checkmarkCircle = UIView()
    private let checkmarkIcon = UIImageView()
    private let cityNameLabel = UILabel()
    private let spotsCountLabel = UILabel()
    
    var onToggle: (() -> Void)?
    
    override init(reuseIdentifier: String?) {
        super.init(reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        contentView.backgroundColor = .white
        
        countryHeader.backgroundColor = UIColor(red: 0.97, green: 0.98, blue: 0.99, alpha: 1.0)
        countryHeader.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(countryHeader)
        
        countryEmoji.text = "🌍"
        countryEmoji.font = UIFont.systemFont(ofSize: 16)
        countryEmoji.translatesAutoresizingMaskIntoConstraints = false
        countryHeader.addSubview(countryEmoji)
        
        countryLabel.font = .systemFont(ofSize: 15, weight: .bold)
        countryLabel.textColor = UIColor(red: 0.12, green: 0.16, blue: 0.23, alpha: 1.0)
        countryLabel.translatesAutoresizingMaskIntoConstraints = false
        countryHeader.addSubview(countryLabel)
        
        cityContent.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(cityContent)
        
        checkmarkCircle.layer.cornerRadius = 12
        checkmarkCircle.layer.borderWidth = 2
        checkmarkCircle.translatesAutoresizingMaskIntoConstraints = false
        cityContent.addSubview(checkmarkCircle)
        
        checkmarkIcon.image = UIImage(systemName: "checkmark")
        checkmarkIcon.tintColor = .white
        checkmarkIcon.contentMode = .scaleAspectFit
        checkmarkIcon.translatesAutoresizingMaskIntoConstraints = false
        checkmarkCircle.addSubview(checkmarkIcon)
        
        cityNameLabel.font = UIFont.systemFont(ofSize: 20, weight: .black)
        cityNameLabel.textColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        cityNameLabel.translatesAutoresizingMaskIntoConstraints = false
        cityContent.addSubview(cityNameLabel)
        
        spotsCountLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        spotsCountLabel.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0)
        spotsCountLabel.translatesAutoresizingMaskIntoConstraints = false
        cityContent.addSubview(spotsCountLabel)
        
        let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
        cityContent.addGestureRecognizer(tap)
        
        NSLayoutConstraint.activate([
            countryHeader.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            countryHeader.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            countryHeader.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            countryHeader.heightAnchor.constraint(equalToConstant: 44),
            
            countryEmoji.leadingAnchor.constraint(equalTo: countryHeader.leadingAnchor, constant: 24),
            countryEmoji.centerYAnchor.constraint(equalTo: countryHeader.centerYAnchor),
            
            countryLabel.leadingAnchor.constraint(equalTo: countryEmoji.trailingAnchor, constant: 12),
            countryLabel.centerYAnchor.constraint(equalTo: countryHeader.centerYAnchor),
            
            cityContent.topAnchor.constraint(equalTo: countryHeader.bottomAnchor),
            cityContent.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            cityContent.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            cityContent.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            cityContent.heightAnchor.constraint(equalToConstant: 64),
            
            checkmarkCircle.leadingAnchor.constraint(equalTo: cityContent.leadingAnchor, constant: 28),
            checkmarkCircle.centerYAnchor.constraint(equalTo: cityContent.centerYAnchor),
            checkmarkCircle.widthAnchor.constraint(equalToConstant: 24),
            checkmarkCircle.heightAnchor.constraint(equalToConstant: 24),
            
            checkmarkIcon.centerXAnchor.constraint(equalTo: checkmarkCircle.centerXAnchor),
            checkmarkIcon.centerYAnchor.constraint(equalTo: checkmarkCircle.centerYAnchor),
            checkmarkIcon.widthAnchor.constraint(equalToConstant: 12),
            checkmarkIcon.heightAnchor.constraint(equalToConstant: 12),
            
            cityNameLabel.leadingAnchor.constraint(equalTo: checkmarkCircle.trailingAnchor, constant: 12),
            cityNameLabel.centerYAnchor.constraint(equalTo: cityContent.centerYAnchor),
            
            spotsCountLabel.trailingAnchor.constraint(equalTo: cityContent.trailingAnchor),
            spotsCountLabel.centerYAnchor.constraint(equalTo: cityContent.centerYAnchor),
        ])
    }
    
    @objc private func tapped() {
        onToggle?()
    }
    
    func configure(country: String, city: String, count: Int, showCountryHeader: Bool, isSelected: Bool, isAnySelected: Bool) {
        countryLabel.text = country
        cityNameLabel.text = city
        spotsCountLabel.text = "\(count) spots"
        
        countryHeader.isHidden = !showCountryHeader
        
        if isSelected {
            checkmarkCircle.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
            checkmarkCircle.layer.borderColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0).cgColor
            checkmarkIcon.isHidden = false
        } else if isAnySelected {
            checkmarkCircle.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 0.3)
            checkmarkCircle.layer.borderColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 0.3).cgColor
            checkmarkIcon.isHidden = false
        } else {
            checkmarkCircle.backgroundColor = .white
            checkmarkCircle.layer.borderColor = UIColor(red: 0.8 / 1.0, green: 0.83 / 1.0, blue: 0.88 / 1.0, alpha: 1.0).cgColor
            checkmarkIcon.isHidden = true
        }
    }
}

// MARK: - CategoryCell

class CategoryCell: UICollectionViewCell {
    
    private let label = UILabel()
    private let container = UIView()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        container.layer.cornerRadius = 20
        container.layer.borderWidth = 1
        container.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(container)
        
        label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        label.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(label)
        
        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: contentView.topAnchor),
            container.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            container.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            
            label.topAnchor.constraint(equalTo: container.topAnchor, constant: 10),
            label.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -10),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
        ])
    }
    
    func configure(with title: String, isSelected: Bool) {
        label.text = title
        if isSelected {
            container.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
            container.layer.borderColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0).cgColor
            label.textColor = .white
        } else {
            container.backgroundColor = .white
            container.layer.borderColor = UIColor(red: 0.89, green: 0.91, blue: 0.94, alpha: 1.0).cgColor
            label.textColor = UIColor(red: 0.39, green: 0.45, blue: 0.55, alpha: 1.0)
        }
    }
}
