package com.tccue.app

import android.app.Application

/** Hält Client und Now-Bar-Manager prozessweit, damit Activity und Service sie teilen. */
class TCApp : Application() {
    val client: TCWSClient by lazy { TCWSClient() }
    val nowBar: NowBarManager by lazy { NowBarManager(this) }
}
