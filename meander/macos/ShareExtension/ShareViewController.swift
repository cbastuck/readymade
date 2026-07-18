import AppKit
import UniformTypeIdentifiers

/// The macOS share-menu entry point for "Share → Readymade". Unlike iOS, a
/// macOS share extension may foreground its host app, so no picker lives here:
/// the extension is a thin capture-and-handoff. It normalizes the shared
/// URL/text/file into a `SharedItem`, drops it into the App Group inbox, opens
/// `readymade://share?id=…` (launching or foregrounding Readymade), and the
/// app's in-app picker asks which board should consume it.
final class ShareViewController: NSViewController {
    private let urlType = UTType.url.identifier
    private let plainTextType = UTType.plainText.identifier
    private var didStart = false

    /// A binary payload staged in the extension's tmp dir. The file from
    /// `loadFileRepresentation` only lives for the duration of its completion
    /// handler, so it is copied here first; on save it moves into the App Group
    /// keyed by the item id.
    private struct StagedFile {
        let url: URL
        let meta: SharedFile
    }
    private var stagedFile: StagedFile?

    private let statusLabel = NSTextField(labelWithString: "Sending to Readymade…")

    override func loadView() {
        // A small status card; the whole interaction normally lasts a moment.
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 260, height: 64))
        statusLabel.alignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)
        NSLayoutConstraint.activate([
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            statusLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 12),
        ])
        self.view = view
        preferredContentSize = view.frame.size
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        // viewDidAppear can fire more than once; only run the extraction once.
        guard !didStart else { return }
        didStart = true
        loadSharedContent()
    }

    // ── Content extraction (mirrors the iOS extension) ────────────────────────

    private func loadSharedContent() {
        let inputItems = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        let attachments = inputItems.flatMap { $0.attachments ?? [] }

        // The content text the user may have typed in the share sheet composer,
        // and/or a title carried by the input item.
        let composedText = inputItems.compactMap { $0.attributedContentText?.string }
            .first(where: { !$0.isEmpty })

        NSLog("[ReadymadeShare] loadSharedContent: %d attachment(s)", attachments.count)

        var pendingURL: String?
        var pendingText: String? = composedText
        var fileTooLarge = false
        let group = DispatchGroup()

        for provider in attachments {
            // Order matters: file-backed attachments first. A shared file's URL
            // conforms to public.url too, so testing the web-URL branch first
            // would swallow Finder shares as bogus "links".
            if let fileType = fileTypeIdentifier(for: provider) {
                group.enter()
                provider.loadFileRepresentation(forTypeIdentifier: fileType) { [weak self] tempURL, _ in
                    // tempURL dies when this handler returns — stage a copy now.
                    if let tempURL, let self {
                        let size = (try? tempURL.resourceValues(forKeys: [.fileSizeKey]))?
                            .fileSize ?? 0
                        if size > ShareInbox.maxFilePayloadBytes {
                            fileTooLarge = true
                        } else {
                            self.stagedFile = self.stage(tempURL: tempURL, size: size)
                        }
                    }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(urlType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                    if let url = item as? URL {
                        pendingURL = url.absoluteString
                    } else if let data = item as? Data, let s = String(data: data, encoding: .utf8) {
                        pendingURL = s
                    }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(plainTextType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: plainTextType, options: nil) { item, _ in
                    if let text = item as? String {
                        pendingText = pendingText ?? text
                    } else if let data = item as? Data, let s = String(data: data, encoding: .utf8) {
                        pendingText = pendingText ?? s
                    }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            if fileTooLarge && self.stagedFile == nil {
                self.finish(notice: "File too large for Readymade") {
                    self.cancel()
                }
            } else {
                self.saveAndOpenApp(url: pendingURL, text: pendingText)
            }
        }
    }

    /// The concrete type identifier to load a file-backed attachment with, or
    /// nil when the attachment is not a file (web link, plain text). Images and
    /// movies conform to public.data; a Finder share is a public.file-url.
    private func fileTypeIdentifier(for provider: NSItemProvider) -> String? {
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
            return UTType.image.identifier
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
            return UTType.movie.identifier
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            return UTType.fileURL.identifier
        }
        // Generic data (PDFs and other documents), but not bare links/text —
        // those are handled by the dedicated URL/text branches.
        if provider.hasItemConformingToTypeIdentifier(UTType.data.identifier),
           !provider.hasItemConformingToTypeIdentifier(urlType),
           !provider.hasItemConformingToTypeIdentifier(plainTextType) {
            return provider.registeredTypeIdentifiers.first ?? UTType.data.identifier
        }
        return nil
    }

    /// Copies the short-lived temp file into our own tmp dir and derives the
    /// name/mime metadata from it.
    private func stage(tempURL: URL, size: Int) -> StagedFile? {
        let name = tempURL.lastPathComponent
        let staging = FileManager.default.temporaryDirectory
            .appendingPathComponent("readymade-share-\(UUID().uuidString)")
            .appendingPathExtension(tempURL.pathExtension)
        do {
            try FileManager.default.copyItem(at: tempURL, to: staging)
        } catch {
            NSLog("[ReadymadeShare] staging copy FAILED: %@", error.localizedDescription)
            return nil
        }
        let mimeType = UTType(filenameExtension: tempURL.pathExtension)?
            .preferredMIMEType ?? "application/octet-stream"
        return StagedFile(
            url: staging,
            meta: SharedFile(name: name, mimeType: mimeType, size: size)
        )
    }

    // ── Handoff ───────────────────────────────────────────────────────────────

    private func saveAndOpenApp(url: String?, text: String?) {
        // Nothing usable was shared — just close without bothering the user.
        guard stagedFile != nil || url != nil || (text?.isEmpty == false) else {
            NSLog("[ReadymadeShare] nothing usable shared; closing")
            complete()
            return
        }

        // No boardName tag: the in-app picker asks once Readymade is open.
        let item = SharedItem(url: url, title: nil, text: text, file: stagedFile?.meta)
        do {
            if let staged = stagedFile {
                try ShareInbox.storeFilePayload(from: staged.url, id: item.id)
            }
            let id = try ShareInbox.write(item)
            NSLog(
                "[ReadymadeShare] wrote inbox item %@ (file=%@)",
                id, stagedFile?.meta.name ?? "none"
            )
            openHostApp(shareId: id)
            complete()
        } catch {
            NSLog("[ReadymadeShare] inbox write FAILED: %@", error.localizedDescription)
            ShareInbox.removeFilePayload(id: item.id)
            finish(notice: "Could not hand off to Readymade") {
                self.cancel()
            }
        }
    }

    /// Launches/foregrounds Readymade. The URL carries the item id, but it is a
    /// wake-up call — the app drains the whole inbox on focus regardless.
    private func openHostApp(shareId: String) {
        var components = URLComponents()
        components.scheme = "readymade"
        components.host = "share"
        components.queryItems = [URLQueryItem(name: "id", value: shareId)]
        guard let url = components.url else { return }
        NSWorkspace.shared.open(url)
    }

    /// Shows a short notice in the popover, then runs `then`.
    private func finish(notice: String, then: @escaping () -> Void) {
        statusLabel.stringValue = notice
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: then)
    }

    private func complete() {
        cleanupStaging()
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func cancel() {
        cleanupStaging()
        extensionContext?.cancelRequest(withError: CocoaError(.userCancelled))
    }

    private func cleanupStaging() {
        if let staged = stagedFile {
            try? FileManager.default.removeItem(at: staged.url)
            stagedFile = nil
        }
    }
}
