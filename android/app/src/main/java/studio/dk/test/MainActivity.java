package studio.dk.test;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends Activity {
    private WebView webView;
    private InstrumentBridge bridge;
    private UiUpdateManager uiUpdates;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net/";

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle state) {
        super.onCreate(state);
        // Assets are served from the verified UI cache, with bundled APK assets as fallback.
        uiUpdates = new UiUpdateManager(this, () -> {
            if (webView != null) webView.reload();
        });
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", assetPath -> uiUpdates.serve(assetPath))
            .build();
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !req.getUrl().toString().startsWith(APP_ORIGIN);
            }
        });
        bridge = new InstrumentBridge(this, webView);
        webView.addJavascriptInterface(bridge, "DKTSNative");
        setContentView(webView);
        webView.loadUrl(APP_ORIGIN + "index.html");
        uiUpdates.start();
    }

    @Override protected void onDestroy() {
        if (uiUpdates != null) uiUpdates.stop();
        if (bridge != null) bridge.shutdown();
        if (webView != null) {
            webView.removeJavascriptInterface("DKTSNative");
            webView.destroy();
        }
        super.onDestroy();
    }
}
