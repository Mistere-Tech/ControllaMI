package expo.modules.yinative

import android.content.Context
import android.view.ViewGroup
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.rtsp.RtspMediaSource
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** Live view RTSP della camera con buffer minimo, per avere poca latenza. */
class YiRtspView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onPlaybackState by EventDispatcher()
  private var player: ExoPlayer? = null
  private var currentUrl: String? = null

  private val playerView = PlayerView(context).apply {
    useController = false
    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
  }

  init {
    addView(playerView)
  }

  fun setUrl(url: String?) {
    if (url == currentUrl && player != null) return
    currentUrl = url
    releasePlayer()
    if (!url.isNullOrBlank() && isAttachedToWindow) startPlayer(url)
  }

  private fun startPlayer(url: String) {
    val loadControl = DefaultLoadControl.Builder()
      .setBufferDurationsMs(500, 2000, 250, 500)
      .build()
    val p = ExoPlayer.Builder(context).setLoadControl(loadControl).build()
    val source = RtspMediaSource.Factory()
      .setTimeoutMs(4000)
      .createMediaSource(MediaItem.fromUri(url))

    p.addListener(object : Player.Listener {
      override fun onPlaybackStateChanged(state: Int) {
        val name = when (state) {
          Player.STATE_BUFFERING -> "buffering"
          Player.STATE_READY -> "ready"
          Player.STATE_ENDED -> "ended"
          else -> "idle"
        }
        onPlaybackState(mapOf("state" to name))
      }

      // "ready" arriva quando lo stream è agganciato; l'immagine solo col primo fotogramma completo.
      // La app toglie "Avvio live view…" solo qui (segnalazione del 12/11: schermo nero).
      override fun onRenderedFirstFrame() {
        onPlaybackState(mapOf("state" to "firstFrame"))
      }

      override fun onPlayerError(error: PlaybackException) {
        onPlaybackState(mapOf("state" to "error", "message" to (error.message ?: error.errorCodeName)))
      }
    })
    p.setMediaSource(source)
    p.playWhenReady = true
    p.prepare()
    playerView.player = p
    player = p
  }

  private fun releasePlayer() {
    playerView.player = null
    player?.release()
    player = null
  }

  /** La vista viene distrutta: libera il player e dimentica l'URL. */
  fun release() {
    releasePlayer()
    currentUrl = null
  }

  // Regressione del 10/11: staccando la vista (cambio tab) il player veniva distrutto
  // insieme all'URL e al ritorno restava nero. Ora l'URL resta e il player riparte.
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val url = currentUrl
    if (player == null && !url.isNullOrBlank()) startPlayer(url)
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    releasePlayer()
  }
}
