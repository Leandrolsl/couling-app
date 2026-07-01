// Route wrapper — delegates to a platform-specific CallStage:
//   CallStage.native.tsx = real WebRTC (dev build only)
//   CallStage.web.tsx     = "use the mobile app" notice
import CallStage from "@/src/webrtc/CallStage";
export default CallStage;
