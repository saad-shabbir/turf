// Over-the-air update timing, kept pure for tests.
export const UPDATE_CHECK_INTERVAL=15*60000;
export function shouldCheckForUpdate({now,lastCheck,enabled,dev,busy}:{now:number;lastCheck:number|null;enabled:boolean;dev:boolean;busy:boolean}){
 if(!enabled||dev||busy)return false;
 return lastCheck===null||now-lastCheck>=UPDATE_CHECK_INTERVAL||now<lastCheck;
}
// The "new version" banner never interrupts a workout or the camera. An update
// that is never restarted applies on the next app open.
export function showUpdateBanner({ready,workoutRunning,cameraOpen}:{ready:boolean;workoutRunning:boolean;cameraOpen:boolean}){
 return ready&&!workoutRunning&&!cameraOpen;
}
