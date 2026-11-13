/* Keeps what a visitor opens inside their own browser, so the site loads fast and still opens offline.
   Pages & data (html/json): fresh from the network first, saved copy if the network is slow or gone.
   Styles, scripts, fonts, images: saved copy instantly, refreshed quietly in the background. */
var V='mm-site-v1';
var CORE=['./','index.html','site.css','site.js','poetry.css','poetry.js','site-index.json','updates.json','PoetryConfig.json',
  'fonts/cormorant-garamond-latin-600-normal.woff2','fonts/cormorant-garamond-latin-700-normal.woff2','fonts/cormorant-garamond-latin-600-italic.woff2',
  'fonts/newsreader-latin-400-normal.woff2','fonts/newsreader-latin-400-italic.woff2','fonts/newsreader-latin-700-normal.woff2',
  'fonts/inter-latin-600-normal.woff2','fonts/inter-latin-700-normal.woff2'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(V).then(function(c){return Promise.all(CORE.map(function(u){return c.add(u).catch(function(){})}))}).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
function networkFirst(req){
  return new Promise(function(resolve){
    var done=false,timer=setTimeout(function(){caches.match(req,{ignoreSearch:false}).then(function(m){if(m&&!done){done=true;resolve(m)}})},3000);
    fetch(req).then(function(res){
      clearTimeout(timer);
      if(res&&res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(req,cp)})}
      if(!done){done=true;resolve(res)}
    }).catch(function(){
      clearTimeout(timer);
      caches.match(req).then(function(m){if(!done){done=true;resolve(m||new Response('You are offline, and this page has not been opened before.',{status:503,headers:{'Content-Type':'text/plain'}}))}});
    });
  });
}
function swr(req){
  return caches.match(req).then(function(m){
    var net=fetch(req).then(function(res){if(res&&res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(req,cp)})}return res}).catch(function(){return m});
    return m||net;
  });
}
self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET'||r.headers.has('range'))return;
  var u=new URL(r.url);
  if(u.origin!==location.origin)return;
  if(r.mode==='navigate'||/\.(html|json)$/i.test(u.pathname)||u.pathname.slice(-1)==='/'){e.respondWith(networkFirst(r))}
  else e.respondWith(swr(r));
});
