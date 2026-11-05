package studio.dk.test;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Self-update is explicitly user initiated. Android's package installer is
 * responsible for confirmation; no silent installation or privileged commands.
 * Downloaded APKs must match both the GitHub asset SHA256 and installed signer.
 */
final class NativeAppUpdateManager {
    private static final String TAG = "DKTS-AppUpdate";
    private static final String REPO = "davidkane0526/DK-Test-Studio";
    private static final String API = "https://api.github.com/repos/" + REPO + "/releases?per_page=20";
    private static final String APK_ASSET = "DK-Test-Studio-Android-Preview.apk";
    private static final Pattern RELEASE_TAG = Pattern.compile("^dkts-preview-v(\\d+\\.\\d+\\.\\d+)-a\\d+$");
    private static final Pattern PORTABLE = Pattern.compile(
        "DK-Test-Studio-Portable-(\\d+\\.\\d+\\.\\d+)-x64\\.exe");
    private static final int MAX_APK = 180 * 1024 * 1024;
    private final Activity activity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean closed = false;
    private volatile String state = "idle", version = "", error = "";
    private volatile int progress = 0;
    private volatile Candidate candidate;
    private volatile File downloaded;
    private volatile boolean resumeInstaller = false;

    private static final class Candidate {
        final String version, url, sha256;
        final int size;
        Candidate(String version, String url, String sha256, int size) {
            this.version=version;this.url=url;this.sha256=sha256;this.size=size;
        }
    }
    NativeAppUpdateManager(Activity activity) {
        this.activity=activity;
    }
    private String installedVersion() {
        try {
            return activity.getPackageManager()
                .getPackageInfo(activity.getPackageName(),0).versionName;
        } catch (Exception exception) {
            return "";
        }
    }
    JSONObject status() throws org.json.JSONException {
        // A downloaded APK is not an installed update. Report both separately.
        return new JSONObject().put("status",state).put("version",version)
            .put("installedVersion",installedVersion())
            .put("progress",progress).put("error",error);
    }
    private static int compareVersions(String a, String b) {
        String[] x=a.split("\\."),y=b.split("\\.");
        if(x.length!=3||y.length!=3)return 0;
        for(int i=0;i<3;i++){
            int d=Integer.compare(Integer.parseInt(x[i]),Integer.parseInt(y[i]));
            if(d!=0)return d;
        }
        return 0;
    }
    private static boolean trusted(URL url) {
        if(!"https".equalsIgnoreCase(url.getProtocol()))return false;
        String h=url.getHost().toLowerCase(Locale.ROOT);
        return h.equals("api.github.com")||h.equals("github.com")||
            h.equals("release-assets.githubusercontent.com")||
            h.endsWith(".githubusercontent.com");
    }
    private static HttpURLConnection connect(String raw) throws Exception {
        GitHubRateLimit.assertAllowed();
        URL url=new URL(raw);
        for(int redirect=0;redirect<6;redirect++){
            if(!trusted(url))throw new SecurityException("Untrusted download host");
            HttpURLConnection c=(HttpURLConnection)url.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent","DK-Test-Studio-Android-Updater");
            c.setRequestProperty("Accept","application/vnd.github+json");
            c.setConnectTimeout(12000);
            c.setReadTimeout(20000);
            int status=c.getResponseCode();
            if(status==301||status==302||status==303||status==307||status==308){
                String location=c.getHeaderField("Location");
                if(location==null)throw new IllegalStateException("Missing redirect target");
                URL next=new URL(url,location);c.disconnect();url=next;continue;
            }
            if(status!=200){
                String reason=GitHubRateLimit.onHttpError(c,status);
                c.disconnect();
                throw new IllegalStateException(reason);
            }
            return c;
        }
        throw new IllegalStateException("Too many GitHub redirects");
    }
    private static byte[] readLimited(InputStream in,int maximum)throws Exception{
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
        byte[] buf=new byte[8192];int n;
        while((n=in.read(buf))!=-1){
            if(out.size()+n>maximum)throw new IllegalStateException("Release data too large");
            out.write(buf,0,n);
        }
        return out.toByteArray();
    }
    private static String hex(byte[] hash){
        StringBuilder result=new StringBuilder(hash.length*2);
        for(byte b:hash)result.append(String.format(Locale.ROOT,"%02x",b&255));
        return result.toString();
    }
    private Candidate latest() throws Exception {
        HttpURLConnection c=connect(API);
        JSONArray releases;
        try(InputStream in=c.getInputStream()){
            releases=new JSONArray(new String(readLimited(in,2097152),
                java.nio.charset.StandardCharsets.UTF_8));
        } finally {c.disconnect();}
        Candidate chosen=null;
        for(int i=0;i<releases.length();i++){
            JSONObject row=releases.getJSONObject(i);
            if(row.optBoolean("draft",false))continue;
            Matcher tag=RELEASE_TAG.matcher(row.optString("tag_name"));
            if(!tag.matches())continue;
            JSONArray assets=row.optJSONArray("assets");if(assets==null)continue;
            JSONObject apk=null;String releaseVersion="";
            for(int j=0;j<assets.length();j++){
                JSONObject item=assets.getJSONObject(j);
                if(APK_ASSET.equals(item.optString("name")))apk=item;
                Matcher m=PORTABLE.matcher(item.optString("name"));
                if(m.matches())releaseVersion=m.group(1);
            }
            if(apk==null||!tag.group(1).equals(releaseVersion))continue;
            String sha=apk.optString("digest");
            String url=apk.optString("browser_download_url");
            long size=apk.optLong("size",0);
            if(!sha.matches("sha256:[a-fA-F0-9]{64}")||
                size<100000||size>MAX_APK||
                !url.startsWith("https://github.com/"+REPO+"/releases/download/"+
                    row.getString("tag_name")+"/"))continue;
            Candidate candidate=new Candidate(releaseVersion,url,sha.substring(7).toLowerCase(Locale.ROOT),(int)size);
            if(chosen==null||compareVersions(candidate.version,chosen.version)>0)chosen=candidate;
        }
        return chosen;
    }
    void checkNow(){
        if(closed||"checking".equals(state)||"downloading".equals(state))return;
        state="checking";error="";
        worker.execute(()->{
            try{
                Candidate found=latest();
                if(closed)return;
                String installed=installedVersion();
                if(installed.isEmpty())throw new IllegalStateException("无法确认本机程序版本");
                if(found==null||compareVersions(found.version,installed)<=0){
                    candidate=null;version=installed;state="current";return;
                }
                if(candidate==null||!candidate.version.equals(found.version))downloaded=null;
                candidate=found;version=found.version;
                state=downloaded!=null&&downloaded.exists()?"ready":"available";
            }catch(Exception ex){state="error";error=String.valueOf(ex.getMessage());Log.w(TAG,"Update check failed",ex);}
        });
    }
    void downloadAndInstall(){
        if(closed||"downloading".equals(state)||"checking".equals(state))return;
        state="downloading";progress=0;error="";
        worker.execute(()->{
            try{
                Candidate selected=candidate;
                if(selected==null)throw new IllegalStateException("请先检查程序更新");
                File apk=downloaded;
                if(apk==null||!apk.exists()){
                    apk=download(selected);
                    validateApk(apk,selected.version);
                    downloaded=apk;
                }else{
                    validateApk(apk,selected.version);
                }
                if(closed)return;
                // Do not expose 'ready' between download completion and the
                // system installer launch; otherwise the UI can offer a second
                // install action before Android has opened the first one.
                state="installer";progress=100;
                requestInstaller(apk);
            }catch(Exception ex){
                state="error";error=String.valueOf(ex.getMessage());Log.w(TAG,"APK update rejected",ex);
            }
        });
    }
    private File download(Candidate selected)throws Exception{
        state="downloading";progress=0;error="";
        File folder=new File(activity.getCacheDir(),"native-updates");
        if(!folder.exists()&&!folder.mkdirs())throw new IllegalStateException("无法建立下载目录");
        File destination=new File(folder,"verified-update.apk");
        File temp=new File(folder,"download.tmp");
        if(temp.exists())temp.delete();
        HttpURLConnection c=connect(selected.url);
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        long count=0;
        try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(temp)){
            byte[] part=new byte[65536];int n;
            while((n=in.read(part))!=-1){
                count+=n;
                if(count>MAX_APK||count>selected.size)throw new IllegalStateException("APK exceeds declared size");
                out.write(part,0,n);digest.update(part,0,n);
                progress=(int)Math.min(99,count*100/selected.size);
            }
            out.getFD().sync();
        }catch(Exception e){temp.delete();throw e;}
        finally{c.disconnect();}
        if(count!=selected.size||!hex(digest.digest()).equals(selected.sha256)){
            temp.delete();throw new SecurityException("APK SHA-256 校验失败，已拒绝安装");
        }
        if(destination.exists())destination.delete();
        if(!temp.renameTo(destination))throw new IllegalStateException("无法完成下载文件校验");
        return destination;
    }
    @SuppressWarnings("deprecation")
    private Signature[] signatures(PackageInfo info){
        if(info==null)return new Signature[0];
        if(Build.VERSION.SDK_INT>=28)
            return info.signingInfo==null?new Signature[0]:info.signingInfo.getApkContentsSigners();
        return info.signatures==null?new Signature[0]:info.signatures;
    }
    @SuppressWarnings("deprecation")
    private void validateApk(File apk,String expectedVersion)throws Exception{
        final PackageManager pm=activity.getPackageManager();
        final int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo archive=pm.getPackageArchiveInfo(apk.getAbsolutePath(),flags);
        PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),flags);
        if(archive==null||!activity.getPackageName().equals(archive.packageName)
            ||!expectedVersion.equals(archive.versionName))
            throw new SecurityException("APK 包名或版本不匹配");
        Signature[] trusted=signatures(installed),received=signatures(archive);
        if(trusted.length==0||received.length==0||
            !MessageDigest.isEqual(trusted[0].toByteArray(),received[0].toByteArray()))
            throw new SecurityException("APK 签名证书与当前安装版本不一致");
    }
    private void requestInstaller(File apk){
        state="installer";
        main.post(()->{
            if(closed||activity.isFinishing())return;
            try{
                if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){
                    resumeInstaller=true;state="permission";
                    Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:"+activity.getPackageName()));
                    activity.startActivity(settings);
                    return;
                }
                resumeInstaller=false;
                Uri content=FileProvider.getUriForFile(activity,
                    activity.getPackageName()+".updates",apk);
                Intent install=new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(content,"application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(install);
                state="installer";
            }catch(Exception ex){state="error";error=String.valueOf(ex.getMessage());}
        });
    }
    void onResume(){
        if(resumeInstaller&&downloaded!=null&&downloaded.exists()&&
            (Build.VERSION.SDK_INT<26||activity.getPackageManager().canRequestPackageInstalls())){
            resumeInstaller=false;requestInstaller(downloaded);
            return;
        }
        // Returning from the system package installer is not success evidence.
        // On cancellation, keep the verified APK and let the user retry.
        if("installer".equals(state)){
            final String installed=installedVersion();
            if(candidate!=null&&!installed.isEmpty()&&
                compareVersions(installed,candidate.version)>=0){
                state="current";version=installed;error="";
            }else{
                state="ready";
                error="尚未完成系统安装。请点击「继续安装」，并在系统界面确认更新。";
            }
        }
    }
    void stop(){
        closed=true;worker.shutdownNow();
    }
}
