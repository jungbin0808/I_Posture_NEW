package com.iposture.rebuilt;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public class MainActivity extends Activity {
    private WebView web;
    private PermissionRequest cameraRequest;
    private ValueCallback<Uri[]> picker;
    private String export;
    private static final String HOST = "iposture.local";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(248,250,245));
        web = new WebView(this);
        root.addView(web,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view,insets)->{
                android.graphics.Insets padding=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());
                view.setPadding(padding.left,padding.top,padding.right,padding.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new NativeHost(),"NativeHost");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();String path=uri.getPath();
                if(!"https".equals(uri.getScheme())||!HOST.equals(uri.getHost())||path==null||path.contains("..")||path.contains("\\"))return denied();
                if("/".equals(path))path="/index.html";
                String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".wasm")?"application/wasm":path.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
                try{return new WebResourceResponse(mime,(mime.startsWith("text/")||mime.equals("application/javascript"))?"UTF-8":null,getAssets().open("www"+path));}catch(IOException error){return denied();}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{
                if(!HOST.equals(request.getOrigin().getHost())){request.deny();return;}
                boolean video=false;for(String resource:request.getResources())if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource))video=true;
                if(!video){request.deny();return;}
                if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                else {if(cameraRequest!=null)cameraRequest.deny();cameraRequest=request;requestPermissions(new String[]{Manifest.permission.CAMERA},10);}
            });}
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(cameraRequest==request)cameraRequest=null;}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> result,FileChooserParams params){
                if(picker!=null)picker.onReceiveValue(null);picker=result;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);String[] types=params.getAcceptTypes();
                java.util.LinkedHashSet<String> accepted=new java.util.LinkedHashSet<>();for(String value:types)for(String type:value.split(","))if(!type.trim().isEmpty())accepted.add(type.trim());
                if(accepted.size()==1)intent.setType(accepted.iterator().next());else {intent.setType("*/*");if(!accepted.isEmpty())intent.putExtra(Intent.EXTRA_MIME_TYPES,accepted.toArray(new String[0]));}
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(intent,20);}catch(RuntimeException error){picker.onReceiveValue(null);picker=null;Toast.makeText(MainActivity.this,"파일 선택기를 열지 못했습니다.",Toast.LENGTH_LONG).show();}
                return true;
            }
        });
        web.loadUrl("https://"+HOST+"/index.html");
    }
    private static WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream("Not available".getBytes(StandardCharsets.UTF_8)));}
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==10&&cameraRequest!=null){PermissionRequest request=cameraRequest;cameraRequest=null;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else request.deny();}}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==20&&picker!=null){picker.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);picker=null;}if(request==30){String text=export;export=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&text!=null){Uri uri=data.getData();new Thread(()->{try(OutputStream output=getContentResolver().openOutputStream(uri)){if(output!=null)output.write(text.getBytes(StandardCharsets.UTF_8));}catch(IOException e){runOnUiThread(()->Toast.makeText(this,"수치 저장 실패",Toast.LENGTH_LONG).show());}}).start();}}}
    @Override public void onBackPressed(){web.evaluateJavascript("window.onAppBack ? window.onAppBack() : window.NativeHost.exitApp()",null);}
    @Override protected void onPause(){web.evaluateJavascript("window.dispatchEvent(new Event('iposture:pause'))",null);super.onPause();}
    @Override protected void onDestroy(){if(picker!=null)picker.onReceiveValue(null);if(cameraRequest!=null)cameraRequest.deny();web.removeJavascriptInterface("NativeHost");web.destroy();super.onDestroy();}
    public final class NativeHost {
        @JavascriptInterface public void exitApp(){runOnUiThread(()->finish());}
        @JavascriptInterface public void exportJson(String json){if(json==null||json.length()>20*1024*1024)return;runOnUiThread(()->{export=json;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.setType("application/json");intent.addCategory(Intent.CATEGORY_OPENABLE);intent.putExtra(Intent.EXTRA_TITLE,"iposture-records.json");startActivityForResult(intent,30);});}
    }
}
