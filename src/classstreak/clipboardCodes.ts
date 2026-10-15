import * as Clipboard from "expo-clipboard";
// Only call this from a user tap: iOS shows a paste prompt whenever the app reads the clipboard.
export async function pastedCodes(){
 const text=await Clipboard.getStringAsync();return {invite_code:text.match(/(?:ClassStreak:\s*|\/j\/)([A-Z0-9]{12})(?:\b|$)/i)?.[1]?.toUpperCase(),studio_code:text.match(/(?:ClassStreak studio:\s*|\/s\/)([0-9a-f-]{36})(?:\b|$)/i)?.[1]};
}
