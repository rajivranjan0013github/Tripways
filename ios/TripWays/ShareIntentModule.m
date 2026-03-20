#import <React/RCTBridgeModule.h>

@interface ShareIntentModule : NSObject <RCTBridgeModule>
@end

@implementation ShareIntentModule

// Expose this module to the React Native bridge
RCT_EXPORT_MODULE();

// Make it run on background thread
+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (NSString *)appGroupId {
    return @"group.com.thousandways.travel";
}

RCT_EXPORT_METHOD(getSharedUrl:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSUserDefaults *userDefaults = [[NSUserDefaults alloc] initWithSuiteName:[self appGroupId]];
    if (!userDefaults) {
        NSLog(@"ShareIntentModule: FATAL ERROR - Could not access App Group");
        resolve([NSNull null]);
        return;
    }
    
    NSString *url = [userDefaults stringForKey:@"sharedUrl"];
    NSLog(@"ShareIntentModule: Checked App Group for 'sharedUrl'. Result: %@", url ? url : @"nil");
    
    if (url) {
        resolve(url);
    } else {
        resolve([NSNull null]);
    }
}

RCT_EXPORT_METHOD(clearSharedUrl:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSUserDefaults *userDefaults = [[NSUserDefaults alloc] initWithSuiteName:[self appGroupId]];
    [userDefaults removeObjectForKey:@"sharedUrl"];
    [userDefaults synchronize];
    resolve(@(YES));
}

RCT_EXPORT_METHOD(setAppGroupData:(NSString *)userId
                  backendUrl:(NSString *)backendUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSUserDefaults *userDefaults = [[NSUserDefaults alloc] initWithSuiteName:[self appGroupId]];
    if (!userDefaults) {
        NSLog(@"ShareIntentModule: ERROR - Could not access App Group");
        resolve(@(NO));
        return;
    }
    
    [userDefaults setObject:userId forKey:@"userId"];
    [userDefaults setObject:backendUrl forKey:@"backendUrl"];
    [userDefaults synchronize];
    
    NSLog(@"ShareIntentModule: Saved userId='%@' backendUrl='%@' to App Group", userId, backendUrl);
    resolve(@(YES));
}

RCT_EXPORT_METHOD(setPremiumStatus:(BOOL)isPremium
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSUserDefaults *userDefaults = [[NSUserDefaults alloc] initWithSuiteName:[self appGroupId]];
    if (!userDefaults) {
        resolve(@(NO));
        return;
    }
    
    [userDefaults setBool:isPremium forKey:@"isPremium"];
    [userDefaults synchronize];
    
    NSLog(@"ShareIntentModule: Saved isPremium=%d to App Group", isPremium);
    resolve(@(YES));
}

@end
