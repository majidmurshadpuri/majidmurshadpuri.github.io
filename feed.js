/* Home page: first-visit welcome, "lately" feed (poems, videos, apps, pages…), returning-visitor hello.
   Nothing to edit here — the feed finds new things by itself:
   · poems & videos  → found by file name (poetry.js)
   · cards you add on the Maths / English / Apps pages → read straight from those pages
   · any page listed in site-index.json, and notes in updates.json
   Everything the visitor loads is also kept in their browser (localStorage + sw.js) so the site opens fast and works offline. */
(function(){
  'use strict';
  var DAY=864e5, NOW=Date.now();
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function jget(k,d){try{var v=JSON.parse(lsGet(k));return v==null?d:v}catch(e){return d}}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function norm(h){try{return decodeURIComponent(String(h)).replace(/^\.\//,'').split('#')[0].toLowerCase()}catch(e){return String(h).toLowerCase()}}
  function pick(a,seed){return a[Math.abs(seed|0)%a.length]}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
  function dts(d){if(!d)return 0;var t=Date.parse(d);return isNaN(t)?0:t}
  function strip(s){return String(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}

  /* ============== what the visitor has already seen (kept in their browser) ============== */
  var seen=jget('mm_seen',null);          /* null → first visit */
  var lastVisit=+lsGet('mm_last')||0;
  var firstVisit=!lsGet('mm_first');

  /* ============== word banks for the speech ============== */
  var KIND={
    own:{ico:'✍️',tag:'my poetry'}, loved:{ico:'💛',tag:'a poem I love'}, video:{ico:'🎬',tag:'poetry video'},
    app:{ico:'🧰',tag:'tools & apps'}, maths:{ico:'🧮',tag:'maths'}, english:{ico:'📝',tag:'english'},
    page:{ico:'📄',tag:'new page'}, note:{ico:'🕯️',tag:'a note from me'}, section:{ico:'🚪',tag:'a room'}
  };
  function say(it,old){
    var s=hash(it.href+it.title), t=it.title, f=(it.form||'poem').toLowerCase(), q=it.first?'“'+it.first+'”':'';
    var D=it.desc?(' '+it.desc):'';
    switch(it.kind){
      case 'own': return old?
        pick(['A '+f+' of mine you may have missed: '+q,'Still one of my favourites to read aloud — '+q],s):
        pick(['I just wrote a new '+f+' — it begins '+q,'A new '+f+' came out of me, and I wanted you to hear it first: '+q,'Fresh from my notebook, a '+f+': '+q],s);
      case 'loved': return old?
        pick(['A '+f+' by '+it.poet+' that I keep returning to: '+q,'If you haven’t read this one by '+it.poet+', sit with it: '+q],s):
        pick(['I fell in love with this '+f+' by '+it.poet+' and had to share it with you: '+q,'Someone else’s words, but I wish I’d written them — '+it.poet+': '+q,'Today I’m sharing a '+f+' I love, by '+it.poet+': '+q],s);
      case 'video': return it.short?
        pick(['A little poetry short, just for you — press play.','I recorded a short one for you. Less than a minute, I promise.'],s):
        pick(['I recorded a new poetry video — come and listen.','My voice, my poem, one more video for the shelf. Hope you like it.'],s);
      case 'app': return pick(['I built something new: '+t+'.'+D,'A new tool is ready in my studio — '+t+'.'+D,'Made this with chai and stubbornness: '+t+'.'+D],s);
      case 'maths': return pick(['For my students: '+t+'.'+D,'New in the maths room — '+t+'.'+D,'Dear students, I’ve added '+t+'.'+D],s);
      case 'english': return pick(['New in the English room — '+t+'.'+D,'I’ve put together '+t+' for you.'+D,'Study material, freshly written: '+t+'.'+D],s);
      case 'section': return pick(['I’ve been tidying up '+t+' — come and look around.','Something changed in '+t+'. Have a look.'],s);
      case 'note': return it.text;
      default: return pick(['I added a new page: '+t+'.'+D,'There’s a new door in my corner: '+t+'.'+D],s);
    }
  }
  function ago(ts){
    var d=Math.floor((NOW-ts)/DAY);
    if(d<=0)return 'today'; if(d===1)return 'yesterday'; if(d<7)return d+' days ago';
    if(d<14)return 'a week ago'; if(d<30)return Math.floor(d/7)+' weeks ago';
    return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  }

  /* ============== collecting everything ============== */
  function getJSON(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){return null})}
  function getText(u){return fetch(u,{cache:'no-cache'}).then(function(r){return r.ok?r.text():''}).catch(function(){return ''})}

  var HUBS=[{href:'apps.html',kind:'app'},{href:'MathsPracticeLibrary.html',kind:'maths'},{href:'English Study Material.html',kind:'english'}];
  function crawl(h){
    return getText(h.href).then(function(t){
      if(!t)return [];
      var doc=new DOMParser().parseFromString(t,'text/html'),out=[];
      [].forEach.call(doc.querySelectorAll('.note'),function(n){
        var a=n.querySelector('a[href]'); if(!a)return;
        var href=a.getAttribute('href'); if(!href||href.charAt(0)==='#')return;
        var h3=n.querySelector('h3'),p=n.querySelector('p:not(.count)');
        out.push({kind:h.kind,href:href,title:strip(h3&&h3.textContent),desc:strip(p&&p.textContent),
                  ts:dts(n.getAttribute('data-updated')||n.getAttribute('data-added')),fresh:!!n.getAttribute('data-added')});
      });
      return out;
    });
  }
  function poems(){
    if(!window.MM)return Promise.resolve([]);
    return MM.scan().then(function(r){
      var out=[];
      r.mine.forEach(function(x){if(x.broken)return;out.push({kind:'own',href:'MyPoetry.html#'+x.key,title:MM.titleOf(x.j),first:MM.titleOf(x.j),form:MM.formName?MM.formName(x.form,'r'):x.form.k,ts:x.ts})});
      r.loved.forEach(function(x){if(x.broken)return;var p=(x.j&&x.j.poet&&(x.j.poet.r||x.j.poet.h||x.j.poet.u))||MM.camel(x.poet);
        out.push({kind:'loved',href:'LovedPoetry.html#'+x.key,title:MM.titleOf(x.j),first:MM.titleOf(x.j),form:MM.formName?MM.formName(x.form,'r'):x.form.k,poet:p,ts:x.ts})});
      r.vids.forEach(function(v,i){out.push({kind:'video',href:'MyPoetryVideos.html',title:'Poetry video '+(i+1),short:v.short,ts:v.ts})});
      return out;
    }).catch(function(){return []});
  }
  function collect(){
    return Promise.all([getJSON('site-index.json'),getJSON('updates.json'),poems(),Promise.all(HUBS.map(crawl))]).then(function(r){
      var idx=(r[0]&&r[0].pages)||[],ups=Array.isArray(r[1])?r[1]:[],map={},list=[];
      function add(it){var k=norm(it.href)+'|'+it.kind;
        if(it.kind==='own'||it.kind==='loved'||it.kind==='video'||it.kind==='note'){list.push(it);return}
        var m=map[norm(it.href)];
        if(m){['title','desc'].forEach(function(f){if(!m[f]&&it[f])m[f]=it[f]});if(it.ts&&!m.ts)m.ts=it.ts;if(it.fresh)m.fresh=true;return}
        map[norm(it.href)]=it;list.push(it)}
      r[3].forEach(function(c){c.forEach(add)});                                   /* cards on the hub pages */
      idx.forEach(function(p){                                                      /* site-index.json (every page of the site) */
        if(!p.href||/^(index|MyResume)\.html$/i.test(p.href))return;
        var k={maths:'maths',english:'english',apps:'app',poetry:'page',section:'section'}[p.kind||p.section]||'page';
        var ts=dts(p.updated)||dts(p.added),fresh=!!p.added&&(!p.updated||dts(p.updated)-dts(p.added)<2*DAY);
        add({kind:k,href:p.href,title:p.title,desc:p.desc,ts:ts,fresh:fresh});
        var m=map[norm(p.href)]; if(m&&ts&&(!m.ts||ts>m.ts)){m.ts=ts;m.fresh=fresh}
      });
      ups.forEach(function(u){if(u&&u.text)add({kind:'note',href:u.href||'#',title:u.title||'A note',text:u.text,ts:dts(u.date)})});
      r[2].forEach(add);
      return list;
    });
  }

  /* ============== drawing ============== */
  var feedEl=document.getElementById('feed'),allEl=document.getElementById('allList'),introEl=document.getElementById('feedIntro');
  function card(it){
    var old=it.ts&&(NOW-it.ts)>60*DAY, isNewToYou=seen&&!seen[norm(it.href)+'|'+it.kind]&&it.kind!=='note';
    var K=KIND[it.kind]||KIND.page, label=it.kind==='note'?'':(it.fresh?'new':(it.ts?'updated':'')), href=it.href&&it.href!=='#'?it.href:'';
    var h3=it.kind==='note'?'':'<h3>'+esc(it.kind==='own'||it.kind==='loved'?(it.form||'poem').replace(/^./,function(c){return c.toUpperCase()})+(it.poet?' · '+it.poet:''):it.title)+'</h3>';
    return '<article class="fc">'+(isNewToYou?'<span class="fc-badge">new for you</span>':(label&&!old?'<span class="fc-badge soft">'+label+'</span>':''))+
      '<div class="fc-top"><span class="fc-ico">'+K.ico+'</span><span class="fc-tag">'+esc(K.tag)+'</span>'+(it.ts?'<span class="fc-when">'+ago(it.ts)+'</span>':'')+'</div>'+
      h3+'<p class="fc-say">'+esc(say(it,old))+'</p>'+
      (href?'<a class="fc-go" href="'+esc(href)+'">'+(it.kind==='video'?'press play':it.kind==='note'?'take me there':'read it · open it')+' →</a>':'')+'</article>';
  }
  function draw(list){
    var dated=list.filter(function(x){return x.ts}).sort(function(a,b){return b.ts-a.ts});
    var recent=dated.filter(function(x){return NOW-x.ts<=90*DAY});
    var show=recent.length>=4?recent:dated.slice(0,Math.max(4,recent.length));
    show=show.slice(0,12);
    if(!show.length){feedEl.innerHTML='<p class="fc-empty">I’m still unpacking boxes in here. Check back soon — I’ll tell you the moment something new lands.</p>'}
    else feedEl.innerHTML=show.map(card).join('');
    if(introEl){
      introEl.textContent=dated.length?('The last thing I added was '+ago(dated[0].ts)+'. Here’s what I’ve been up to, newest first.'):'Here’s what’s in my corner right now.';
    }
    /* everything, grouped */
    var groups={own:'My poetry',loved:'Poems I love',video:'Poetry videos',maths:'Maths',english:'English',app:'Tools & apps',page:'More pages',section:'More pages'},order=['own','loved','video','maths','english','app','page','section'],html='';
    order.forEach(function(k){
      var xs=list.filter(function(x){return x.kind===k&&x.href&&x.href!=='#'});
      if(!xs.length||(k==='section'))return;
      if(k==='page')xs=xs.concat(list.filter(function(x){return x.kind==='section'&&x.href}));
      html+='<h4>'+groups[k]+' <small>'+xs.length+'</small></h4><div class="chips">'+xs.map(function(x){
        var lbl=x.kind==='own'||x.kind==='loved'?(x.first||x.title):x.title;
        return '<a href="'+esc(x.href)+'">'+esc(lbl)+'</a>'}).join('')+'</div>';
    });
    if(allEl)allEl.innerHTML=html||'<p class="fc-empty">Nothing to list yet.</p>';
    /* remember what this visitor has seen */
    var s={};list.forEach(function(x){s[norm(x.href)+'|'+x.kind]=1});
    window.__mmSeenNext=s;
    return {show:show,list:list};
  }

  /* ============== welcome (first visit) & hello (returning) ============== */
  function partOfDay(){var h=new Date().getHours();return h<5?'night':h<12?'morning':h<17?'afternoon':h<21?'evening':'night'}
  function welcome(){
    var pd=partOfDay();
    var G=['Hey, you found me 👋','Well hello there 👋','Oh, a visitor! 👋','Good '+pd+', friend 👋','Look who wandered in ✨','Salaam, traveller 👋','Come in, come in 👋'];
    var A=['This is my corner of the internet — part classroom, part collection of poetry, part workshop.',
      'Welcome to my little room of words, numbers and code — a classroom on one side, a poetry shelf on the other.',
      'I’m Majid. I teach maths and English, write Urdu poetry and build small tools — and this is where it all lives.',
      'Think of this as a quiet study with the lamp left on: poems, practice papers, study notes and a few apps I made.',
      'Half classroom, half notebook, half workshop — yes, that’s three halves. It’s that kind of place.'];
    var I=['Take your shoes off, look around, and stay as long as you like.',
      'Pull up a chair, pour some chai, and wander wherever your curiosity takes you.',
      'There’s no rush and no rules — open any door in the menu and see what you find.',
      'Read slowly, come back often. Everything here is meant to be taken at your own pace.',
      'Look around — I keep adding things, and I’ll tell you right here whenever I do.'];
    function r(a){return a[Math.floor(Math.random()*a.length)]}
    var g=r(G),a=r(A),i=r(I);
    var ov=document.createElement('div');ov.className='wc-overlay';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','wcT');
    ov.innerHTML='<div class="wc-modal"><button class="wc-x" type="button" aria-label="Close">✕</button><h2 id="wcT">'+esc(g)+'</h2><p>'+esc(a)+'</p><p>'+esc(i)+'</p>'+
      '<div class="wc-btns"><button class="btn wc-go" type="button">Come on in</button><button class="wc-menu" type="button">show me around</button></div><div class="wc-orn">✿ ☕ ✿</div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ov.classList.add('open')});
    document.body.classList.add('no-scroll');
    function close(open){ov.classList.remove('open');document.body.classList.remove('no-scroll');setTimeout(function(){ov.remove()},400);
      document.removeEventListener('keydown',key);if(open){var b=document.getElementById('burger');if(b)b.click()}}
    function key(e){if(e.key==='Escape')close(false)}
    ov.querySelector('.wc-go').addEventListener('click',function(){close(false)});
    ov.querySelector('.wc-x').addEventListener('click',function(){close(false)});
    ov.querySelector('.wc-menu').addEventListener('click',function(){close(true)});
    ov.addEventListener('click',function(e){if(e.target===ov)close(false)});
    document.addEventListener('keydown',key);
    setTimeout(function(){var b=ov.querySelector('.wc-go');if(b)b.focus()},300);
  }
  function hello(n,days){
    var t=document.createElement('div');t.className='hello';t.setAttribute('role','status');
    var m;
    if(n>0)m=['Welcome back 👋 — '+n+' new '+(n>1?'things':'thing')+' since you were last here.','Oh, you’re back! I’ve added '+n+' '+(n>1?'things':'thing')+' since your last visit.','Good to see you again — '+n+' new '+(n>1?'arrivals':'arrival')+' while you were away.'];
    else m=['Good to see you again — nothing new since last time, but the chai is still warm.','Welcome back 👋 Same corner, same lamp. I’ll tell you when something changes.','You’re back! Quiet week here — I’m working on the next thing.'];
    t.innerHTML='<span>'+esc(m[Math.floor(Math.random()*m.length)])+'</span><button type="button" aria-label="Dismiss">✕</button>';
    document.body.appendChild(t);
    requestAnimationFrame(function(){t.classList.add('show')});
    function gone(){t.classList.remove('show');setTimeout(function(){t.remove()},400)}
    t.querySelector('button').addEventListener('click',gone);setTimeout(gone,9000);
  }

  /* ============== run ============== */
  var cached=jget('mm_feed_v1',null);
  if(cached&&cached.list)draw(cached.list);                    /* instant: show what this browser already knows */
  var drawn=false;
  collect().then(function(list){
    drawn=true;
    var res=draw(list);
    lsSet('mm_feed_v1',JSON.stringify({t:NOW,list:list}));
    var nNew=0;
    if(seen){list.forEach(function(x){if(x.kind!=='note'&&!seen[norm(x.href)+'|'+x.kind])nNew++})}
    if(firstVisit){welcome();lsSet('mm_first',String(NOW))}
    else if(lastVisit&&NOW-lastVisit>30*60*1000){hello(nNew,Math.floor((NOW-lastVisit)/DAY))}
    lsSet('mm_last',String(NOW));
    lsSet('mm_seen',JSON.stringify(window.__mmSeenNext||{}));
  });
  if(firstVisit&&!cached){setTimeout(function(){if(!drawn&&!document.querySelector('.wc-overlay')){welcome();lsSet('mm_first',String(NOW))}},2500)}   /* slow network: don't make them wait */

  /* tagline under the name, + fade it away once the page scrolls */
  var tg=document.getElementById('tagline');
  if(tg){
    var W=['a poet','a maths teacher','a lover of literature','a web tinkerer','a tech-driven teacher','a dreamer with a laptop'],i=0;
    setInterval(function(){i=(i+1)%W.length;tg.classList.add('out');setTimeout(function(){tg.textContent=W[i];tg.classList.remove('out')},450)},3200);
    var top=document.querySelector('.top');
    addEventListener('scroll',function(){top.classList.toggle('scrolled',scrollY>40)},{passive:true});
  }
})();
