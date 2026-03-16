package com.thousandways.travel

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class ShareActivity : ReactActivity() {

  override fun getMainComponentName(): String = "ShareMenu"

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
}
