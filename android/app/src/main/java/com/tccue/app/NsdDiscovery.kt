package com.tccue.app

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

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
 * Liest IP und Port aus dem TXT-Record, wie der iOS-Client.
 */
class NsdDiscovery(context: Context) {
    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

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
                nsdManager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {}
                    override fun onServiceResolved(info: NsdServiceInfo) {
                        // TXT-Record bevorzugen (enthält die beworbene LAN-IP)
                        val txtIp = info.attributes["ip"]?.let { String(it) }
                        val txtPort = info.attributes["port"]?.let { String(it).toIntOrNull() }
                        val host = txtIp?.takeIf { it.isNotEmpty() }
                            ?: info.host?.hostAddress
                            ?: return
                        val port = txtPort ?: info.port
                        val server = DiscoveredServer(
                            id = "$host:$port",
                            name = "TC Cue System",
                            host = host,
                            port = port
                        )
                        _servers.value = (_servers.value.filter { it.id != server.id } + server)
                    }
                })
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                // Ohne Resolve kennen wir die IP nicht — Liste konservativ leeren,
                // beim nächsten Fund wird sie neu befüllt.
                _servers.value = emptyList()
            }
        }
        discoveryListener = listener
        nsdManager.discoverServices("_tccue._tcp.", NsdManager.PROTOCOL_DNS_SD, listener)
    }

    fun stop() {
        stopSafely()
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
