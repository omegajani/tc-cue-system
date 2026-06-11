package com.tccue.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.sample
import kotlinx.coroutines.launch

/**
 * Foreground Service: hält die WebSocket-Verbindung am Leben, wenn das
 * Display aus ist oder die App im Hintergrund läuft, und pflegt die
 * Live-Update-Notification (Samsung Now Bar).
 *
 * Ohne Foreground Service friert Android den Prozess beim Sperren ein —
 * die Verbindung stirbt und der Cue-Alarm bleibt aus.
 */
class CueService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onBind(intent: Intent?): IBinder? = null

    @OptIn(FlowPreview::class)
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val app = application as TCApp
        val client = app.client
        val nowBar = app.nowBar

        startForeground(
            NowBarManager.NOTIFICATION_ID,
            nowBar.buildNotification(
                client.currentCue.value,
                client.nextCue.value,
                client.currentTc.value,
                client.show.value
            )
        )

        client.onCueFire = { cue, next ->
            vibrateAlarm()
            nowBar.update(cue, next, client.currentTc.value, client.show.value)
        }

        // Fortschritt alle 5 s nachführen
        scope.launch {
            client.currentTc.sample(5000).collect { tc ->
                if (client.connectionState.value == ConnectionState.CONNECTED) {
                    nowBar.update(client.currentCue.value, client.nextCue.value, tc, client.show.value)
                }
            }
        }

        // Wenn der Nutzer manuell trennt → Service beenden.
        // Bei unerwartetem Disconnect läuft der Service weiter, damit der
        // Client im Hintergrund reconnecten kann.
        scope.launch {
            client.connectionState.collect { state ->
                if (state == ConnectionState.DISCONNECTED && !client.autoReconnect) {
                    stopSelf()
                }
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        (application as TCApp).let {
            it.client.onCueFire = null
            it.nowBar.clear()
        }
        super.onDestroy()
    }

    private fun vibrateAlarm() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = longArrayOf(0, 300, 120, 300, 120, 500)
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }

    companion object {
        fun start(context: Context) {
            context.startForegroundService(Intent(context, CueService::class.java))
        }
    }
}
