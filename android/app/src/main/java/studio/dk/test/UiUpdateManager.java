package studio.dk.test;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebResourceResponse;

import androidx.webkit.WebViewAssetLoader;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
    private static final String API = "https://api.github.com/repos/" + REPO;
    private static final Pattern SHA = Pattern.compile("^[a-fA-F0-9]{40}$");
    private static final Pattern STAMP = Pattern.compile("name=\"dkts-ui-version\" content=\"([a-fA-F0-9]{40})\"");
    private static final String[] FILES = {"index.html", "app.js", "styles.css"};
    private final File live, stage, backup;
    private final String bundledCommit;
    private final WebViewAssetLoader.AssetsPathHandler bundled;
    private final ExecutorService updateWorker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable applied;
    private volatile boolean closed = false;
    private volatile String installedTag = "";
    private volatile String updateStatus = "idle";
    private volatile String updateError = "";
    private final Runnable checkPeriodic = new Runnable() {
        @Override public void run() {
            if (closed) return;
            checkNow();
            main.postDelayed(this, 180000L);
        }
    };

    UiUpdateManager(Context ctx, Runnable onApplied) {
        this.live = new File(ctx.getFilesDir(), "dkts-ui-live");
        this.stage = new File(ctx.getFilesDir(), "dkts-ui-next");
        this.backup = new File(ctx.getFilesDir(), "dkts-ui-backup");
        this.bundled = new WebViewAssetLoader.AssetsPathHandler(ctx);
        String embedded = "";
        try (InputStream input = ctx.getAssets().open("index.html")) {
            String html = new String(readLimit(input, 524288), StandardCharsets.UTF_8);
            Matcher marker = STAMP.matcher(html);
            if (marker.find()) embedded = marker.group(1).toLowerCase(java.util.Locale.ROOT);
        } catch (Exception error) {
            Log.w(TAG, "Cannot verify bundled UI commit", error);
        }
        this.bundledCommit = embedded;
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

    void checkNow() {
        if (closed) return;
        updateStatus = "checking";
        updateError = "";
        updateWorker.execute(() -> {
            try {
                checkOnce();
                if ("checking".equals(updateStatus)) updateStatus = "current";
            } catch (Exception error) {
                updateStatus = "offline";
                updateError = String.valueOf(error.getMessage());
                Log.w(TAG, "UI update check failed", error);
            }
        });
    }

    JSONObject status() throws org.json.JSONException {
        return new JSONObject()
            .put("status", updateStatus)
            .put("tag", installedTag)
            .put("error", updateError);
    }

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
        return jsonGet(url,maxBytes,false);
    }
    private static JSONObject jsonGet(String url, int maxBytes, boolean allowMissing) throws Exception {
        URL parsed = new URL(url);
        if (!parsed.getProtocol().equals("https")) throw new SecurityException("HTTPS required for UI updates");
        HttpURLConnection c = (HttpURLConnection) parsed.openConnection();
        c.setRequestProperty("User-Agent", "DK-Test-Studio-Android");
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setConnectTimeout(10000);
        c.setReadTimeout(12000);
        try {
            int status = c.getResponseCode();
            if(allowMissing && status==404)return null;
            if(status!=200)throw new IllegalStateException("GitHub HTTP "+status);
            return new JSONObject(new String(readLimit(c.getInputStream(),maxBytes),StandardCharsets.UTF_8));
        } finally { c.disconnect(); }
    }
    private boolean validateStored(File folder) {
        try {
            if (!folder.isDirectory()) return false;
            JSONObject meta = new JSONObject(readText(new File(folder, "meta.json")));
            if (!SCHEMA.equals(meta.getString("schema")) ||
                !REPO.equals(meta.getString("repository")) || meta.getInt("minShell") != 3 ||
                !SHA.matcher(bundledCommit).matches() ||
                !bundledCommit.equals(meta.optString("shellBase")) ||
                !SHA.matcher(meta.optString("version")).matches() ||
                !("dkts-ui-"+meta.optString("version")).equals(meta.optString("tag"))) return false;
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
        if(!SHA.matcher(bundledCommit).matches())
            throw new IllegalStateException("Cannot verify bundled native UI commit; refusing rollback");
        JSONObject branch=jsonGet(API+"/branches/main",262144);
        String head=branch.getJSONObject("commit").getString("sha").toLowerCase(java.util.Locale.ROOT);
        if(!SHA.matcher(head).matches())
            throw new IllegalStateException("Invalid main commit SHA");
        String installed=installedTag.startsWith("dkts-ui-")?
            installedTag.substring("dkts-ui-".length()):bundledCommit;
        if(!SHA.matcher(installed).matches())
            throw new IllegalStateException("Invalid local UI commit SHA");
        if(head.equals(installed))return;
        String tag="dkts-ui-"+head;
        JSONObject selected=jsonGet(API+"/releases/tags/"+tag,262144,true);
        // Publishing the full Release or a replay of an older Release must
        // never become a new UI update. Wait for main HEAD's exact UI tag.
        if(selected==null){updateStatus="pending";return;}
        if(selected.optBoolean("draft",false)||
            !tag.equals(selected.optString("tag_name"))||
            !head.equalsIgnoreCase(selected.optString("target_commitish")))
            throw new IllegalStateException("Release does not match main HEAD");
        JSONObject comparison=jsonGet(API+"/compare/"+installed+"..."+head,262144);
        if(!"ahead".equals(comparison.optString("status"))||
            comparison.optInt("ahead_by",0)<=0){updateStatus="blocked";return;}
        String expectedUrl="https://github.com/"+REPO+"/releases/download/"+tag+"/"+ASSET;
        String assetUrl="";
        org.json.JSONArray assets=selected.getJSONArray("assets");
        for(int i=0;i<assets.length();i++){
            JSONObject asset=assets.getJSONObject(i);
            if(ASSET.equals(asset.optString("name")))assetUrl=asset.optString("browser_download_url");
        }
        if(!expectedUrl.equals(assetUrl))
            throw new SecurityException("Untrusted UI asset URL");
        JSONObject bundle=jsonGet(assetUrl,2097152);
        if(!SCHEMA.equals(bundle.getString("schema"))||
            !REPO.equals(bundle.getString("repository"))||
            bundle.getInt("minShell")!=3||
            !head.equalsIgnoreCase(bundle.getString("version")))
            throw new IllegalStateException("Bundle does not match main HEAD");
        JSONObject data = bundle.getJSONObject("platforms").getJSONObject("android");
        JSONObject hashes = new JSONObject();
        deleteTree(stage);
        if (!stage.mkdirs()) throw new IllegalStateException("Cannot create staging dir");
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
            meta.put("minShell", 3);meta.put("version", head);
            meta.put("tag", tag);meta.put("shellBase",bundledCommit);
            meta.put("hashes", hashes);
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
            updateStatus = "updated";
            if (!closed) main.post(applied);
            Log.i(TAG, "UI updated to " + tag);
        } finally { deleteTree(stage); }
    }
}
