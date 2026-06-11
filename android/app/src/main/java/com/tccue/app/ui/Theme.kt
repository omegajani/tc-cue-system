package com.tccue.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val AccentGreen = Color(0xFF10B981)
val AccentBlue = Color(0xFF3B82F6)
val AccentYellow = Color(0xFFF59E0B)
val AccentRed = Color(0xFFEF4444)
val Muted = Color(0xFF666666)
val Surface1 = Color(0xFF1A1A1A)
val Surface2 = Color(0xFF222222)

private val DarkColors = darkColorScheme(
    primary = AccentGreen,
    background = Color.Black,
    surface = Surface1,
    surfaceVariant = Surface2,
    onBackground = Color(0xFFE5E5E5),
    onSurface = Color(0xFFE5E5E5)
)

@Composable
fun TCCueTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
