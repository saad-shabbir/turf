The first macOS resolution has not run. No Podfile.lock is fabricated here.
After the first successful native generation, review ios/Podfile.lock and copy it
here as Podfile.lock before subsequent reproducible builds. The build script
then uses pod install --deployment. Do not upload Pods or DerivedData.
