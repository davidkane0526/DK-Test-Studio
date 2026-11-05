package studio.dk.test;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Base64;
import java.util.UUID;

/** Chunked, app-private export followed by the Android system share/save sheet. */
final class CapabilityExportStore {
    private static final int CHUNK_LIMIT=32768;
    private static final long FILE_LIMIT=2L*1024*1024;
    private final Context context;
    private File staging;
    private FileOutputStream output;
    private String token;
    private String filename;
    private long expected,written;

    CapabilityExportStore(Context context){
        this.context=context.getApplicationContext();
    }

    JSONObject begin(JSONObject args)throws Exception{
        abort();
        long size=args.getLong("bytes");
        String name=args.getString("filename");
        if(size<1||size>FILE_LIMIT)throw new IllegalArgumentException("Capability export size is out of range");
        if(!name.matches("^4200a-capabilities-safety-v[0-9]+\\.[0-9]+\\.[0-9]+\\.json$"))
            throw new IllegalArgumentException("Invalid capability export filename");
        File directory=new File(context.getCacheDir(),"native-exports");
        if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException("Cannot create export directory");
        expected=size;written=0;filename=name;token=UUID.randomUUID().toString();
        staging=File.createTempFile("dkts-capability-",".tmp",directory);
        output=new FileOutputStream(staging);
        return new JSONObject().put("token",token);
    }

    JSONObject append(JSONObject args)throws Exception{
        if(token==null||!token.equals(args.optString("token")))
            throw new SecurityException("No active capability export");
        long offset=args.getLong("offset");
        if(offset!=written)throw new IllegalArgumentException("Unexpected capability export chunk offset");
        byte[] chunk=Base64.getDecoder().decode(args.getString("base64"));
        if(chunk.length<1||chunk.length>CHUNK_LIMIT||written+chunk.length>expected)
            throw new IllegalArgumentException("Capability export chunk is out of bounds");
        output.write(chunk);written+=chunk.length;
        return new JSONObject().put("written",written);
    }

    JSONObject commit(JSONObject args)throws Exception{
        if(token==null||!token.equals(args.optString("token"))||written!=expected)
            throw new IllegalStateException("Incomplete capability export");
        output.getFD().sync();output.close();output=null;
        File target=new File(staging.getParentFile(),filename);
        if(target.exists()&&!target.delete())throw new IllegalStateException("Cannot replace previous export");
        if(!staging.renameTo(target))throw new IllegalStateException("Cannot finalize capability export");
        staging=null;token=null;
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".updates",target);
        Intent send=new Intent(Intent.ACTION_SEND);
        send.setType("application/json");
        send.putExtra(Intent.EXTRA_STREAM,uri);
        send.setClipData(ClipData.newUri(context.getContentResolver(),filename,uri));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent chooser=Intent.createChooser(send,"导出 4200A 能力与安全策略数据库");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(chooser);
        return new JSONObject().put("filename",filename).put("bytes",written).put("shared",true);
    }

    void abort(){
        if(output!=null)try{output.close();}catch(Exception ignored){}
        output=null;token=null;filename=null;expected=0;written=0;
        if(staging!=null)staging.delete();
        staging=null;
    }
}
