package studio.dk.test;

import android.content.Context;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.nio.file.AtomicMoveNotSupportedException;
import java.util.Base64;
import java.util.UUID;

/**
 * File-backed workspace snapshots in Android's application-private storage.
 * The bridge uses 32-KiB chunks to keep the JavaScript interface bounded.
 * A complete snapshot replaces the previous one atomically after verification.
 */
final class WorkspaceFileStore {
    private static final int CHUNK = 32768;
    private static final long LIMIT = 64L * 1024 * 1024;
    private final File file;
    private File staging;
    private FileOutputStream output;
    private String token;
    private long expected, written;

    WorkspaceFileStore(Context context) {
        file = new File(context.getFilesDir(), "workspace-state-v1.json");
    }

    JSONObject info() throws Exception {
        return new JSONObject().put("bytes",file.isFile()?file.length():0)
            .put("exists",file.isFile());
    }

    JSONObject begin(JSONObject args) throws Exception {
        abort();
        long size=args.getLong("bytes");
        if(size<1||size>LIMIT)throw new IllegalArgumentException("Workspace snapshot is too large");
        expected=size;written=0;
        token=UUID.randomUUID().toString();
        staging=File.createTempFile("dkts-workspace-", ".tmp", file.getParentFile());
        output=new FileOutputStream(staging);
        return new JSONObject().put("token",token);
    }

    JSONObject append(JSONObject args) throws Exception {
        if(token==null||!token.equals(args.optString("token")))
            throw new SecurityException("No active workspace write");
        long offset=args.getLong("offset");
        if(offset!=written)throw new IllegalArgumentException("Unexpected workspace chunk offset");
        byte[] chunk=Base64.getDecoder().decode(args.getString("base64"));
        if(chunk.length<1||chunk.length>CHUNK||written+chunk.length>expected)
            throw new IllegalArgumentException("Workspace chunk is out of bounds");
        output.write(chunk);written+=chunk.length;
        return new JSONObject().put("written",written);
    }

    JSONObject commit(JSONObject args) throws Exception {
        if(token==null||!token.equals(args.optString("token"))||written!=expected)
            throw new IllegalStateException("Incomplete workspace snapshot");
        output.getFD().sync();
        output.close();output=null;
        try {
            Files.move(staging.toPath(),file.toPath(),
                StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(staging.toPath(),file.toPath(),StandardCopyOption.REPLACE_EXISTING);
        }
        staging=null;token=null;
        return new JSONObject().put("ok",true).put("bytes",written);
    }

    JSONObject read(JSONObject args) throws Exception {
        if(!file.isFile())return new JSONObject().put("base64","").put("bytes",0);
        long offset=args.getLong("offset");
        int length=args.optInt("length",CHUNK);
        long size=file.length();
        if(size>LIMIT||offset<0||offset>size||length<1||length>CHUNK)
            throw new IllegalArgumentException("Workspace read is out of bounds");
        int take=(int)Math.min(length,size-offset);
        byte[] bytes=new byte[take];
        try(RandomAccessFile input=new RandomAccessFile(file,"r")){
            input.seek(offset);
            input.readFully(bytes);
        }
        return new JSONObject().put("base64",Base64.getEncoder().encodeToString(bytes))
            .put("bytes",take);
    }

    void abort() {
        if(output!=null)try{output.close();}catch(Exception ignored){}
        output=null;token=null;
        if(staging!=null)staging.delete();
        staging=null;expected=0;written=0;
    }
}
