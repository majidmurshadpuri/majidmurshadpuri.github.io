/* Shared script: stars, menu drawer, scroll reveal, live search */
(function(){
  var st=document.getElementById('stars');
  for(var i=0;i<60;i++){var s=document.createElement('i');
    s.style.left=Math.random()*100+'%';s.style.top=Math.random()*70+'%';
    s.style.animationDelay=(Math.random()*3)+'s';s.style.transform='scale('+(0.6+Math.random()*1.2)+')';st.appendChild(s)}
  var burger=document.getElementById('burger'),drawer=document.getElementById('drawer'),
      scrim=document.getElementById('scrim'),dclose=document.getElementById('drawerClose');
  function openD(){drawer.classList.add('open');scrim.classList.add('open');drawer.setAttribute('aria-hidden','false');
    burger.setAttribute('aria-expanded','true');document.body.classList.add('no-scroll')}
  function closeD(){drawer.classList.remove('open');scrim.classList.remove('open');drawer.setAttribute('aria-hidden','true');
    burger.setAttribute('aria-expanded','false');document.body.classList.remove('no-scroll')}
  burger.addEventListener('click',openD);dclose.addEventListener('click',closeD);scrim.addEventListener('click',closeD);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeD()});
  var cards=[].slice.call(document.querySelectorAll('.note'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15});
    cards.forEach(function(c){io.observe(c)});
  }else{cards.forEach(function(c){c.classList.add('in')})}
  var input=document.getElementById('searchInput'),empty=document.getElementById('empty');
  if(input){input.addEventListener('input',function(){
    var q=input.value.toLowerCase().trim(),shown=0;
    cards.forEach(function(c){var ok=!q||c.textContent.toLowerCase().indexOf(q)>-1;
      c.style.display=ok?'':'none';if(ok){shown++;c.classList.add('in')}});
    if(empty)empty.style.display=shown?'none':'block';
  })}
})();
