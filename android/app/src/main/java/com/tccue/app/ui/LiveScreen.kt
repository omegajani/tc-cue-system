package com.tccue.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tccue.app.ConnectionState
import com.tccue.app.CueModel
import com.tccue.app.ShowPositionModel
import com.tccue.app.TCWSClient
import com.tccue.app.formatRemaining
import com.tccue.app.tcToSeconds
import kotlin.math.ceil

@Composable
fun LiveScreen(client: TCWSClient, modifier: Modifier = Modifier) {
    val connectionState by client.connectionState.collectAsState()
    val currentTc by client.currentTc.collectAsState()
    val previousCue by client.previousCue.collectAsState()
    val currentCue by client.currentCue.collectAsState()
    val nextCue by client.nextCue.collectAsState()
    val position by client.currentPosition.collectAsState()

    // Flash bei Cue-Wechsel
    var flashAlpha by remember { mutableStateOf(0f) }
    val animatedFlash by animateColorAsState(
        targetValue = (currentCue?.composeColor ?: Color.White).copy(alpha = flashAlpha),
        animationSpec = tween(650),
        label = "flash"
    )
    LaunchedEffect(currentCue?.id) {
        if (currentCue != null) {
            flashAlpha = 0.3f
            kotlinx.coroutines.delay(80)
            flashAlpha = 0f
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(animatedFlash)
        )

        Column(Modifier.fillMaxSize()) {
            // ── Statusleiste ──
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ConnectionBadge(connectionState)
                Spacer(Modifier.weight(1f))
            }

            HorizontalDivider(color = Color.White.copy(alpha = 0.1f))

            position?.let { PositionStrip(it, currentTc) }

            Spacer(Modifier.height(12.dp))

            if (previousCue == null && currentCue == null && nextCue == null) {
                NoCuePanel(currentTc)
            } else {
                Column(
                    Modifier.padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    previousCue?.let {
                        CueRow(it, state = "Letzter Cue", isCurrent = false, alpha = 0.35f)
                    }
                    currentCue?.let {
                        CueRow(it, state = "Aktueller Cue", isCurrent = true, alpha = 1f)
                    }
                    nextCue?.let {
                        CueRow(
                            it, state = "Als Nächstes", isCurrent = false, alpha = 0.75f,
                            trailing = "in " + formatRemaining(
                                ceil(tcToSeconds(it.tc) - tcToSeconds(currentTc)).toInt().coerceAtLeast(0)
                            )
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ConnectionBadge(state: ConnectionState) {
    val (color, label) = when (state) {
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
        Spacer(Modifier.width(5.dp))
        Text(label, color = color, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun PositionStrip(position: ShowPositionModel, currentTc: String) {
    val start = tcToSeconds(position.startTc)
    val duration = (tcToSeconds(position.endTc) - start).coerceAtLeast(0.001)
    val progress = ((tcToSeconds(currentTc) - start) / duration).coerceIn(0.0, 1.0).toFloat()
    val remaining = ceil(tcToSeconds(position.endTc) - tcToSeconds(currentTc)).toInt().coerceAtLeast(0)

    Column(
        Modifier
            .fillMaxWidth()
            .background(AccentBlue.copy(alpha = 0.1f))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "POSITION",
                color = AccentBlue,
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.5.sp
            )
            Spacer(Modifier.width(10.dp))
            Text(
                position.name,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Text(
                "noch " + formatRemaining(remaining),
                color = AccentBlue,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp),
            color = AccentBlue,
            trackColor = AccentBlue.copy(alpha = 0.2f)
        )
    }
}

@Composable
private fun CueRow(
    cue: CueModel,
    state: String,
    isCurrent: Boolean,
    alpha: Float,
    trailing: String? = null
) {
    val cueColor = cue.composeColor
    Row(
        Modifier
            .fillMaxWidth()
            .alpha(alpha)
            .background(
                Color.White.copy(alpha = if (isCurrent) 0.05f else 0.015f),
                RoundedCornerShape(12.dp)
            )
            .border(
                width = 1.dp,
                color = if (isCurrent) cueColor else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
            .padding(
                horizontal = if (isCurrent) 16.dp else 12.dp,
                vertical = if (isCurrent) 18.dp else 9.dp
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            cue.tc,
            color = if (isCurrent) cueColor else Muted,
            fontSize = if (isCurrent) 13.sp else 11.sp,
            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.width(92.dp)
        )

        Box(
            Modifier
                .size(if (isCurrent) 11.dp else 7.dp)
                .background(cueColor, CircleShape)
        )

        Column(
            Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(if (isCurrent) 6.dp else 2.dp)
        ) {
            Text(
                cue.title,
                color = if (isCurrent) Color.White else Muted,
                fontSize = if (isCurrent) 27.sp else 13.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            if (isCurrent && cue.message.isNotEmpty()) {
                Text(
                    cue.message,
                    color = Color.White.copy(alpha = 0.72f),
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    state.uppercase(),
                    color = if (isCurrent) cueColor else Muted,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.2.sp
                )
                if (trailing != null) {
                    Spacer(Modifier.weight(1f))
                    Text(
                        trailing,
                        color = cueColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
private fun NoCuePanel(currentTc: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 50.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            currentTc,
            color = Color.White,
            fontSize = 44.sp,
            fontWeight = FontWeight.Thin,
            fontFamily = FontFamily.Monospace
        )
        Text("Kein aktiver Cue", color = Muted, fontSize = 13.sp)
    }
}
