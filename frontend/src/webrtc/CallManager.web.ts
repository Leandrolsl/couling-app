// Web stub — real 1:1 calling is native-only (react-native-webrtc requires a dev build).
export type CallHandlers = {
  onLocalStream?: (stream: any) => void;
  onRemoteStream?: (stream: any) => void;
  onState?: (state: string) => void;
  onEnded?: () => void;
};

export class CallManager {
  constructor(
    _callId: string,
    _isCaller: boolean,
    _isVideo: boolean,
    private h: CallHandlers,
  ) {}
  async start() {
    this.h.onState?.("unsupported");
  }
  toggleMute() { return false; }
  toggleVideo() { return false; }
  switchCamera() {}
  hangup() { this.h.onEnded?.(); }
}
