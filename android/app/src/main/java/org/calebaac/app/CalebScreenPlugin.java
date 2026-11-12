package org.calebaac.app;

import android.app.Activity;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Keep screen awake" for the Android app. The WebView has no Screen Wake Lock
 * API, and switch or gaze users never touch the screen, so without this the
 * tablet goes to sleep mid-use. FLAG_KEEP_SCREEN_ON applies only while Caleb's
 * window is visible and needs no permission.
 */
@CapacitorPlugin(name = "CalebScreen")
public class CalebScreenPlugin extends Plugin {

    /** setKeepOn({ on: boolean }) */
    @PluginMethod
    public void setKeepOn(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        activity.runOnUiThread(() -> {
            if (on) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
