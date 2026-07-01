export type CallHandlers = {
  onLocalStream?: (stream: any) => void;
  onRemoteStream?: (stream: any) => void;
  onState?: (state: string) => void;
  onEnded?: () => void;
};

export declare class CallManager {
  constructor(callId: string, isCaller: boolean, isVideo: boolean, handlers: CallHandlers);
  start(): Promise<void>;
  toggleMute(): boolean;
  toggleVideo(): boolean;
  switchCamera(): void;
  hangup(): void;
}
