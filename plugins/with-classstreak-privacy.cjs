const {withInfoPlist,withEntitlementsPlist}=require('expo/config-plugins');
module.exports=config=>withEntitlementsPlist(withInfoPlist(config,mod=>{
 mod.modResults.UIBackgroundModes=['location'];
 delete mod.modResults.NSFaceIDUsageDescription;
 delete mod.modResults.NSMotionUsageDescription;
 mod.modResults.NSAppTransportSecurity={NSAllowsArbitraryLoads:false};
 mod.modResults.NSHealthShareUsageDescription='Match workout times from Apple Health to your recorded studio visits. ClassStreak never writes to Health.';
 return mod;
}),mod=>{delete mod.modResults['aps-environment'];mod.modResults['com.apple.developer.healthkit']=true;return mod;});
