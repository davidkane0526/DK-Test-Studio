package studio.dk.test;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebResourceResponse;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * UI-only updates: three verified resources from this project's public GitHub releases.
 * The instrument bridge, network permissions, and native code remain inside the APK.
 * The update check runs separately from the instrument TCP worker.
 */
final class UiUpdateManager {
    private static final String TAG = "DKTS-UiUpdate";
    private static final String REPO = "davidkane0526/DK-Test-Studio";
    private static final String SCHEMA = "dkts-ui-v1";
    private static final String ASSET = "DKTS-UI-bundle.json";
    private static final String API = "https://api.github.com/repos/" + REPO + "/releases?per_page=12";
    private static final String[] FILES = {"index.html", "app.js", "styles.css"};
    private final File live, stage, backup;
    private final WebViewAssetLoader.AssetsPathHandler bundled;
    private final ExecutorService updateWorker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable applied;
    private volatile boolean closed = false;
    private volatile String installedTag = "";
    private final Runnable checkPeriodic = new Runnable() {
        @Override public void run() {
            if (closed) return;
            updateWorker.execute(() -> { try { checkOnce(); } catch (Exception ignored) {} });
            main.postDelayed(this, 180000L);
        }
    };

    UiUpdateManager(Context ctx, Runnable onApplied) {
        this.live = new File(ctx.getFilesDir(), "dkts-ui-live");
        this.stage = new File(ctx.getFilesDir(), "dkts-ui-next");
        this.backup = new File(ctx.getFilesDir(), "dkts-ui-backup");
        this.bundled = new WebViewAssetLoader.AssetsPathHandler(ctx);
        this.applied = onApplied;
        if (!validateStored(live)) {
            deleteTree(live);
            if (validateStored(backup)) backup.renameTo(live);
        }
        if (validateStored(live)) {
            try { installedTag = new JSONObject(readText(new File(live, "meta.json"))).getString("tag"); }
            catch (Exception ignored) {}
        }
    }

    void start() { main.post(checkPeriodic); }

    void stop() {
        closed = true;
        main.removeCallbacks(checkPeriodic);
        updateWorker.shutdownNow();
    }

    WebResourceResponse serve(String rawPath) {
        String name = rawPath.startsWith("/") ? rawPath.substring(1) : rawPath;
        for (String allowed : FILES) {
            if (allowed.equals(name) && validateStored(live)) {
                File file = new File(live, name);
                try {
                    InputStream stream = new FileInputStream(file);
                    String mime = name.endsWith(".html") ? "text/html" :
                        name.endsWith(".css") ? "text/css" : "application/javascript";
                    return new WebResourceResponse(mime, "UTF-8", stream);
                } catch (Exception ignored) {}
                break;
            }
        }
        // All shared core and native bootstrap scripts still load from the signed APK.
        return bundled.handle(rawPath);
    }

    private static void deleteTree(File target) {
        if (!target.exists()) return;
        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        target.delete();
    }

