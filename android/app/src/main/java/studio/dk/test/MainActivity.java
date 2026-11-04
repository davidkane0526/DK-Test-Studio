package studio.dk.test;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends Activity {
    private static final String TAG="DKTS-Android";
    private final Runnable immersiveTask=this::applyImmersiveOnce;
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
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    Log.e("DKTS-WebJS", message.message() + " at " +
                        message.sourceId() + ":" + message.lineNumber());
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                if (!url.startsWith(APP_ORIGIN)) return;
                view.postDelayed(() -> view.evaluateJavascript(
                    "(function(){return JSON.stringify({d3:!!window.d3,renderer:!!window.DKDSD3Renderer,charts:!!window.DKDSCharts,grip:!!document.querySelector('.dkds-scientific-nav-drag')})})()",
                    value -> Log.i("DKTS-PlotReady", value)), 2600L);
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !req.getUrl().toString().startsWith(APP_ORIGIN);
            }
        });
        bridge = new InstrumentBridge(this, webView, uiUpdates);
        webView.addJavascriptInterface(bridge, "DKTSNative");
        setContentView(webView);
        // The decor/insets controller can be unavailable before attachment.
        scheduleImmersive();
        webView.loadUrl(APP_ORIGIN + "index.html");
        uiUpdates.start();
    }

    private void scheduleImmersive() {
        if (webView == null) return;
        webView.removeCallbacks(immersiveTask);
        webView.post(immersiveTask);
    }

    @SuppressWarnings("deprecation")
    private void applyImmersiveOnce() {
        if (isFinishing() || isDestroyed()) return;
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                // Android 15/16: do not mix deprecated FLAG_FULLSCREEN with insets.
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    controller.hide(WindowInsets.Type.statusBars());
                }
            } else {
                getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            }
        } catch (RuntimeException error) {
            // Nonessential chrome cannot be allowed to terminate the app.
            Log.w(TAG,"Immersive status-bar mode unavailable; continuing",error);
        }
    }

    @Override protected void onResume() {
        super.onResume();
        scheduleImmersive();
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.removeCallbacks(immersiveTask);
        if (uiUpdates != null) uiUpdates.stop();
        if (bridge != null) bridge.shutdown();
        if (webView != null) {
            webView.removeJavascriptInterface("DKTSNative");
            webView.destroy();
        }
        super.onDestroy();
    }
}
