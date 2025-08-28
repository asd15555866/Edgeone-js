// functions/[[path]].js
import { createConnection } from 'node:net';

let userID = 'f455bd7c-27ca-4195-a371-119e5ca4c94b';
let proxyIP = 'cdn-all.xn--b6gac.eu.org';

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function stringify(arr, offset = 0) {
  const byteToHex = [];
  for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
  const uuid = Array.from(new Uint8Array(arr.buffer || arr), (v, i) => byteToHex[arr[i + offset]]).join('');
  if (!isValidUUID(uuid)) throw new TypeError('Invalid UUID');
  return uuid;
}

function processVlessHeader(buffer, userID) {
  if (buffer.byteLength < 24) return { hasError: true, message: 'invalid data' };
  const dv = new DataView(buffer);
  const uuid = stringify(new Uint8Array(buffer, 1, 16));
  if (uuid !== userID) return { hasError: true, message: 'invalid user' };
  const optLen = dv.getUint8(17);
  const command = dv.getUint8(18 + optLen);
  const port = dv.getUint16(18 + optLen + 1);
  const addrType = dv.getUint8(18 + optLen + 3);
  let addr;
  let addrLen;
  let addrOffset = 18 + optLen + 4;
  switch (addrType) {
    case 1: addrLen = 4; addr = Array.from(new Uint8Array(buffer, addrOffset, addrLen)).join('.'); break;
    case 3: addrLen = dv.getUint8(addrOffset); addr = new TextDecoder().decode(new Uint8Array(buffer, addrOffset + 1, addrLen)); break;
    case 4: addrLen = 16; addr = Array.from(new Uint8Array(buffer, addrOffset, 16)).map((v, i) => (i % 2 ? ':' : '') + v.toString(16).padStart(2, '0')).join('').slice(1); break;
    default: return { hasError: true, message: 'invalid address type' };
  }
  const raw = addrOffset + addrLen + (addrType === 3 ? 1 : 0);
  return { hasError: false, addressRemote: addr, portRemote: port, rawDataIndex: raw, isUDP: command === 2 };
}

function makeReadableWebSocketStream(ws, earlyDataHeader) {
  let cancel = false;
  return new ReadableStream({
    start(controller) {
      if (earlyDataHeader) {
        const { earlyData } = base64ToArrayBuffer(earlyDataHeader);
        if (earlyData) controller.enqueue(earlyData);
      }
      ws.addEventListener('message', e => !cancel && controller.enqueue(e.data));
      ws.addEventListener('close', () => !cancel && controller.close());
      ws.addEventListener('error', e => controller.error(e));
    },
    cancel() { cancel = true; ws.close(); }
  });
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { error: null };
  try {
    const decode = atob(base64Str.replace(/-/g, '+').replace(/_/g, '/'));
    return { earlyData: Uint8Array.from(decode, c => c.charCodeAt(0)).buffer, error: null };
  } catch (error) { return { error }; }
}

async function vlessOverWSHandler(request) {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  server.accept();
  const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
  const readableWS = makeReadableWebSocketStream(server, earlyDataHeader);
  let remoteSocket;

  readableWS.pipeTo(new WritableStream({
    async write(chunk, controller) {
      const { hasError, addressRemote, portRemote, rawDataIndex, isUDP } = processVlessHeader(chunk, userID);
      if (hasError) throw new Error('invalid header');
      if (isUDP && portRemote !== 53) throw new Error('UDP only for DNS');
      const raw = chunk.slice(rawDataIndex);
      remoteSocket = createConnection({ host: proxyIP || addressRemote, port: portRemote });
      const writer = remoteSocket.writable.getWriter();
      await writer.write(raw);
      writer.releaseLock();
    }
  }));

  if (remoteSocket) {
    remoteSocket.readable.pipeTo(new WritableStream({
      write(chunk) { server.send(chunk); }
    }));
  }

  return new Response(null, { status: 101, webSocket: client });
}

function getVLESSConfig(userID, hostName) {
  return `vless://${userID}@${hostName}:443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=/?ed=2048#${hostName}`;
}

export async function onRequest(context) {
  const { request } = context;
  const env = context.env;
  userID = env.UUID || userID;
  proxyIP = env.PROXYIP || proxyIP;

  try {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      const url = new URL(request.url);
      switch (url.pathname) {
        case '/':
          return new Response(JSON.stringify(request.cf), { status: 200 });
        case `/${userID}`:
          return new Response(getVLESSConfig(userID, request.headers.get('Host')), { status: 200, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        default:
          return new Response('Not found', { status: 404 });
      }
    } else {
      return await vlessOverWSHandler(request);
    }
  } catch (err) {
    return new Response(err.toString(), { status: 500 });
  }
}
