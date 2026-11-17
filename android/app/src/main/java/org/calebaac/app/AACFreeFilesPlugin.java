package org.calebaac.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Lets Caleb keep a backup file in any storage provider the family chooses
 * (Google Drive, OneDrive, Dropbox, an SD card…) through Android's system file
 * picker. The family picks the place once; Caleb keeps permission and
 * overwrites that file on every automatic backup. No accounts or API keys.
 */
@CapacitorPlugin(name = "AACFreeFiles")
public class AACFreeFilesPlugin extends Plugin {

    /** Opens the system "save as" picker. Resolves { uri, name }. */
    @PluginMethod
    public void createDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "caleb-backup.json"));
        startActivityForResult(call, intent, "onDocumentPicked");
    }

    /** Opens the system "open" picker for an existing file. Resolves { uri, name }. */
    @PluginMethod
    public void openDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "onDocumentPicked");
    }

    @ActivityCallback
    private void onDocumentPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception ignored) {
            // Some providers don't offer persistable permissions; writing may then only work this session.
        }
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("name", displayName(uri));
        call.resolve(ret);
    }

    /**
     * Overwrites the document with UTF-8 `text` (or base64 `data`).
     *
     * Large backups arrive in chunks so no single bridge message is huge:
     * part "begin" / "append" collect base64 `data` in a private temp file, and
     * part "commit" copies that file into the document in one go. The document is
     * therefore only opened (and truncated) once everything has arrived. Every
     * write is read back and rejected unless all bytes are there. Resolves { bytes }.
     */
    @PluginMethod
    public void writeDocument(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("uri is required"); return; }
        String part = call.getString("part");
        String data = call.getString("data");
        java.io.File tmp = new java.io.File(getContext().getCacheDir(), "caleb-cloud-backup.part");
        try {
            byte[] bytes = data != null
                ? android.util.Base64.decode(data, android.util.Base64.DEFAULT)
                : call.getString("text", "").getBytes(StandardCharsets.UTF_8);
            if ("begin".equals(part) || "append".equals(part)) {
                try (OutputStream out = new java.io.FileOutputStream(tmp, "append".equals(part))) {
                    out.write(bytes);
                }
                call.resolve();
                return;
            }
            Uri uri = Uri.parse(uriStr);
            long expected;
            if ("commit".equals(part)) {
                if (!tmp.exists()) throw new Exception("nothing to commit");
                if (bytes.length > 0) {
                    try (OutputStream out = new java.io.FileOutputStream(tmp, true)) { out.write(bytes); }
                }
                expected = tmp.length();
                try (InputStream in = new java.io.FileInputStream(tmp);
                     OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new Exception("Could not open the file");
                    byte[] chunk = new byte[65536];
                    int n;
                    while ((n = in.read(chunk)) > 0) out.write(chunk, 0, n);
                    out.flush();
                }
            } else {
                expected = bytes.length;
                try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new Exception("Could not open the file");
                    out.write(bytes);
                    out.flush();
                }
            }
            // Read it back: an interrupted or cut-short write must not pass as a backup.
            long written = 0;
            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in == null) throw new Exception("Could not check the file");
                byte[] chunk = new byte[65536];
                int n;
                while ((n = in.read(chunk)) > 0) written += n;
            }
            if (written != expected) throw new Exception("verify failed: wrote " + written + " of " + expected + " bytes");
            JSObject ret = new JSObject();
            ret.put("bytes", written);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("permission", e);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "write failed", e);
        } finally {
            if ("commit".equals(part)) tmp.delete();
        }
    }

    /** Reads the document as UTF-8 text. */
    @PluginMethod
    public void readDocument(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) { call.reject("uri is required"); return; }
        try (InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uriStr))) {
            if (in == null) throw new Exception("Could not open the file");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[65536];
            int n;
            while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
            JSObject ret = new JSObject();
            ret.put("text", buf.toString("UTF-8"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "read failed", e);
        }
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return uri.getLastPathSegment();
    }
}
