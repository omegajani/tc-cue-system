package com.tccue.app

import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
    private val client = TCWSClient()
    private lateinit var discovery: NsdDiscovery

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        discovery = NsdDiscovery(applicationContext)

        // Display soll während der Show anbleiben
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        client.onCueFire = { _, _ -> vibrateAlarm() }

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

    override fun onDestroy() {
        super.onDestroy()
        discovery.stop()
        client.disconnect()
    }

    private fun vibrateAlarm() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        // Kräftiges Muster, damit es am Gürtel/in der Tasche spürbar ist
        val pattern = longArrayOf(0, 300, 120, 300, 120, 500)
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }
}
