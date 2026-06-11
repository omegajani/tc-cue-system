package com.tccue.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Zeigt den aktuellen Cue als Live-Update-Notification an (Android 16+).
 * Auf Samsung One UI 8+ erscheint diese in der Now Bar.
 *
 * Die Notification nutzt ProgressStyle mit einem Segment pro Cue-Abschnitt
 * in der jeweiligen Cue-Farbe; der Fortschritt läuft über die Show-Timeline
 * vom ersten bis zum letzten Cue.
 */
class NowBarManager(private val context: Context) {
    companion object {
        private const val CHANNEL_ID = "live_cue"
        const val NOTIFICATION_ID = 1
        /** Mindestens API 36 (Android 16) für ProgressStyle/Live Updates. */
        val supported: Boolean get() = Build.VERSION.SDK_INT >= 36
    }

    private val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Aktueller Cue",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Live-Anzeige des aktuellen Cues (Now Bar)"
                    setSound(null, null)
                }
            )
        }
    }

    private fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    /**
     * Baut die Notification für den aktuellen Zustand. Ohne aktiven Cue
     * eine schlichte Verbunden-Notification (für den Foreground Service).
     */
    fun buildNotification(
        cue: CueModel?,
        nextCue: CueModel?,
        currentTc: String,
        show: ShowModel?
    ): Notification {
        if (!supported || cue == null || show == null || show.cues.isEmpty()) {
            return Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_cue)
                .setContentTitle("TC Cue verbunden")
                .setContentText("Warte auf Cues…")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
        }

        val title = cue.title
        val text = nextCue?.let { "Als Nächstes: ${it.title} (${it.tc})" } ?: "Letzter Cue der Show"
        val color = parseColorInt(cue.color)

        fun build(qprVariant: Boolean): Notification {
            val builder = Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_cue)
                .setContentTitle(title)
                .setContentText(text)
                .setShortCriticalText("CUE")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setColor(color)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setStyle(buildProgressStyle(show, currentTc))
            if (qprVariant) {
                // Android 16 QPR (One UI 8.5): explizite Promotion-Anfrage,
                // setColorized darf NICHT gesetzt sein. Das Extra entspricht
                // Builder.setRequestPromotedOngoing(true), das es im
                // Basis-SDK 36 noch nicht gibt.
                builder.extras.putBoolean("android.requestPromotedOngoing", true)
            } else {
                // Android 16 Basis-Release: Promotion verlangt Colorized
                builder.setColorized(true)
            }
            return builder.build()
        }

        // Die Promotable-Kriterien unterscheiden sich zwischen Android-16-
        // Basis und QPR — lokal prüfbar, also einfach beide probieren
        return build(qprVariant = true)
            .takeIf { it.hasPromotableCharacteristics() }
            ?: build(qprVariant = false)
    }

    /** Aktualisiert die Now-Bar-Notification. */
    fun update(
        cue: CueModel?,
        nextCue: CueModel?,
        currentTc: String,
        show: ShowModel?
    ) {
        if (!hasPermission()) return
        nm.notify(NOTIFICATION_ID, buildNotification(cue, nextCue, currentTc, show))
    }

    /** Ob der Nutzer Live-Updates (Now Bar) für die App erlaubt hat. */
    fun canPromote(): Boolean = supported && nm.canPostPromotedNotifications()

    /** Intent für die System-Einstellungsseite, auf der Live-Updates erlaubt werden. */
    fun promotionSettingsIntent(): android.content.Intent =
        android.content.Intent("android.settings.APP_NOTIFICATION_PROMOTION_SETTINGS")
            .putExtra("android.provider.extra.APP_PACKAGE", context.packageName)

    fun clear() {
        nm.cancel(NOTIFICATION_ID)
    }

    /** Show-Timeline als Segmente: ein Segment pro Cue-Intervall in Cue-Farbe. */
    private fun buildProgressStyle(show: ShowModel, currentTc: String): Notification.ProgressStyle {
        val cues = show.cues
        val startSec = tcToSeconds(cues.first().tc)
        // Letztem Cue noch eine Minute "Auslauf" geben, damit er nie bei 100% klemmt
        val endSec = tcToSeconds(cues.last().tc) + 60.0
        val totalSec = (endSec - startSec).coerceAtLeast(1.0)

        val style = Notification.ProgressStyle()
            .setStyledByProgress(false)
            .setProgress(
                ((tcToSeconds(currentTc) - startSec).coerceIn(0.0, totalSec)).toInt()
            )

        // Segment i läuft von Cue i bis Cue i+1, gefärbt nach Cue i
        val segments = cues.mapIndexed { i, cue ->
            val segStart = tcToSeconds(cue.tc)
            val segEnd = if (i + 1 < cues.size) tcToSeconds(cues[i + 1].tc) else endSec
            Notification.ProgressStyle.Segment((segEnd - segStart).toInt().coerceAtLeast(1))
                .setColor(parseColorInt(cue.color))
        }
        return style.setProgressSegments(segments)
    }

    private fun parseColorInt(hex: String): Int {
        return try {
            android.graphics.Color.parseColor(hex)
        } catch (e: Exception) {
            android.graphics.Color.parseColor("#10B981")
        }
    }
}
