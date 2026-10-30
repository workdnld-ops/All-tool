const COOKIE = '__Host-toolbox-session';
export const SESSION_SECONDS = 180 * 24 * 60 * 60;
const encoder = new TextEncoder();
const failures = new Map();
const escape = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode = text => Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0));

export function safeReturn(value, origin) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value)) return '/';
  try {
    const url = new URL(value,origin);
    if (url.origin !== origin || /^\/(?:login|logout|_auth)(?:\/|$)/.test(url.pathname)) return '/';
    return url.pathname+url.search+url.hash;
  } catch { return '/'; }
}
function configured(env) {
  return typeof env.TOOLBOX_PASSWORD === 'string' && env.TOOLBOX_PASSWORD.length >= 8 && typeof env.TOOLBOX_SESSION_SECRET === 'string' && env.TOOLBOX_SESSION_SECRET.length >= 32;
}
async function key(env) {
  // Rotating either secret invalidates every existing device session.
  const raw = await crypto.subtle.digest('SHA-256',encoder.encode(`${env.TOOLBOX_SESSION_SECRET}\0${env.TOOLBOX_PASSWORD}`));
  return crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function issueSession(env, origin, now = Date.now()) {
  const issued = Math.floor(now/1000);
  const payload = encode(encoder.encode(JSON.stringify({v:1,iat:issued,exp:issued+SESSION_SECONDS,aud:origin,nonce:crypto.randomUUID()})));
  const signature = encode(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(payload)));
  return `${payload}.${signature}`;
}
export async function hasSession(request, env, now = Date.now()) {
  if (!configured(env)) return false;
  const token = (request.headers.get('cookie') || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if (!token || token.length > 2048) return false;
  try {
    const [payload,signature,extra] = token.split('.');
    if (!payload || !signature || extra !== undefined || !/^[\w-]+$/.test(payload+signature)) return false;
    if (!await crypto.subtle.verify('HMAC',await key(env),decode(signature),encoder.encode(payload))) return false;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    const seconds = Math.floor(now/1000);
    return data.v === 1 && data.aud === new URL(request.url).origin && Number.isInteger(data.iat) && Number.isInteger(data.exp) && data.iat <= seconds+60 && data.exp > seconds && data.exp-data.iat === SESSION_SECONDS;
  } catch { return false; }
}
function cookie(token, seconds = SESSION_SECONDS) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
}
function secured(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','private, no-store, max-age=0');
  headers.set('CDN-Cache-Control','no-store');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','same-origin');
  headers.set('Vary','Cookie');
  return new Response(response.body,{status:response.status,headers});
}
function redirect(location, token) {
  return secured(new Response(null,{status:303,headers:{Location:location,...(token === undefined ? {} : {'Set-Cookie':cookie(token,token ? SESSION_SECONDS : 0)})}}));
}
function screen({title = '庶務工具',message = '',next = '/',logout = false,status = 200} = {}) {
  const form = logout ? '<form method="post" action="/logout"><button type="submit">登出此裝置</button><a href="/">取消</a></form>' : `<form method="post" action="/login"><input type="hidden" name="next" value="${escape(next)}"><label for="password">密碼</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><p class="note">此瀏覽器記住登入 180 天</p><button type="submit">登入</button></form>`;
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#1f6f64"><title>${escape(title)}</title><link rel="icon" href="/assets/toolbox-icon.svg"><style>*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#1d252c;font-family:system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{width:min(360px,100%)}img{width:48px;height:48px}h1{font-size:26px;margin:18px 0 28px}label{display:block;margin:0 0 8px;font-weight:600}input,button{width:100%;min-height:46px;border-radius:6px;font:inherit;font-size:16px}input{border:1px solid #aebbc1;padding:10px;background:#fff}button{border:0;background:#1f6f64;color:#fff;font-weight:600;cursor:pointer}a{display:block;text-align:center;margin-top:18px;color:#245b9b}.note{font-size:13px;color:#5c6b75;margin:12px 0 20px}.error{color:#a52532;line-height:1.6}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #c98a28;outline-offset:3px}</style></head><body><main><img src="/assets/toolbox-icon.svg" alt=""><h1>${escape(title)}</h1>${message ? `<p class="error" role="alert">${escape(message)}</p>` : ''}${status === 503 ? '' : form}</main></body></html>`;
  return secured(new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}}));
}
async function readForm(request) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw Error('invalid form');
  const reader = request.body?.getReader();
  if (!reader) throw Error('missing body');
  let length = 0, body = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 8192) { await reader.cancel(); throw Error('too large'); }
      body += decoder.decode(value,{stream:true});
    }
    return new URLSearchParams(body+decoder.decode());
  } finally { reader.releaseLock(); }
}
async function equalPassword(input, expected) {
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(input)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(expected)));
  return a.reduce((difference,value,index)=>difference | (value ^ b[index]),0) === 0;
}
// Network-only workers replace legacy offline page caches; localStorage/IndexedDB are untouched.
const worker = `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).map(name=>caches.delete(name)));await self.clients.claim();})()));`;
const client = `(()=>{let checking=false;async function check(){if(checking||document.hidden)return;checking=true;try{const r=await fetch('/_auth/session',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)location.replace('/login?next='+encodeURIComponent(location.pathname+location.search));}catch{location.replace('/login?next='+encodeURIComponent(location.pathname+location.search));}finally{checking=false;}}addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);addEventListener('storage',e=>{if(e.key==='toolbox-logout')check();});setInterval(check,300000);})();`;

