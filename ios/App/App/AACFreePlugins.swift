import Capacitor
import UIKit
import UniformTypeIdentifiers

/// The app's root view controller: Capacitor's bridge plus AACFree's own plugins.
class AACFreeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AACFreeFilesPlugin())
        bridge?.registerPluginInstance(AACFreeScreenPlugin())
    }
}

/// Keeps the screen on while switch, gaze or dwell users are working (they make no touches).
@objc(AACFreeScreenPlugin)
public class AACFreeScreenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AACFreeScreenPlugin"
    public let jsName = "AACFreeScreen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setKeepOn", returnType: CAPPluginReturnPromise)
    ]

    @objc func setKeepOn(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
            call.resolve()
        }
    }
}

/// Lets AACFree keep a backup or sync file in a place the family picks once with the
/// system file picker (iCloud Drive, Google Drive, OneDrive, Dropbox…), then overwrite
/// it on every automatic backup. The same JavaScript API as the Android plugin.
/// The "uri" handed to JavaScript is a bookmark, so access survives app restarts.
@objc(AACFreeFilesPlugin)
public class AACFreeFilesPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "AACFreeFilesPlugin"
    public let jsName = "AACFreeFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "createDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDocument", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private static let prefix = "bookmark:"

    private var partFile: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("aacfree-cloud-backup.part")
    }

    // MARK: picking

    /// Opens the system "save to" picker. Resolves { uri, name }.
    @objc func createDocument(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "aacfree-backup.json"
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try Data("{}".utf8).write(to: tmp, options: .atomic)
        } catch {
            call.reject("Could not prepare the file")
            return
        }
        present(call) { UIDocumentPickerViewController(forExporting: [tmp], asCopy: true) }
    }

    /// Opens the system "open" picker for an existing file. Resolves { uri, name }.
    @objc func openDocument(_ call: CAPPluginCall) {
        present(call) { UIDocumentPickerViewController(forOpeningContentTypes: [.json, .data, .item], asCopy: false) }
    }

    private func present(_ call: CAPPluginCall, _ make: @escaping () -> UIDocumentPickerViewController) {
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("No window to show the picker")
                return
            }
            if let old = self.pendingCall { old.reject("cancelled") }
            self.pendingCall = call
            let picker = make()
            picker.delegate = self
            vc.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        guard let url = urls.first else {
            call.reject("cancelled")
            return
        }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
            call.resolve(["uri": Self.prefix + bookmark.base64EncodedString(), "name": url.lastPathComponent])
        } catch {
            call.reject("This place can't be kept. Choose a file in iCloud Drive or another provider.")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingCall?.reject("cancelled")
        pendingCall = nil
    }

    // MARK: reading and writing

    private func resolve(_ uri: String?) throws -> URL {
        guard let uri = uri, uri.hasPrefix(Self.prefix),
              let data = Data(base64Encoded: String(uri.dropFirst(Self.prefix.count))) else {
            throw NSError(domain: "AACFreeFiles", code: 1, userInfo: [NSLocalizedDescriptionKey: "uri is required"])
        }
        var stale = false
        return try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
    }

    /// Runs `body` with access to the picked file, coordinated with its file provider.
    private func withAccess<T>(_ url: URL, writing: Bool, _ body: (URL) throws -> T) throws -> T {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        var coordError: NSError?
        var result: Result<T, Error>?
        let coordinator = NSFileCoordinator()
        if writing {
            coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordError) { u in
                result = Result { try body(u) }
            }
        } else {
            coordinator.coordinate(readingItemAt: url, options: [], error: &coordError) { u in
                result = Result { try body(u) }
            }
        }
        if let e = coordError { throw e }
        guard let r = result else { throw NSError(domain: "AACFreeFiles", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not open the file"]) }
        return try r.get()
    }

    /// Same contract as Android: parts "begin"/"append" collect base64 chunks in a private
    /// temp file and "commit" writes them into the document in one go; every write is read
    /// back and rejected unless all bytes are there. Resolves { bytes }.
    @objc func writeDocument(_ call: CAPPluginCall) {
        let part = call.getString("part")
        let bytes: Data
        if let b64 = call.getString("data") {
            guard let d = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else {
                call.reject("bad data")
                return
            }
            bytes = d
        } else {
            bytes = Data((call.getString("text") ?? "").utf8)
        }
        DispatchQueue.global(qos: .utility).async {
            do {
                if part == "begin" || part == "append" {
                    if part == "begin" { try? FileManager.default.removeItem(at: self.partFile) }
                    if !FileManager.default.fileExists(atPath: self.partFile.path) {
                        FileManager.default.createFile(atPath: self.partFile.path, contents: nil)
                    }
                    let h = try FileHandle(forWritingTo: self.partFile)
                    try h.seekToEnd()
                    try h.write(contentsOf: bytes)
                    try h.close()
                    call.resolve()
                    return
                }
                let url = try self.resolve(call.getString("uri"))
                var payload = bytes
                if part == "commit" {
                    defer { try? FileManager.default.removeItem(at: self.partFile) }
                    guard FileManager.default.fileExists(atPath: self.partFile.path) else { throw NSError(domain: "AACFreeFiles", code: 3, userInfo: [NSLocalizedDescriptionKey: "nothing to commit"]) }
                    payload = try Data(contentsOf: self.partFile) + bytes
                }
                try self.withAccess(url, writing: true) { u in try payload.write(to: u, options: .atomic) }
                let written = try self.withAccess(url, writing: false) { u in try Data(contentsOf: u).count }
                if written != payload.count {
                    throw NSError(domain: "AACFreeFiles", code: 4, userInfo: [NSLocalizedDescriptionKey: "verify failed: wrote \(written) of \(payload.count) bytes"])
                }
                call.resolve(["bytes": written])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Reads the document as UTF-8 text.
    @objc func readDocument(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async {
            do {
                let url = try self.resolve(call.getString("uri"))
                let data = try self.withAccess(url, writing: false) { u in try Data(contentsOf: u) }
                call.resolve(["text": String(decoding: data, as: UTF8.self)])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
