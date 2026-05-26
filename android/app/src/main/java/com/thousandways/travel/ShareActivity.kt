package com.thousandways.travel

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class ShareActivity : ReactActivity() {

  override fun getMainComponentName(): String = "ShareMenu"

  override fun onCreate(savedInstanceState: Bundle?) {
      super.onCreate(savedInstanceState)
      // Suppress the default activity enter transition to avoid black flash
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, "ShareMenu", fabricEnabled) {
          override fun getLaunchOptions(): Bundle? {
              val intent = intent
              val action = intent?.action
              val type = intent?.type
              val bundle = Bundle()
              
              if (Intent.ACTION_SEND == action && type != null && type.startsWith("text/")) {
                  val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                  if (sharedText != null) {
                      bundle.putString("sharedUrl", sharedText)
                  }
              }
              return bundle
          }
      }

  override fun onNewIntent(intent: Intent) {
      super.onNewIntent(intent)
      setIntent(intent)
  }

  override fun finish() {
      super.finish()
      // Suppress exit transition — the RN component handles its own slide-down animation
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
  }
}
