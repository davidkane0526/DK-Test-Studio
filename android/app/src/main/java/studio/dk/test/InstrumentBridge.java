package studio.dk.test;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;
import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Exclusive, read-only KXCI native socket bridge. No generic command execution endpoint.
 * All device operations are serialized on one worker. No root or DK Data Studio dependency.
 */
public final class InstrumentBridge {
    private static final byte[] IDN = "*IDN?\0".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] OPT = "*OPT?\0".getBytes(StandardCharsets.US_ASCII);
    private final Context context;
    private final WebView webView;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private Socket socket;
    private String sessionId;
    private volatile boolean stopped = false;

    InstrumentBridge(Context context, WebView view) {
        this.context = context.getApplicationContext();
        this.webView = view;
    }

    @JavascriptInterface
    public void request(String serialized) {
        if (serialized == null || serialized.length() > 65536) return;
        ui.post(() -> {
            if (stopped || webView.getUrl() == null ||
                !webView.getUrl().startsWith("https://appassets.androidplatform.net/")) return;
            worker.execute(() -> {
                JSONObject reply = new JSONObject();
                int id = -1;
                try {
                    JSONObject command = new JSONObject(serialized);
                    id = command.getInt("id");
                    String op = command.getString("op");
                    JSONObject payload = command.optJSONObject("payload");
                    if (payload == null) payload = new JSONObject();
                    reply.put("id", id);
                    reply.put("ok", true);
                    reply.put("value", dispatch(op, payload));
                } catch (Exception error) {
                    try {
                        reply.put("id", id);
                        reply.put("ok", false);
                        reply.put("error", String.valueOf(error.getMessage()));
                    } catch (JSONException ignored) {}
                }
                String data = reply.toString();
                ui.post(() -> {
                    if (!stopped) webView.evaluateJavascript(
                        "window.DKTSNativeBridgeResolve(" + JSONObject.quote(data) + ")", null);
                });
            });
        });
    }

    private JSONObject dispatch(String op, JSONObject args) throws Exception {
        switch (op) {
            case "open": return open(args);
            case "exchange": return exchange(args);
            case "close": {
                String session = args.optString("sessionId", "");
                boolean existed = sessionId != null && sessionId.equals(session);
                if (existed) closeActive();
                return new JSONObject().put("closed", existed);
            }
            default: throw new SecurityException("Unsupported native operation");
        }
    }

    private static int bounded(JSONObject value, String key, int def, int min, int max) throws Exception {
        int result = value.has(key) ? value.getInt(key) : def;
        if (result < min || result > max) throw new IllegalArgumentException(key + " is out of range");
        return result;
    }

    private void closeActive() {
        Socket old = socket;
        socket = null;
        sessionId = null;
        if (old != null) try { old.close(); } catch (Exception ignored) {}
    }

    private JSONObject open(JSONObject args) throws Exception {
        closeActive();
        final String host = args.optString("host", "169.254.111.118").trim();
        if (host.isEmpty() || host.contains(" ") || host.contains("/") || host.length() > 253)
            throw new IllegalArgumentException("Invalid instrument host");
        final int port = bounded(args, "port", 1225, 1, 65535);
        final int timeout = bounded(args, "connectTimeoutMs", 5000, 250, 30000);
        final String mode = args.optString("networkMode", "auto").toLowerCase(Locale.ROOT);
        if (!Arrays.asList("auto","ethernet","wifi","interface").contains(mode))
            throw new IllegalArgumentException("Unsupported network mode");
        final String interfaceName = args.optString("interfaceName", "").trim();
        if (mode.equals("interface") && interfaceName.isEmpty())
            throw new IllegalArgumentException("Interface name required");
        final String localIP = args.optString("localAddress", "").trim();
        final ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) throw new IllegalStateException("Android network service unavailable");

        List<Network> networks = new ArrayList<>();
        for (Network item : cm.getAllNetworks()) {
            NetworkCapabilities cap = cm.getNetworkCapabilities(item);
            LinkProperties lp = cm.getLinkProperties(item);
            if (cap == null || lp == null) continue;
            boolean ethernet = cap.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
            boolean wifi = cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
            String name = lp.getInterfaceName() == null ? "" : lp.getInterfaceName();
            if (mode.equals("ethernet") && !ethernet) continue;
            if (mode.equals("wifi") && !wifi) continue;
            if (mode.equals("interface") && !name.equalsIgnoreCase(interfaceName)) continue;
            if (mode.equals("auto") && !ethernet && !wifi) continue;
            networks.add(item);
        }
        if (mode.equals("auto")) {
            // First try Ethernet network binding, then Wi-Fi, then OS default.
            networks.sort((a, b) -> Boolean.compare(
                cm.getNetworkCapabilities(b) != null &&
                    cm.getNetworkCapabilities(b).hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET),
                cm.getNetworkCapabilities(a) != null &&
                    cm.getNetworkCapabilities(a).hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)));
        }
        Exception last = null;
        for (int i = 0; i < networks.size() + (mode.equals("auto") ? 1 : 0); i++) {
            Network network = i < networks.size() ? networks.get(i) : null;
            Socket candidate = null;
            try {
                candidate = network == null ? new Socket() : network.getSocketFactory().createSocket();
                if (!localIP.isEmpty()) candidate.bind(new InetSocketAddress(localIP, 0));
                candidate.connect(new InetSocketAddress(host, port), timeout);
                candidate.setTcpNoDelay(true);
                socket = candidate;
                sessionId = UUID.randomUUID().toString();
                String iface = "system route";
                if (network != null && cm.getLinkProperties(network) != null)
                    iface = String.valueOf(cm.getLinkProperties(network).getInterfaceName());
                return new JSONObject()
                    .put("sessionId", sessionId)
                    .put("remoteAddress", host)
                    .put("remotePort", port)
                    .put("localAddress", candidate.getLocalAddress().getHostAddress())
                    .put("interfaceName", iface)
                    .put("routeStrategy", network == null ? "system-routing" : "android-network-bound");
            } catch (Exception ex) {
                last = ex;
                if (candidate != null) try { candidate.close(); } catch (Exception ignored) {}
            }
        }
        throw new IllegalStateException("Unable to connect on available Android routes. " +
            (last == null ? "Check USB Ethernet IP settings." : String.valueOf(last.getMessage())));
    }

    private JSONObject exchange(JSONObject args) throws Exception {
        if (socket == null || socket.isClosed() ||
            !args.optString("sessionId", "").equals(sessionId))
            throw new IllegalStateException("Instrument session unavailable");
        final byte[] request = Base64.getDecoder().decode(args.getString("base64"));
        // Security boundary: no arbitrary instrument command even if the WebView is compromised.
        if (!Arrays.equals(request, IDN) && !Arrays.equals(request, OPT))
            throw new SecurityException("Only read-only IDN/OPT queries are permitted");
        final int maxBytes = bounded(args, "maxBytes", 4096, 1, 8192);
        final int firstTimeout = bounded(args, "readTimeoutMs", 5000, 250, 30000);
        final int idleTimeout = bounded(args, "idleTimeoutMs", 120, 20, 10000);
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try {
            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();
            out.write(request);
            out.flush();
            byte[] part = new byte[2048];
            socket.setSoTimeout(firstTimeout);
            while (true) {
                int n;
                try { n = in.read(part); }
                catch (SocketTimeoutException timeout) {
                    if (bytes.size() > 0) break;
                    throw timeout;
                }
                if (n < 0) {
                    if (bytes.size() > 0) break;
                    throw new IllegalStateException("TCP connection closed without response");
                }
                if (bytes.size() + n > maxBytes)
                    throw new IllegalStateException("Response exceeds safety limit");
                bytes.write(part, 0, n);
                socket.setSoTimeout(idleTimeout);
            }
            return new JSONObject()
                .put("base64", Base64.getEncoder().encodeToString(bytes.toByteArray()))
                .put("bytesRead", bytes.size());
        } catch (Exception ex) {
            closeActive();
            throw ex;
        }
    }

    void shutdown() {
        stopped = true;
        worker.execute(this::closeActive);
        worker.shutdown();
    }
}
