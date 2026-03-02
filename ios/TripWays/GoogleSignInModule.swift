import Foundation
import GoogleSignIn
import React

@objc(GoogleSignInModule)
class GoogleSignInModule: NSObject {
  private func topViewController(base: UIViewController? = {
    if let rct = RCTPresentedViewController() { return rct }
    let keyRoot = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first(where: { $0.isKeyWindow })?.rootViewController
    return keyRoot
  }()) -> UIViewController? {
      if let nav = base as? UINavigationController { return topViewController(base: nav.visibleViewController) }
      if let tab = base as? UITabBarController, let selected = tab.selectedViewController { return topViewController(base: selected) }
      if let presented = base?.presentedViewController { return topViewController(base: presented) }
      return base
  }

  @objc
  func signIn(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      
      guard let presenting = self.topViewController() else {
        reject("no_presenter", "Unable to find top view controller", nil)
        return
      }

      guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String, !clientID.isEmpty else {
        reject("missing_client_id", "GIDClientID is missing from Info.plist", nil)
        return
      }
      
      let config = GIDConfiguration(clientID: clientID)
      
      let scopes = ["openid", "email", "profile"]
      GIDSignIn.sharedInstance.signIn(withPresenting: presenting, hint: nil, additionalScopes: scopes) { signInResult, error in
        if let error = error {
          let ns = error as NSError
          if ns.domain == "com.google.GIDSignIn" && ns.code == -5 { // Canceled
            reject("canceled", "User canceled sign in", error)
            return
          }
          reject("signin_error", error.localizedDescription, error)
          return
        }
        
        guard let signInResult = signInResult else {
          reject("no_user", "No user found after sign in", nil)
          return
        }
        
        let user = signInResult.user
        let idToken = user.idToken?.tokenString ?? ""
        let accessToken = user.accessToken.tokenString
        
        let payload: [String: Any] = [
          "idToken": idToken.isEmpty ? NSNull() : idToken,
          "accessToken": accessToken,
          "user": [
            "id": user.userID ?? "",
            "email": user.profile?.email ?? "",
            "name": user.profile?.name ?? "",
            "givenName": user.profile?.givenName ?? "",
            "familyName": user.profile?.familyName ?? ""
          ]
        ]
        resolve(payload)
      }
    }
  }

  @objc
  func restorePreviousSignIn(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    GIDSignIn.sharedInstance.restorePreviousSignIn { user, error in
      if let error = error {
        reject("restore_error", error.localizedDescription, error)
        return
      }
      
      guard let user = user else {
        resolve(NSNull())
        return
      }
      
      let idToken = user.idToken?.tokenString ?? ""
      let accessToken = user.accessToken.tokenString
      
      let payload: [String: Any] = [
        "idToken": idToken.isEmpty ? NSNull() : idToken,
        "accessToken": accessToken,
        "user": [
          "id": user.userID ?? "",
          "email": user.profile?.email ?? "",
          "name": user.profile?.name ?? "",
          "givenName": user.profile?.givenName ?? "",
          "familyName": user.profile?.familyName ?? ""
        ]
      ]
      resolve(payload)
    }
  }

  @objc
  func signOut(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    GIDSignIn.sharedInstance.signOut()
    resolve(true)
  }

  @objc
  func revoke(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    GIDSignIn.sharedInstance.disconnect { error in
      if let error = error {
        reject("revoke_error", error.localizedDescription, error)
      } else {
        resolve(true)
      }
    }
  }
}
