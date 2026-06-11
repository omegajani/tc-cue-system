package com.tccue.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.tccue.app.ui.LiveScreen
import com.tccue.app.ui.SettingsScreen
import com.tccue.app.ui.TCCueTheme

class MainActivity : ComponentActivity() {
    private val client: TCWSClient get() = (application as TCApp).client
    private val nowBar: NowBarManager get() = (application as TCApp).nowBar
    private lateinit var discovery: NsdDiscovery

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        discovery = NsdDiscovery(applicationContext)

        // Display soll während der Show anbleiben
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        if (Build.VERSION.SDK_INT >= 33) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        // Sobald verbunden: Foreground Service übernimmt Notification,
        // Vibration und hält die Verbindung bei Display-aus am Leben
        lifecycleScope.launch {
            client.connectionState.collect { state ->
                if (state == ConnectionState.CONNECTED) CueService.start(this@MainActivity)
            }
        }

        // Letzte Server-URL automatisch wiederverbinden
        val prefs = getSharedPreferences("tccue", MODE_PRIVATE)
        prefs.getString("serverURL", null)?.takeIf { it.isNotBlank() }?.let {
            client.connect(it)
        }

        setContent {
            TCCueTheme {
                var selectedTab by remember { mutableIntStateOf(0) }

                Scaffold(
                    containerColor = Color.Black,
                    bottomBar = {
                        NavigationBar(containerColor = Color(0xFF1A1A1A)) {
                            NavigationBarItem(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                icon = { Icon(Icons.Filled.Sensors, contentDescription = null) },
                                label = { Text("Live") },
                                colors = navItemColors()
                            )
                            NavigationBarItem(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                                label = { Text("Einstellungen") },
                                colors = navItemColors()
                            )
                        }
                    }
                ) { padding ->
                    when (selectedTab) {
                        0 -> LiveScreen(client, Modifier.padding(padding))
                        else -> SettingsScreen(
                            client = client,
                            discovery = discovery,
                            prefs = prefs,
                            nowBar = nowBar,
                            modifier = Modifier.padding(padding)
                        )
                    }
                }
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun navItemColors() = NavigationBarItemDefaults.colors(
        selectedIconColor = Color(0xFF10B981),
        selectedTextColor = Color(0xFF10B981),
        unselectedIconColor = Color(0xFF666666),
        unselectedTextColor = Color(0xFF666666),
        indicatorColor = Color(0xFF10B981).copy(alpha = 0.15f)
    )

    override fun onResume() {
        super.onResume()
        // Nicht aufs Backoff warten, wenn der Nutzer die App öffnet
        client.reconnectNow()
    }

    override fun onDestroy() {
        super.onDestroy()
        discovery.stop()
        // Verbindung läuft im CueService weiter — hier nichts trennen
    }
}
