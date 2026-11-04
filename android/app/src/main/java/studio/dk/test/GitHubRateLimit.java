package studio.dk.test;

import java.net.HttpURLConnection;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** One backoff gate shared by Android UI and APK update requests. */
final class GitHubRateLimit {
    private static long blockedUntil=0;
    private static final DateTimeFormatter CLOCK =
        DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault());
    private GitHubRateLimit(){}
    static synchronized void assertAllowed() {
        if(System.currentTimeMillis()<blockedUntil)
            throw new IllegalStateException("GitHub 暂停检查中，"+CLOCK.format(Instant.ofEpochMilli(blockedUntil))+" 后重试");
    }
    static synchronized String onHttpError(HttpURLConnection connection,int status) {
        if(status!=403&&status!=429)return "GitHub HTTP "+status;
        final long now=System.currentTimeMillis();
        long wait=5*60*1000L;
        String retry=connection.getHeaderField("Retry-After");
        String remaining=connection.getHeaderField("X-RateLimit-Remaining");
        if(retry!=null){
            try {wait=Math.max(wait,Long.parseLong(retry)*1000L);}catch(NumberFormatException ignored){}
        }
        if("0".equals(remaining)){
            try{
                long reset=Long.parseLong(connection.getHeaderField("X-RateLimit-Reset"))*1000L;
                wait=Math.max(wait,reset-now);
            }catch(Exception ignored){}
        }
        wait=Math.max(60_000L,Math.min(2*60*60*1000L,wait));
        blockedUntil=Math.max(blockedUntil,now+wait);
        String kind="0".equals(remaining)||status==429||retry!=null
            ?"GitHub API 请求限额已触发"
            :"GitHub HTTP "+status+"（权限或网络访问受限）";
        return kind+"，暂停检查至 "+CLOCK.format(Instant.ofEpochMilli(blockedUntil));
    }
}
