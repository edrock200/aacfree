package org.calebaac.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-specific native plugins must be registered before the bridge starts.
        registerPlugin(AACFreeFilesPlugin.class);
        registerPlugin(AACFreeScreenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
