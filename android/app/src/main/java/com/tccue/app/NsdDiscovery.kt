package com.tccue.app

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

data class DiscoveredServer(
    val id: String,
    val name: String,
    val host: String,
    val port: Int
) {
    val url: String get() = "$host:$port"
}

/**
 * Findet TC-Cue-Server im Netzwerk via mDNS (_tccue._tcp).
 *
 * mDNS-Caches können veraltete Einträge liefern (z.B. die IP aus einem
 * früheren Netzwerk). Deshalb wird jeder Kandidat erst per /api/health
 * verifiziert, bevor er in der Liste landet.
 */
class NsdDiscovery(context: Context) {
    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val http = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(2, TimeUnit.SECONDS)
        .build()

    private val _servers = MutableStateFlow<List<DiscoveredServer>>(emptyList())
    val servers: StateFlow<List<DiscoveredServer>> = _servers

    private var discoveryListener: NsdManager.DiscoveryListener? = null

    fun start() {
        if (discoveryListener != null) return
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                stopSafely()
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                android.util.Log.d("NsdDiscovery", "found: ${serviceInfo.serviceName}")
                nsdManager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                        android.util.Log.d("NsdDiscovery", "resolve failed: $errorCode")
                    }
                    override fun onServiceResolved(info: NsdServiceInfo) {
                        android.util.Log.d(
                            "NsdDiscovery",
                            "resolved host=${info.host?.hostAddress} port=${info.port} txt=${info.attributes.mapValues { String(it.value ?: ByteArray(0)) }}"
                        )
                        handleResolved(info)
                    }
                })
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                // Liste leeren — reachable Server werden beim nächsten Fund
                // wieder verifiziert und aufgenommen
                _servers.value = emptyList()
            }
        }
        discoveryListener = listener
        nsdManager.discoverServices("_tccue._tcp.", NsdManager.PROTOCOL_DNS_SD, listener)
    }

    private fun handleResolved(info: NsdServiceInfo) {
        // Kandidaten sammeln: TXT-Record-IP (vom Server beworben) und
        // per mDNS aufgelöste Adressen — beide können stale sein
        val txtIp = info.attributes["ip"]?.let { String(it) }?.takeIf { it.isNotEmpty() }
        val txtPort = info.attributes["port"]?.let { String(it).toIntOrNull() }
        val resolvedIps = info.host?.hostAddress?.let { listOf(it) } ?: emptyList()
        val port = txtPort ?: info.port

        val candidates = (listOfNotNull(txtIp) + resolvedIps)
            .distinct()
            .filter { !it.contains(":") } // IPv6 erstmal außen vor
        val name = info.serviceName ?: "TC Cue System"

        scope.launch {
            for (host in candidates) {
                if (isTcCueServer(host, port)) {
                    val server = DiscoveredServer(
                        id = "$host:$port",
                        name = name,
                        host = host,
                        port = port
                    )
                    _servers.value = (_servers.value.filter { it.id != server.id } + server)
                }
            }
        }
    }

    /** Verifiziert per /api/health, dass unter der Adresse wirklich ein TC-Cue-Server läuft. */
    private fun isTcCueServer(host: String, port: Int): Boolean {
        return try {
            val request = Request.Builder().url("http://$host:$port/api/health").build()
            http.newCall(request).execute().use { response ->
                response.isSuccessful && response.body?.string()?.contains("\"ok\":true") == true
            }
        } catch (e: Exception) {
            false
        }
    }

    fun stop() {
        stopSafely()
        scope.coroutineContext.cancelChildren()
        _servers.value = emptyList()
    }

    private fun stopSafely() {
        discoveryListener?.let {
            try {
                nsdManager.stopServiceDiscovery(it)
            } catch (e: Exception) {
                // already stopped
            }
        }
        discoveryListener = null
    }
}
