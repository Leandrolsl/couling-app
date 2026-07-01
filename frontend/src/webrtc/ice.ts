// Free public STUN servers. For reliable connectivity on mobile/4G networks,
// add a TURN server here (e.g. from Metered/Twilio):
//   { urls: "turn:...", username: "...", credential: "..." }
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];
