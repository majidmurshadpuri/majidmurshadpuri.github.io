/* Shared poetry engine: finds poems by file name and decides Latest / New / Fresh labels (used by the Home, Poetry Section, My Poetry and Poetry I Love pages) */
/* ===== SITE CORE — finds poems by file name and decides Latest / New / Fresh labels (nothing to edit) ===== */
var MM=(function(){
  var DAY=864e5, NEW_DAYS=14, LATEST_DAYS=30;
  /* known poetry forms (the word used in the file name, its names in Urdu / Hindi, and what one "unit" is called) */
  var COUPLET={r:'couplets',u:'اشعار',h:'शेर'}, STANZA={r:'stanzas',u:'بند',h:'बंद'};
  var FORMS=[
    {k:'Ghazal',u:'غزل',h:'ग़ज़ल',pl:'Ghazals',unit:COUPLET},
    {k:'Nazm',u:'نظم',h:'नज़्म',pl:'Nazms',unit:STANZA},
    {k:'Rubai',u:'رباعی',h:'रुबाई',pl:'Rubais',unit:STANZA},
    {k:'Qita',u:'قطعہ',h:'क़ता',pl:'Qitas',unit:COUPLET},
    {k:'Sher',u:'شعر',h:'शेर',pl:'Shers',unit:COUPLET},
    {k:'Geet',u:'گیت',h:'गीत',pl:'Geets',unit:STANZA},
    {k:'Doha',u:'دوہا',h:'दोहा',pl:'Dohas',unit:COUPLET},
    {k:'Marsiya',u:'مرثیہ',h:'मर्सिया',pl:'Marsiyas',unit:STANZA},
    {k:'Naat',u:'نعت',h:'नात',pl:'Naats',unit:STANZA},
    {k:'Hamd',u:'حمد',h:'हम्द',pl:'Hamds',unit:STANZA}
  ];
  function camel(s){return String(s).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
  function formOf(list,k){for(var i=0;i<list.length;i++)if(list[i].k===k)return list[i];return {k:k,pl:camel(k)+'s',unit:STANZA}}
  function formName(f,L,plural){
    if(L==='u'&&f.u)return f.u; if(L==='h'&&f.h)return f.h;
    return plural?(f.pl||camel(f.k)+'s'):camel(f.k);
  }

  /* PoetryConfig.json (optional): {"poets":["TehzeebHafi"],"moreForms":["Masnavi"]} */
  var cfgP=null;
  function config(){
    if(cfgP)return cfgP;
    cfgP=fetch('PoetryConfig.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():{}}).catch(function(){return {}}).then(function(c){
      var forms=FORMS.slice(),poets=[];
      (c.moreForms||[]).forEach(function(k){if(/^[A-Z][A-Za-z]*$/.test(k)&&!forms.some(function(f){return f.k===k}))forms.push(formOf([],k))});
      (c.poets||[]).forEach(function(p){if(/^[A-Z][A-Za-z]*$/.test(p)&&poets.indexOf(p)<0)poets.push(p)});
      return {forms:forms,poets:poets};
    });
    return cfgP;
  }

  function stamp(j,lm){
    if(j&&typeof j.date==='string'){var t=Date.parse(j.date);if(t)return t}
    if(lm){var t2=Date.parse(lm);if(t2)return t2}
    return 0;
  }
  function fetchOne(url){
    return fetch(url,{cache:'no-cache'}).then(function(r){
      if(r.status===404)return {missing:true};
      if(!r.ok)return {neterr:true};
      var lm=r.headers.get('Last-Modified');
      return r.text().then(function(t){
        if(/^\s*</.test(t))return {missing:true};           /* a host that answers a web page for a missing file */
        var j;try{j=JSON.parse(t)}catch(x){return {bad:x.message}}
        return {j:j,ts:stamp(j,lm)};
      });
    }).catch(function(){return {neterr:true}});
  }

  /* poems of one kind of file name.  mine:  My<Form><n>.json   others:  <Poet><Form><n>.json
     Counts upward 1, 2, 3 … for each form until a number is missing. */
  function discover(poets,forms,mine){
    var combos=[];
    (mine?[null]:poets).forEach(function(p){forms.forEach(function(f){combos.push({p:p,f:f})})});
    var net=false;
    return Promise.all(combos.map(function(c){
      var out=[];
      function step(n){
        var ids=[];for(var k=0;k<4;k++)ids.push(n+k);
        return Promise.all(ids.map(function(i){
          var key=(mine?'':c.p)+c.f.k+i,url=(mine?'My':'')+(mine?'':c.p)+c.f.k+i+'.json';
          return fetchOne(url).then(function(r){r.key=key;r.url=url;r.n=i;return r});
        })).then(function(rs){
          for(var q=0;q<rs.length;q++){
            var r=rs[q];
            if(r.missing)return out;
            if(r.neterr){net=true;return out}
            out.push({key:r.key,url:r.url,n:r.n,poet:mine?null:c.p,form:c.f,j:r.j,ts:r.ts||0,broken:r.bad||null});
          }
          return n+4>400?out:step(n+4);
        });
      }
      return step(1);
    })).then(function(parts){var all=[].concat.apply([],parts);all.net=net;return all});
  }

  /* Latest = the newest one; New / Fresh = anything else added in the last 2 weeks (picked steadily by name) */
  function badges(list){
    var out={},t=list.filter(function(x){return x.ts}).sort(function(a,b){return b.ts-a.ts||b.n-a.n}),now=Date.now();
    if(!t.length)return out;
    if(now-t[0].ts<=LATEST_DAYS*DAY)out[t[0].key]='Latest';
    t.forEach(function(x,i){if(i&&now-x.ts<=NEW_DAYS*DAY)out[x.key]=hash(x.key)%2?'New':'Fresh'});
    return out;
  }
  function ymd(ts){var d=new Date(ts);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
  function lines(v){
    if(Array.isArray(v))return v.map(function(x){return String(x).trim()}).filter(Boolean);
    if(typeof v==='string')return v.split('|').map(function(x){return x.trim()}).filter(Boolean);
    return [];
  }
  function units(j){return j.couplets||j.stanzas||j.verses||j.bands||[]}
  function titleOf(j){                                     /* a plain-text title for lists and pop-ups */
    var t=j.title;if(t){var s=t.r||t.h||t.u;if(s)return s}
    var c=units(j)[0];if(!c)return 'Untitled';
    return lines(c.r)[0]||lines(c.h)[0]||lines(c.u)[0]||'Untitled';
  }

  /* the videos page keeps its list inside the page — read the dated entries from it */
  function videos(){
    return fetch('MyPoetryVideos.html',{cache:'no-cache'}).then(function(r){return r.ok?r.text():''}).catch(function(){return ''}).then(function(t){
      var m=/<script id="my-videos">([\s\S]*?)<\/script>/.exec(t);
      var s=(m?m[1]:'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|\s)\/\/[^\n]*/g,'$1');
      var rx=/\{[^{}]*?url\s*:\s*['"]([^'"]+)['"][^{}]*?\}/g,e,items=[];
      while((e=rx.exec(s))){
        if(/XXXXXXXX/.test(e[1]))continue;
        var d=/date\s*:\s*['"](\d{4}-\d{2}-\d{2})['"]/.exec(e[0]);
        items.push({url:e[1],short:/shorts\//.test(e[1]),ts:d?Date.parse(d[1]):0});
      }
      return items;
    });
  }

  /* one call that gathers everything (used by the home page and the Poetry Section page) */
  function scan(){
    return config().then(function(c){
      return Promise.all([discover(null,c.forms,true),discover(c.poets,c.forms,false),videos()]).then(function(r){
        return {cfg:c,mine:r[0],loved:r[1],vids:r[2]};
      });
    });
  }
  return {FORMS:FORMS,camel:camel,formOf:formOf,formName:formName,config:config,discover:discover,badges:badges,
          scan:scan,videos:videos,lines:lines,units:units,titleOf:titleOf,ymd:ymd,DAY:DAY,NEW_DAYS:NEW_DAYS,LATEST_DAYS:LATEST_DAYS,hash:hash};
})();

