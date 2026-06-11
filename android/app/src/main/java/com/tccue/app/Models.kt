package com.tccue.app

import androidx.compose.ui.graphics.Color
import kotlinx.serialization.Serializable

@Serializable
data class CueModel(
    val id: String,
    val tc: String,
    val title: String,
    val message: String = "",
    val color: String = "#10b981"
) {
    val composeColor: Color
        get() = parseHexColor(color) ?: Color(0xFF10B981)
}

@Serializable
data class ShowPositionModel(
    val id: String,
    val name: String,
    val startTc: String,
    val endTc: String
)

@Serializable
data class TCUpdateEvent(
    val type: String,
    val tc: String,
    val previousCue: CueModel? = null,
    val currentCue: CueModel? = null,
    val nextCue: CueModel? = null,
    val currentPosition: ShowPositionModel? = null
)

@Serializable
data class CueFireEvent(
    val type: String,
    val tc: String,
    val cue: CueModel,
    val previousCue: CueModel? = null,
    val nextCue: CueModel? = null
)

enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

fun parseHexColor(hex: String): Color? {
    var h = hex.trim()
    if (h.startsWith("#")) h = h.substring(1)
    if (h.length != 6) return null
    val value = h.toLongOrNull(16) ?: return null
    return Color(
        red = ((value shr 16) and 0xFF) / 255f,
        green = ((value shr 8) and 0xFF) / 255f,
        blue = (value and 0xFF) / 255f
    )
}

/** "hh:mm:ss:ff" → Sekunden (25 fps) */
fun tcToSeconds(tc: String): Double {
    val parts = tc.split(":").mapNotNull { it.toDoubleOrNull() }
    if (parts.size != 4) return 0.0
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 25.0
}

fun formatRemaining(seconds: Int): String {
    if (seconds < 60) return "${seconds}s"
    val minutes = seconds / 60
    val rest = seconds % 60
    return if (rest == 0) "${minutes}m" else "${minutes}m ${rest}s"
}