export async function protectToolbox(context, {now = Date.now(), attempts = failures} = {}) {
  const {request,env} = context, url = new URL(request.url), path = url.pathname;
  if (request.method === 'GET' && (path === '/assets/toolbox-icon.svg' || path === '/manifest.json')) return context.next();
  if (request.method === 'GET' && (request.headers.get('service-worker') === 'script' || /\/(?:sw|service-worker)\.js$/.test(path))) return secured(new Response(worker,{headers:{'Content-Type':'text/javascript; charset=utf-8'}}));
  if (request.method === 'GET' && path === '/_auth/client.js') return secured(new Response(client,{headers:{'Content-Type':'text/javascript; charset=utf-8'}}));
  if (!configured(env)) return screen({title:'登入服務尚未設定',message:'請管理者完成 Cloudflare 登入密鑰設定。',status:503});
  const authenticated = await hasSession(request,env,now);
  if (path === '/_auth/session') return secured(Response.json({authenticated},{status:authenticated ? 200 : 401}));
  if (path === '/login' || path === '/logout') {
    const next = safeReturn(url.searchParams.get('next'),url.origin);
    if (request.method === 'GET') return path === '/logout' ? screen({title:'登出此裝置',logout:true}) : authenticated ? redirect(next) : screen({next});
    if (request.method !== 'POST') return secured(new Response('Method not allowed',{status:405,headers:{Allow:'GET, POST'}}));
    if (request.headers.get('origin') !== url.origin) return secured(new Response('Forbidden',{status:403}));
    if (path === '/logout') return redirect('/login','');
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const prior = attempts.get(ip);
    if (prior?.until > now && prior.count >= 10) return screen({message:'嘗試次數過多，請 5 分鐘後再試。',status:429,next});
    let form;
    try { form = await readForm(request); } catch { return screen({message:'登入資料格式不正確。',status:400,next}); }
    const target = safeReturn(form.get('next'),url.origin), password = form.get('password') || '';
    if (password.length > 256 || !await equalPassword(password,env.TOOLBOX_PASSWORD)) {
      if (attempts.size >= 2000) attempts.delete(attempts.keys().next().value);
      attempts.set(ip,{count:prior?.until > now ? prior.count+1 : 1,until:prior?.until > now ? prior.until : now+300000});
      return screen({message:'密碼不正確，請再試一次。',status:401,next:target});
    }
    attempts.delete(ip);
    return redirect(target,await issueSession(env,url.origin,now));
  }
  if (!authenticated) {
    if (request.method === 'GET' && (request.headers.get('accept')?.includes('text/html') || path === '/' || path.endsWith('.html') || path.endsWith('/'))) return redirect('/login?next='+encodeURIComponent(safeReturn(path+url.search,url.origin)));
    return secured(Response.json({error:'請先登入庶務工具',login:'/login'},{status:401}));
  }
  const response = await context.next();
  if (response.headers.get('content-type')?.includes('text/html')) {
    const html = (await response.text()).replace(/<head\b[^>]*>/i,match=>`${match}<script src="/_auth/client.js"></script>`);
    const headers = new Headers(response.headers); headers.delete('content-length'); headers.delete('content-encoding'); headers.delete('etag');
    return secured(new Response(html,{status:response.status,headers}));
  }
  return secured(response);
}
