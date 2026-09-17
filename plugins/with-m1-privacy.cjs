const { withInfoPlist } = require("expo/config-plugins");
module.exports = (config) =>
  withInfoPlist(config, (config) => {
    // TaskManager's automatic plugin adds fetch. M1 only uses geofencing.
    config.modResults.UIBackgroundModes = ["location"];
    delete config.modResults.NSFaceIDUsageDescription;
    delete config.modResults.NSMotionUsageDescription;
    config.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
    };
    return config;
  });
