package studio.dk.test;

import java.io.ByteArrayOutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Link-local USB Ethernet recovery shared in spirit with DKDS's tested Android
 * 4200A agent. Non-root source binding is preferred. Only a missing IPv4
 * address or an unusable Android routing policy may need KernelSU's 'su'.
 *
 * Never alters Wi-Fi, the default route, or other instrument protocols.
 */
final class EthernetRouteRecovery {
    static final class Source {
        final String interfaceName;
        final Inet4Address address;
        Source(String name, Inet4Address ip) {interfaceName=name;address=ip;}
    }
    private static final class Command {
        final int code;
        final String output;
        Command(int c,String s){code=c;output=s;}
    }
    private EthernetRouteRecovery(){}

    static List<Source> sources(String mode,String wanted,boolean linkLocal) {
        List<Source> found=new ArrayList<>();
        try {
            for (NetworkInterface ni:Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name=ni.getName();
                boolean ethernet=isUsbEthernet(name);
                boolean wifi=isWifi(name);
                if (mode.equals("interface") && !name.equalsIgnoreCase(wanted)) continue;
                if (mode.equals("ethernet") && !ethernet) continue;
                if (mode.equals("wifi") && !wifi) continue;
                if (mode.equals("auto") && !ethernet && !wifi) continue;
                for (InetAddress a:Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) {
                        found.add(new Source(name,(Inet4Address)a));
                    }
                }
            }
        } catch (Exception ignored){}
        found.sort(Comparator.comparingInt(row -> {
            boolean ll=row.address.getHostAddress().startsWith("169.254.");
            if(linkLocal)return ll ? 0 : 1;
            return ll ? 1 : 0;
        }));
        return found;
    }

    private static boolean isUsbEthernet(String name) {
        String s=name.toLowerCase(Locale.ROOT);
        return s.startsWith("eth")||s.startsWith("enx")||s.startsWith("usb")||
            s.contains("ethernet");
    }
    private static boolean isWifi(String name) {
        String s=name.toLowerCase(Locale.ROOT);
        return s.startsWith("wlan")||s.startsWith("wifi");
    }
    private static boolean safeInterface(String s){return s.matches("[A-Za-z0-9_.-]{1,20}");}
    private static boolean safeIpv4(String s) {
        if(!s.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}"))return false;
        for(String part:s.split("\\.")) if(Integer.parseInt(part)>255)return false;
        return true;
    }
    private static Command shell(String command) throws Exception {
        Process p=new ProcessBuilder("su","-c",command).redirectErrorStream(true).start();
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        Thread reader=new Thread(()->{
            try {
                byte[] buf=new byte[512];int n;
                while((n=p.getInputStream().read(buf))>=0) {
                    synchronized(out){if(out.size()<2048)out.write(buf,0,Math.min(n,2048-out.size()));}
                }
            }catch(Exception ignored){}
        },"dkts-linklocal-recovery");
        reader.setDaemon(true);reader.start();
        if(!p.waitFor(6,TimeUnit.SECONDS)) {
            p.destroyForcibly();
            throw new IllegalStateException("KernelSU network preparation timed out");
        }
        reader.join(250);
        return new Command(p.exitValue(),out.toString("UTF-8").trim());
    }

    static String prepare(String target,String mode,String wanted) {
        if(!safeIpv4(target)||!target.startsWith("169.254.")||mode.equals("wifi"))
            return "no-linklocal-preparation";
        String iface=null;
        try {
            for(NetworkInterface ni:Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if(!ni.isUp()||!isUsbEthernet(ni.getName())||!safeInterface(ni.getName()))continue;
                if(mode.equals("interface")&&!ni.getName().equalsIgnoreCase(wanted))continue;
                iface=ni.getName();break;
            }
        }catch(Exception ignored){}
        if(iface==null)return "USB Ethernet interface not found";
        try {
            String carrier="unknown";
            try {carrier=new String(java.nio.file.Files.readAllBytes(
                java.nio.file.Paths.get("/sys/class/net/"+iface+"/carrier"))).trim();}catch(Exception ignored){}
            if(carrier.equals("0"))return iface+" has no cable carrier";
            String local=null;
            for(Source row:sources("interface",iface,true)) {
                if(row.address.getHostAddress().startsWith("169.254.")) {
                    local=row.address.getHostAddress();break;
                }
            }
            if(local==null) {
                String[] oct=target.split("\\.");
                String candidate="169.254."+oct[2]+"."+(oct[3].equals("115")?"116":"115");
                Command result=shell("ip -4 addr add "+candidate+"/16 dev "+iface);
                if(result.code!=0&&!result.output.contains("File exists"))
                    return "IPv4 setup failed: "+result.output;
                local=candidate;
            }
            // The routing fallback is host-specific; do not change the Wi-Fi default.
            Command current=shell("ip -4 route get "+target);
            if(current.code==0&&current.output.contains(" dev "+iface+" "))
                return "USB Ethernet is already routed";
            Command rules=shell("ip -4 rule show");
            if(rules.code!=0)return "USB Ethernet IPv4 set, routing rule unavailable";
            String existing=null;
            for(String line:rules.output.split("\\n"))
                if(line.trim().startsWith("9000:")){existing=line;break;}
            if(existing!=null&&!existing.contains("lookup 4200"))
                return "USB Ethernet IPv4 set, rule priority already used";
            Command routes=shell("ip -4 route show table 4200");
            if(routes.code==0)for(String line:routes.output.split("\\n")){
                if(!line.isEmpty()&&!line.contains(target+" ")&&!line.contains("FIB table"))
                    return "USB Ethernet IPv4 set, custom table occupied";
            }
            Command route=shell("ip -4 route replace "+target+"/32 dev "+iface+
                " src "+local+" table 4200");
            if(route.code!=0)return "USB Ethernet route failed: "+route.output;
            if(existing==null) {
                Command rule=shell("ip -4 rule add pref 9000 to "+target+"/32 lookup 4200");
                if(rule.code!=0)return "USB Ethernet rule failed: "+rule.output;
            }
            return "USB Ethernet route ready via "+iface+" ("+local+")";
        }catch(Exception e){
            return "USB Ethernet automatic route unavailable: "+e.getMessage();
        }
    }
}
