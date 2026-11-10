package expo.modules.yinative

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YiNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Contesto Android non disponibile")

  private val connectivity: ConnectivityManager
    get() = context.getSystemService(ConnectivityManager::class.java)

  /** Callback della richiesta Wi-Fi attiva; finché è registrata Android tiene su la rete della camera. */
  private var wifiCallback: ConnectivityManager.NetworkCallback? = null
  private var wifiNetwork: Network? = null

  /** Wi-Fi anche senza internet: è il caso della camera (192.168.42.1, nessun gateway verso l'esterno). */
  private val wifiRequest: NetworkRequest =
    NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()

  private fun releaseWifi() {
    wifiCallback?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
    wifiCallback = null
    wifiNetwork = null
    runCatching { connectivity.bindProcessToNetwork(null) }
  }

  override fun definition() = ModuleDefinition {
    Name("YiNative")

    // La rete della camera non ha internet: senza bind Android manderebbe
    // il traffico sui dati mobili e 192.168.42.1 non risponderebbe.
    AsyncFunction("bindToWifi") { promise: Promise ->
      releaseWifi()
      var settled = false
      val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          wifiNetwork = network
          val bound = connectivity.bindProcessToNetwork(network)
          if (!settled) {
            settled = true
            promise.resolve(bound)
          }
        }

        override fun onUnavailable() {
          if (!settled) {
            settled = true
            promise.resolve(false)
          }
        }

        override fun onLost(network: Network) {
          if (network == wifiNetwork) {
            wifiNetwork = null
            connectivity.bindProcessToNetwork(null)
          }
        }
      }
      wifiCallback = callback
      // Se entro 5 s non c'è un Wi-Fi, onUnavailable risolve con false.
      connectivity.requestNetwork(wifiRequest, callback, 5_000)
    }

    Function("unbind") {
      releaseWifi()
    }

    Function("isWifiConnected") {
      val cm = connectivity
      val active = wifiNetwork ?: cm.activeNetwork
      cm.getNetworkCapabilities(active)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }

    OnDestroy {
      releaseWifi()
    }

    View(YiRtspView::class) {
      Prop("url") { view: YiRtspView, url: String? ->
        view.setUrl(url)
      }
      Events("onPlaybackState")
      OnViewDestroys { view: YiRtspView ->
        view.release()
      }
    }
  }
}
