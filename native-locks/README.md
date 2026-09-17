Podfile.lock was captured from the real macos-26 build of commit 9d8e7b8,
Actions run 35183366492. Xcode compilation passed; the artifact scanner then
failed on a harmless dependency string. The lock contains only dependency
versions, local pod paths and checksums. Native resolution used CocoaPods 1.17.0;
the script now explicitly invokes that version and enforces --deployment.
Do not upload Pods or DerivedData.
