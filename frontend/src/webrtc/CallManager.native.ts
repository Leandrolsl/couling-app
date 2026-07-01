// Native WebRTC 1:1 call engine. Signaling over Supabase Realtime broadcast.
// Requires a dev build (react-native-webrtc is NOT available in Expo Go).
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";
import { supabase } from "@/src/lib/supabase";
import { ICE_SERVERS } from "./ice";

export type CallHandlers = {
  onLocalStream?: (stream: any) => void;
  onRemoteStream?: (stream: any) => void;
  onState?: (state: string) => void;
  onEnded?: () => void;
};

export class CallManager {
  private pc: any = null;
  private localStream: any = null;
  private channel: any = null;
  private pendingIce: any[] = [];
  private remoteSet = false;
  private offered = false;
  private ended = false;

  constructor(
    private callId: string,
    private isCaller: boolean,
    private isVideo: boolean,
    private h: CallHandlers,
  ) {}

  async start() {
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: this.isVideo ? { facingMode: "user" } : false,
    });
    this.h.onLocalStream?.(this.localStream);

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream.getTracks().forEach((t: any) => this.pc.addTrack(t, this.localStream));

    this.pc.addEventListener("track", (e: any) => {
      if (e.streams && e.streams[0]) this.h.onRemoteStream?.(e.streams[0]);
    });
    this.pc.addEventListener("icecandidate", (e: any) => {
      if (e.candidate) this.send("ice", { candidate: e.candidate });
    });
    this.pc.addEventListener("connectionstatechange", () => {
      this.h.onState?.(this.pc.connectionState);
    });

    this.channel = supabase.channel(`call:${this.callId}`, {
      config: { broadcast: { self: false } },
    });
    this.channel.on("broadcast", { event: "signal" }, ({ payload }: any) => this.onSignal(payload));
    await new Promise<void>((resolve) => {
      this.channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });

    this.send(this.isCaller ? "ready-caller" : "ready-callee", {});
  }

  private send(kind: string, data: any) {
    this.channel?.send({ type: "broadcast", event: "signal", payload: { kind, ...data } });
  }

  private async onSignal(p: any) {
    if (this.ended || !p) return;
    try {
      if (p.kind === "ready-callee" && this.isCaller) {
        await this.makeOffer();
      } else if (p.kind === "ready-caller" && !this.isCaller) {
        this.send("ready-callee", {});
      } else if (p.kind === "offer" && !this.isCaller) {
        await this.onOffer(p.sdp);
      } else if (p.kind === "answer" && this.isCaller) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        this.remoteSet = true;
        this.flushIce();
      } else if (p.kind === "ice") {
        await this.addIce(p.candidate);
      } else if (p.kind === "bye") {
        this.h.onEnded?.();
        this.cleanup();
      }
    } catch (e) {
      // swallow signaling errors; user can hang up
    }
  }

  private async makeOffer() {
    if (this.offered) return;
    this.offered = true;
    const offer = await this.pc.createOffer({});
    await this.pc.setLocalDescription(offer);
    this.send("offer", { sdp: offer });
  }

  private async onOffer(sdp: any) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.remoteSet = true;
    this.flushIce();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.send("answer", { sdp: answer });
  }

  private async addIce(candidate: any) {
    if (!this.remoteSet) {
      this.pendingIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }

  private flushIce() {
    this.pendingIce.forEach((c) => this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
    this.pendingIce = [];
  }

  toggleMute(): boolean {
    const t = this.localStream?.getAudioTracks?.()[0];
    if (t) {
      t.enabled = !t.enabled;
      return !t.enabled; // returns muted state
    }
    return false;
  }

  toggleVideo(): boolean {
    const t = this.localStream?.getVideoTracks?.()[0];
    if (t) {
      t.enabled = !t.enabled;
      return !t.enabled; // returns videoOff state
    }
    return false;
  }

  switchCamera() {
    const t = this.localStream?.getVideoTracks?.()[0];
    if (t && typeof t._switchCamera === "function") t._switchCamera();
  }

  hangup() {
    if (this.ended) return;
    this.send("bye", {});
    this.cleanup();
  }

  private cleanup() {
    this.ended = true;
    try { this.localStream?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    try { this.pc?.close(); } catch {}
    try { if (this.channel) supabase.removeChannel(this.channel); } catch {}
  }
}