    private static byte[] readLimit(InputStream stream, int cap) throws Exception {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) {
                if (out.size() + n > cap) throw new IllegalStateException("UI download size limit exceeded");
                out.write(chunk, 0, n);
            }
            return out.toByteArray();
        }
    }
    private static String readText(File file) throws Exception {
        try (InputStream in = new FileInputStream(file)) {
            return new String(readLimit(in, 524288), StandardCharsets.UTF_8);
        }
    }
    private static void write(File file, byte[] content) throws Exception {
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(content);
            stream.getFD().sync();
        }
    }
    private static String sha256(byte[] content) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(content);
        StringBuilder s = new StringBuilder();
        for (byte b : hash) s.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        return s.toString();
    }
    private static JSONObject jsonGet(String url, int maxBytes) throws Exception {
        URL parsed = new URL(url);
        if (!parsed.getProtocol().equals("https")) throw new SecurityException("HTTPS required for UI updates");
        HttpURLConnection c = (HttpURLConnection) parsed.openConnection();
        c.setRequestProperty("User-Agent", "DK-Test-Studio-Android");
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setConnectTimeout(10000);
        c.setReadTimeout(12000);
        try {
            if (c.getResponseCode() != 200) throw new IllegalStateException("HTTP " + c.getResponseCode());
            return new JSONObject(new String(readLimit(c.getInputStream(), maxBytes), StandardCharsets.UTF_8));
        } finally { c.disconnect(); }
    }
    private static JSONArray listReleases() throws Exception {
        URL url = new URL(API);
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setRequestProperty("User-Agent", "DK-Test-Studio-Android");
        c.setConnectTimeout(10000);
        c.setReadTimeout(12000);
        try {
            if (c.getResponseCode() != 200) throw new IllegalStateException("GitHub returned " + c.getResponseCode());
            return new JSONArray(new String(readLimit(c.getInputStream(), 1048576), StandardCharsets.UTF_8));
        } finally { c.disconnect(); }
    }
    private boolean validateStored(File folder) {
        try {
            if (!folder.isDirectory()) return false;
            JSONObject meta = new JSONObject(readText(new File(folder, "meta.json")));
            if (!SCHEMA.equals(meta.getString("schema")) ||
                !REPO.equals(meta.getString("repository")) || meta.getInt("minShell") != 1) return false;
            JSONObject hashes = meta.getJSONObject("hashes");
            for (String name : FILES) {
                byte[] content;
                try (InputStream in = new FileInputStream(new File(folder, name))) {
                    content = readLimit(in, 524288);
                }
                if (!sha256(content).equals(hashes.getString(name))) return false;
            }
            return true;
        } catch (Exception ignored) { return false; }
    }
    private void checkOnce() throws Exception {
        if (closed) return;
        JSONArray releases = listReleases();
        JSONObject selected = null;
        for (int i = 0; i < releases.length(); i++) {
            JSONObject row = releases.getJSONObject(i);
            if (!row.optBoolean("draft", false) &&
                row.optString("tag_name").startsWith("dkts-ui-")) {
                selected = row;
                break;
            }
        }
        if (selected == null) return;
        String tag = selected.getString("tag_name");
        if (tag.equals(installedTag)) return;
        JSONArray assets = selected.getJSONArray("assets");
        String assetUrl = "";
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            if (ASSET.equals(asset.optString("name"))) {
                assetUrl = asset.getString("browser_download_url");
                break;
            }
        }
        if (!assetUrl.startsWith("https://github.com/" + REPO + "/releases/download/")) return;
        JSONObject bundle = jsonGet(assetUrl, 2097152);
        if (!SCHEMA.equals(bundle.getString("schema")) ||
            !REPO.equals(bundle.getString("repository")) || bundle.getInt("minShell") != 1 ||
            !bundle.getString("version").equals(selected.getString("target_commitish"))) {
            throw new IllegalStateException("Bundle does not match this release");
        }
        JSONObject data = bundle.getJSONObject("platforms").getJSONObject("android");
        JSONObject hashes = new JSONObject();
        if (!stage.mkdirs() && !stage.isDirectory()) throw new IllegalStateException("Cannot create staging dir");
        try {
            for (String name : FILES) {
                JSONObject entry = data.getJSONObject(name);
                int expectedSize = entry.getInt("bytes");
                if (expectedSize < 1 || expectedSize > 524288) throw new IllegalStateException("UI file too large");
                byte[] raw = Base64.getDecoder().decode(entry.getString("base64"));
                if (raw.length != expectedSize || !sha256(raw).equals(entry.getString("sha256")))
                    throw new IllegalStateException("UI file checksum mismatch");
                if (name.equals("index.html") &&
                    !new String(raw, StandardCharsets.UTF_8).contains("android/native-client.js"))
                    throw new IllegalStateException("Android bootstrap missing");
                write(new File(stage, name), raw);
                hashes.put(name, entry.getString("sha256"));
            }
            JSONObject meta = new JSONObject();
            meta.put("schema", SCHEMA);meta.put("repository", REPO);
            meta.put("minShell", 1);meta.put("version", bundle.getString("version"));
            meta.put("tag", tag);meta.put("hashes", hashes);
            write(new File(stage, "meta.json"), meta.toString().getBytes(StandardCharsets.UTF_8));
            if (!validateStored(stage)) throw new IllegalStateException("Stage validation failed");
            deleteTree(backup);
            if (live.exists() && !live.renameTo(backup))
                throw new IllegalStateException("Cannot backup previous UI");
            if (!stage.renameTo(live)) {
                if (backup.exists()) backup.renameTo(live);
                throw new IllegalStateException("Cannot activate UI");
            }
            installedTag = tag;
            if (!closed) main.post(applied);
            Log.i(TAG, "UI updated to " + tag);
        } finally { deleteTree(stage); }
    }
}
