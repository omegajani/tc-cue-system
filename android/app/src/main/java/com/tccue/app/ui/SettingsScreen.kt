package com.tccue.app.ui

import android.content.SharedPreferences
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tccue.app.ConnectionState
import com.tccue.app.NsdDiscovery
import com.tccue.app.TCWSClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

@Serializable
private data class HealthResponse(
    val ok: Boolean,
    val tc: String = "",
    val state: String = "",
    val fps: Double = 25.0
)

@Composable
fun SettingsScreen(
    client: TCWSClient,
    discovery: NsdDiscovery,
    prefs: SharedPreferences,
    modifier: Modifier = Modifier
) {
    val connectionState by client.connectionState.collectAsState()
    val currentTc by client.currentTc.collectAsState()
    val lastError by client.lastError.collectAsState()
    val servers by discovery.servers.collectAsState()

    var serverURL by rememberSaveable {
        mutableStateOf(prefs.getString("serverURL", "") ?: "")
    }
    var pingResult by remember { mutableStateOf<String?>(null) }
    var pinging by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    DisposableEffect(Unit) {
        discovery.start()
        onDispose { discovery.stop() }
    }

    fun pingServer() {
        pinging = true
        pingResult = null
        scope.launch {
            pingResult = withContext(Dispatchers.IO) { checkHealth(serverURL) }
            pinging = false
        }
    }

    Column(
        modifier
            .fillMaxSize()
            .background(Color.Black)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Text(
            "Einstellungen",
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold
        )

        // ── Im Netzwerk gefunden ──
        if (servers.isNotEmpty()) {
            SectionCard(title = "IM NETZWERK GEFUNDEN") {
                servers.forEach { server ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { serverURL = server.url }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(server.name, color = Color.White, fontSize = 15.sp)
                            Text(
                                server.url,
                                color = Muted,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        if (serverURL == server.url) {
                            Icon(
                                Icons.Filled.Check,
                                contentDescription = "ausgewählt",
                                tint = AccentGreen
                            )
                        }
                    }
                }
            }
        }

        // ── Verbindung ──
        SectionCard(title = "VERBINDUNG") {
            OutlinedTextField(
                value = serverURL,
                onValueChange = {
                    serverURL = it
                    pingResult = null
                },
                placeholder = { Text("192.168.1.x:3000", color = Muted) },
                label = { Text("Server-URL") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentGreen,
                    unfocusedBorderColor = Color(0xFF2A2A2A),
                    focusedLabelColor = AccentGreen,
                    unfocusedLabelColor = Muted,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = AccentGreen
                )
            )

            if (connectionState == ConnectionState.CONNECTED) {
                Button(
                    onClick = { client.disconnect() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentRed.copy(alpha = 0.2f),
                        contentColor = AccentRed
                    )
                ) { Text("Trennen") }
            } else {
                Button(
                    onClick = {
                        prefs.edit().putString("serverURL", serverURL).apply()
                        client.connect(serverURL)
                        pingServer()
                    },
                    enabled = serverURL.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentGreen,
                        contentColor = Color.Black
                    )
                ) {
                    Text(if (connectionState == ConnectionState.CONNECTING) "Verbinde…" else "Verbinden")
                }
            }

            OutlinedButton(
                onClick = { pingServer() },
                enabled = serverURL.isNotBlank() && !pinging,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (pinging) "Teste…" else "Verbindung testen", color = Color.White)
            }

            pingResult?.let { result ->
                Text(
                    result,
                    color = if (result.startsWith("✓")) AccentGreen else AccentRed,
                    fontSize = 12.sp
                )
            }
        }

        // ── Status ──
        SectionCard(title = "STATUS") {
            StatusRow("Status") {
                val (color, label) = when (connectionState) {
                    ConnectionState.CONNECTED -> AccentGreen to "Verbunden"
                    ConnectionState.CONNECTING -> AccentYellow to "Verbinde…"
                    ConnectionState.DISCONNECTED -> AccentRed to "Getrennt"
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(7.dp)
                            .background(color, CircleShape)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(label, color = color, fontSize = 14.sp)
                }
            }
            StatusRow("Server") {
                Text(
                    client.serverURL.ifEmpty { "–" },
                    color = Muted,
                    fontSize = 14.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            StatusRow("Timecode") {
                Text(
                    currentTc,
                    color = if (connectionState == ConnectionState.CONNECTED) AccentGreen else Muted,
                    fontSize = 14.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            lastError?.let {
                Text(it, color = AccentRed, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Surface1, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            title,
            color = Muted,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.2.sp
        )
        content()
    }
}

@Composable
private fun StatusRow(label: String, value: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color.White, fontSize = 14.sp)
        Spacer(Modifier.weight(1f))
        value()
    }
}

/** Prüft /api/health wie der iOS-Client. Läuft auf Dispatchers.IO. */
private fun checkHealth(serverURL: String): String {
    var address = serverURL.trim()
        .replace("ws://", "http://")
        .replace("wss://", "https://")
    if (!address.startsWith("http://") && !address.startsWith("https://")) {
        address = "http://$address"
    }
    val url = address.trimEnd('/') + "/api/health"

    return try {
        val http = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()
        http.newCall(Request.Builder().url(url).build()).execute().use { response ->
            val body = response.body?.string()
            if (!response.isSuccessful || body == null) {
                return "✗ Kein TC-Cue-Server unter dieser Adresse"
            }
            val json = Json { ignoreUnknownKeys = true }
            val health = json.decodeFromString<HealthResponse>(body)
            if (!health.ok) return "✗ Kein TC-Cue-Server unter dieser Adresse"
            val state = if (health.state == "running") "Timecode läuft" else "Timecode gestoppt"
            "✓ Server erreichbar · $state · ${health.tc}"
        }
    } catch (e: Exception) {
        "✗ Nicht erreichbar: ${e.message}"
    }
}
