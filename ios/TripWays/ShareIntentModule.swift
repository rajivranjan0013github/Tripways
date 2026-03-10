/**
 * ShareIntentModule.swift
 * TripWays
 */

import Foundation
import UIKit

@objc(ShareIntentModule)
class ShareIntentModule: NSObject {
    
    private let appGroupId = "group.com.thousandways.travel"
    
    @objc(requiresMainQueueSetup)
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(getSharedUrl:rejecter:)
    func getSharedUrl(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("ShareIntentModule: FATAL ERROR - Could not access App Group: \(appGroupId)")
            resolve(nil)
            return
        }
        
        let url = userDefaults.string(forKey: "sharedUrl")
        print("ShareIntentModule: Checked App Group '\(appGroupId)' for 'sharedUrl'. Result: \(url ?? "nil")")
        
        resolve(url)
    }
    
    @objc(clearSharedUrl:rejecter:)
    func clearSharedUrl(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let userDefaults = UserDefaults(suiteName: appGroupId)
        userDefaults?.removeObject(forKey: "sharedUrl")
        userDefaults?.synchronize()
        resolve(true)
    }

    @objc(setAppGroupData:backendUrl:resolver:rejecter:)
    func setAppGroupData(userId: String, backendUrl: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("ShareIntentModule: ERROR - Could not access App Group: \(appGroupId)")
            resolve(false)
            return
        }
        userDefaults.set(userId, forKey: "userId")
        userDefaults.set(backendUrl, forKey: "backendUrl")
        userDefaults.synchronize()
        print("ShareIntentModule: Saved userId='\(userId)' backendUrl='\(backendUrl)' to App Group")
        resolve(true)
    }
}
