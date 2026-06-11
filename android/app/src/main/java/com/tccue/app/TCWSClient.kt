package com.tccue.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

/**
 * Verbindet sich mit dem TC-Cue WebSocket-Server.
 * Reconnect mit exponentiellem Backoff, analog zum iOS-Client.
 */
class TCWSClient {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val json = Json { ignoreUnknownKeys = true }

    private val http = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private val _currentTc = MutableStateFlow("--:--:--:--")
    val currentTc: StateFlow<String> = _currentTc

    private val _previousCue = MutableStateFlow<CueModel?>(null)
    val previousCue: StateFlow<CueModel?> = _previousCue

    private val _currentCue = MutableStateFlow<CueModel?>(null)
    val currentCue: StateFlow<CueModel?> = _currentCue

    private val _nextCue = MutableStateFlow<CueModel?>(null)
    val nextCue: StateFlow<CueModel?> = _nextCue

    private val _currentPosition = MutableStateFlow<ShowPositionModel?>(null)
    val currentPosition: StateFlow<ShowPositionModel?> = _currentPosition

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError

    var onCueFire: ((CueModel, CueModel?) -> Unit)? = null

    var serverURL: String = ""
        private set

    private var socket: WebSocket? = null
    private var reconnectJob: Job? = null
    private var reconnectDelayMs = 2000L
    private var shouldReconnect = false

    fun connect(serverURL: String) {
        val normalized = serverURL.trim().trim('/')
        if (this.serverURL == normalized && _connectionState.value != ConnectionState.DISCONNECTED) return
        this.serverURL = normalized
        _lastError.value = null
        reconnectDelayMs = 2000L
        shouldReconnect = true
        reconnectJob?.cancel()
        openSocket()
    }

    fun disconnect() {
        shouldReconnect = false
        reconnectJob?.cancel()
        socket?.close(1000, "bye")
        socket = null
        _connectionState.value = ConnectionState.DISCONNECTED
        _previousCue.value = null
        _currentCue.value = null
        _nextCue.value = null
        _currentPosition.value = null
        _currentTc.value = "--:--:--:--"
    }

    private fun openSocket() {
        val host = serverURL
            .removePrefix("http://").removePrefix("https://")
            .removePrefix("ws://").removePrefix("wss://")
            .trim()
        if (host.isEmpty()) {
            _lastError.value = "Ungültige Server-Adresse"
            return
        }

        socket?.cancel()
        _connectionState.value = ConnectionState.CONNECTING

        val request = Request.Builder().url("ws://$host/").build()
        socket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                scope.launch {
                    _connectionState.value = ConnectionState.CONNECTED
                    _lastError.value = null
                    reconnectDelayMs = 2000L
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch { handleDisconnect(t.message) }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch { handleDisconnect(null) }
            }
        })
    }

    private fun handleMessage(text: String) {
        val type = try {
            json.parseToJsonElement(text).jsonObject["type"]?.jsonPrimitive?.content
        } catch (e: Exception) {
            null
        } ?: return

        when (type) {
            "TC_UPDATE" -> {
                val ev = try {
                    json.decodeFromString<TCUpdateEvent>(text)
                } catch (e: Exception) {
                    return
                }
                scope.launch {
                    _currentTc.value = ev.tc
                    _previousCue.value = ev.previousCue
                    _currentCue.value = ev.currentCue
                    _nextCue.value = ev.nextCue
                    _currentPosition.value = ev.currentPosition
                }
            }

            "CUE_FIRE" -> {
                val ev = try {
                    json.decodeFromString<CueFireEvent>(text)
                } catch (e: Exception) {
                    return
                }
                scope.launch {
                    _previousCue.value = ev.previousCue
                    _currentCue.value = ev.cue
                    _nextCue.value = ev.nextCue
                    onCueFire?.invoke(ev.cue, ev.nextCue)
                }
            }
        }
    }

    private fun handleDisconnect(error: String?) {
        if (_connectionState.value == ConnectionState.DISCONNECTED && !shouldReconnect) return
        socket = null
        _connectionState.value = ConnectionState.DISCONNECTED
        _lastError.value = error
        _currentTc.value = "--:--:--:--"
        if (!shouldReconnect) return
        val delayNow = reconnectDelayMs
        reconnectDelayMs = (reconnectDelayMs * 3 / 2).coerceAtMost(30_000L)
        reconnectJob = scope.launch {
            delay(delayNow)
            if (shouldReconnect) openSocket()
        }
    }
}
