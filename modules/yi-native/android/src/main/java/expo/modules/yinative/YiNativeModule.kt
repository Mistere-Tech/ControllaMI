package expo.modules.yinative

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YiNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Contesto Android non disponibile")

  private val connectivity: ConnectivityManager
    get() = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  @Suppress("DEPRECATION")
  private fun findWifi(): Network? {
    val cm = connectivity
    return cm.allNetworks.firstOrNull { net ->
      cm.getNetworkCapabilities(net)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }
  }

  override fun definition() = ModuleDefinition {
    Name("YiNative")

    // La rete della camera non ha internet: senza questo Android manderebbe
    // il traffico sui dati mobili e 192.168.42.1 non risponderebbe.
    AsyncFunction("bindToWifi") {
      val wifi = findWifi()
      if (wifi == null) false else connectivity.bindProcessToNetwork(wifi)
    }

    Function("unbind") {
      connectivity.bindProcessToNetwork(null)
    }

    Function("isWifiConnected") {
      findWifi() != null
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
