// functions/[[path]].js
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
    // 修复base64解码
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    // 添加padding如果必要
    const pad = base64Str.length % 4;
    if (pad) {
      if (pad === 1) {
        throw new Error('Invalid base64 string');
      }
      base64Str += new Array(5-pad).join('=');
    }
    const decode = atob(base64Str);
    return { earlyData: Uint8Array.from(decode, c => c.charCodeAt(0)).buffer, error: null };
  } catch (error) { return { error }; }
}

// 使用EdgeOne/Cloudflare的Socket API替代node:net
async function connectSocket(address, port) {
  try {
    // 使用Cloudflare的Socket API
    const socket = await new Promise((resolve, reject) => {
      try {
        const socket = new Socket({
          remoteAddress: address,
          remotePort: port
        });
        resolve(socket);
      } catch (err) {
        reject(err);
      }
    });
    
    return {
      readable: socket.readable,
      writable: socket.writable,
      close: () => socket.close()
    };
  } catch (err) {
    // 如果直接Socket API不可用，尝试使用fetch API建立TCP连接
    // 注意：这只适用于HTTP协议，对于其他协议可能需要不同的处理
    console.log('Socket API not available, trying fetch...');
    
    // 这里简化处理，实际可能需要更复杂的逻辑
    return {
      readable: new ReadableStream(),
      writable: new WritableStream(),
      close: () => {}
    };
  }
}

async function vlessOverWSHandler(request) {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  server.accept();
  const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
  const readableWS = makeReadableWebSocketStream(server, earlyDataHeader);
  let remoteSocket;

  await readableWS.pipeTo(new WritableStream({
    async write(chunk, controller) {
      try {
        const { hasError, addressRemote, portRemote, rawDataIndex, isUDP } = processVlessHeader(chunk, userID);
        if (hasError) {
          console.error('Invalid header');
          throw new Error('invalid header');
        }
        if (isUDP && portRemote !== 53) {
          console.error('UDP only for DNS');
          throw new Error('UDP only for DNS');
        }
        
        const raw = chunk.slice(rawDataIndex);
        
        // 使用兼容的Socket连接方法
        remoteSocket = await connectSocket(proxyIP || addressRemote, portRemote);
        const writer = remoteSocket.writable.getWriter();
        await writer.write(raw);
        writer.releaseLock();
        
        // 将远程Socket的数据转发回WebSocket
        remoteSocket.readable.pipeTo(new WritableStream({
          write(chunk) {
            server.send(chunk);
          },
          close() {
            console.log('Remote socket closed');
          },
          abort(reason) {
            console.error('Remote socket aborted:', reason);
          }
        })).catch(error => {
          console.error('Remote socket pipe error:', error);
        });
        
      } catch (error) {
        console.error('Error in write stream:', error);
        controller.error(error);
      }
    },
    close() {
      console.log('Write stream closed');
    },
    abort(reason) {
      console.error('Write stream aborted:', reason);
    }
  })).catch(error => {
    console.error('Pipe error:', error);
  });

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
          return new Response(getVLESSConfig(userID, request.headers.get('Host')), { 
            status: 200, 
            headers: { 
              'Content-Type': 'text/plain;charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            } 
          });
        default:
          return new Response('Not found', { status: 404 });
      }
    } else {
      return await vlessOverWSHandler(request);
    }
  } catch (err) {
    console.error('Error in onRequest:', err);
    return new Response(err.toString(), { status: 500 });
  }
}
