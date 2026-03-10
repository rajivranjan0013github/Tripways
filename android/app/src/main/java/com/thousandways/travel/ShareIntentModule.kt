package com.thousandways.travel

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ShareIntentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "ShareIntentModule"
    }

    @ReactMethod
    fun getSharedUrl(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.resolve(null)
            return
        }

        val intent = activity.intent
        val action = intent?.action
        val type = intent?.type

        if (Intent.ACTION_SEND == action && type == "text/plain") {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (sharedText != null) {
                // Clear the intent so we don't process it again on next launch
                intent.removeExtra(Intent.EXTRA_TEXT)
                intent.action = Intent.ACTION_MAIN
                promise.resolve(sharedText)
                return
            }
        }
        promise.resolve(null)
    }
    
    @ReactMethod
    fun clearSharedUrl(promise: Promise) {
        // No-op for Android as we clear it when getting it, but implemented for cross-platform parity
        promise.resolve(true)
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        // Not used
    }

    override fun onNewIntent(intent: Intent?) {
        // Forward new intents to the current activity
        val activity = currentActivity
        if (activity != null && intent != null) {
            activity.intent = intent
        }
    }
}
