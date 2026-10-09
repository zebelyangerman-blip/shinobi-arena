/* R80 - Shinobi presentation. No gameplay writes, independent RNG, no dependencies.
 * All resolved events are snapshots; cancelling any animation cannot cancel a turn.
 * One RAF scheduler draws ambient and event canvases. Timers/WAAPI are bounded.
 */
(function (global) {
  'use strict';
  const VERSION = '80.0.0';
  const $ = id => document.getElementById(id);
  const themeMap = Object.freeze({
    hidden_forest: {color:'#79bfa3',accent:'#e6ba77',rgb:'121,191,163',kind:'leaf',name:'FOREST',art:'hidden_forest'},
    water_channels: {color:'#6ec9e8',accent:'#b5e8f7',rgb:'110,201,232',kind:'rain',name:'WATER',art:'water_channels'},
    stone_ruins: {color:'#dfac78',accent:'#eccc96',rgb:'223,172,120',kind:'dust',name:'RUINS',art:'stone_ruins'},
    open_expanse: {color:'#c3ceb3',accent:'#edd9a2',rgb:'195,206,179',kind:'wind',name:'WIND',art:'open_expanse'},
    close_courtyard: {color:'#d6897b',accent:'#ddbc7d',rgb:'214,137,123',kind:'ember',name:'COURTYARD',art:'close_courtyard'}
  });
  const scrollMap = Object.freeze({
    SHUNSHIN:{kind:'lightning',color:'#81d8ff',label:'\u041c\u041e\u041b\u041d\u0418\u0415\u041d\u041e\u0421\u041d\u042b\u0419 \u0420\u042b\u0412\u041e\u041a'},
    FUINJUTSU:{kind:'seal',color:'#b2a0ef',label:'\u041f\u0415\u0427\u0410\u0422\u042c \u0421\u0414\u0415\u0420\u0416\u0418\u0412\u0410\u041d\u0418\u042f'},
    KAGE_BUNSHIN:{kind:'smoke',color:'#b3d5dc',label:'\u0422\u0415\u041d\u0415\u0412\u041e\u0419 \u041a\u041b\u041e\u041d'},
    IZANAGI:{kind:'rewrite',color:'#efb0b4',label:'\u041f\u0415\u0420\u0415\u0417\u0410\u041f\u0418\u0421\u042c \u0421\u0423\u0414\u042c\u0411\u042b'},
    EDO_TENSEI:{kind:'revive',color:'#c8d8b3',label:'\u0412\u041e\u0417\u0420\u041e\u0416\u0414\u0415\u041d\u0418\u0415'},
    IRYO_NINJUTSU:{kind:'heal',color:'#77e3b3',label:'\u0418\u0421\u0426\u0415\u041b\u0415\u041d\u0418\u0415'}
  });
  let initialized=false,disposed=false,externalPaused=false,pageSuspended=false,raf=0,last=0,phase='hub',theme=themeMap.hidden_forest;
  let width=1,height=1,dpr=1,ambientCanvas,ambientCtx,fxCanvas,fxCtx,root,scene,transition;
  let reduced=false,performanceMode=false,particleTarget=0,particleEnabled=true;
  let seed=0x16c274cd,eventSerial=0,duelSerial=0,lastEvent='initializing',currentDuel=null;
  const ambient=[],motes=[],pool=[],effects=[],animations=new Set(),timers=new Set(),temporary=new Set(),listeners=[];
  const errors=[],eventLog=[],frameTimes=[];
  let lastFrameActual=0,frameCount=0,phaseRequest=0,fxDirty=false;
  try { const s=new Uint32Array(1);global.crypto?.getRandomValues(s);seed=s[0]||seed; } catch (_) {}
  function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
  function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push([target,type,handler,options]);}
  function recordError(e){const message=String(e?.message||e).slice(0,220);if(errors.length<12&&!errors.includes(message))errors.push(message);}
  function guard(fn){try{return fn();}catch(e){recordError(e);return null;}}
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);guard(fn);},ms);timers.add(id);return id;}
  function animate(node,frames,options){
    if(!node||!node.animate||disposed||externalPaused||pageSuspended||document.visibilityState==='hidden')return null;
    try{
      const a=node.animate(frames,{easing:'cubic-bezier(.16,1,.3,1)',fill:'none',...options});
      animations.add(a);const done=()=>animations.delete(a);
      a.onfinish=done;a.oncancel=done;return a;
    }catch(e){recordError(e);return null;}
  }
  function box(node){if(!node)return null;const r=node.getBoundingClientRect();return r.width&&r.height?{x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}:null;}
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;}
  function track(node){temporary.add(node);return node;}
  function remove(node){if(node){node.remove();temporary.delete(node);}}
  function wanted(){return !disposed&&!externalPaused&&!pageSuspended&&document.visibilityState!=='hidden'&&(ambient.length||motes.length||effects.length);}
  function schedule(){if(!raf&&wanted())raf=requestAnimationFrame(frame);}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;lastFrameActual=0;}
  function resize(){
    width=Math.max(1,Math.round(global.innerWidth));height=Math.max(1,Math.round(global.innerHeight));
    dpr=Math.min(performanceMode?1:1.5,global.devicePixelRatio||1);
    for(const c of [ambientCanvas,fxCanvas])if(c){const w=Math.round(width*dpr),h=Math.round(height*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;c.getContext('2d')?.setTransform(dpr,0,0,dpr,0,0);}}
  }
  function clearCanvas(){ambientCtx?.clearRect(0,0,width,height);fxCtx?.clearRect(0,0,width,height);}
  function configure(){
    if(!initialized||disposed)return;
    guard(()=>{
      reduced=typeof r21ShouldReduceMotion==='function'?r21ShouldReduceMotion():global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      performanceMode=typeof r21ResolvePerformanceMode==='function'?r21ResolvePerformanceMode()==='performance':false;
      particleTarget=typeof r21GetParticleTarget==='function'?r21GetParticleTarget():24;
      particleEnabled=typeof r21GetSettings==='function'?r21GetSettings().performance.particles!==false:true;
      document.body.dataset.r80Paused=String(externalPaused||pageSuspended||document.visibilityState==='hidden');
      document.body.dataset.r80Motion=reduced?'reduced':'full';document.body.dataset.r80Quality=performanceMode?'performance':'quality';
      if(reduced) { clearTransient(); ambient.length=0; }
      else {
        const n=Math.min(40,particleTarget);
        while(ambient.length<n)ambient.push(makeAmbient(true));
        if(ambient.length>n)ambient.length=n;
      }
      if(!particleEnabled){while(motes.length)pool.push(motes.pop());}
      resize();clearCanvas();stop();schedule();
    });
  }
  function makeAmbient(initial){return {x:random()*width,y:initial?random()*height:height+10,life:random()*6,size:.7+random()*2,alpha:.15+random()*.3,vx:(random()-.5)*10,vy:-9-random()*20,angle:random()*6.28};}
  function drawAmbient(dt){
    if(!ambientCtx)return;
    const c=ambientCtx;c.clearRect(0,0,width,height);
    for(let i=0;i<ambient.length;i++){
      const a=ambient[i];a.life+=dt;a.x+=(a.vx+Math.sin(a.life*.6)*3)*dt;a.y+=a.vy*dt;a.angle+=dt*.25;
      if(theme.kind==='rain')a.y-=a.vy*dt*2.6;
      if(a.y<-10||a.y>height+30||a.x<-20||a.x>width+20){Object.assign(a,makeAmbient(false));if(theme.kind==='rain')a.y=-8;}
      c.globalAlpha=a.alpha*(phase==='battle'?.62:1);c.fillStyle=i%4?theme.color:theme.accent;c.strokeStyle=c.fillStyle;
      if(theme.kind==='leaf') {c.save();c.translate(a.x,a.y);c.rotate(a.angle);c.beginPath();c.ellipse(0,0,a.size*1.8,a.size*.55,0,0,Math.PI*2);c.fill();c.restore();}
      else if(theme.kind==='rain'||theme.kind==='wind'){c.lineWidth=.7;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x+(theme.kind==='wind'?15:2),a.y+5);c.stroke();}
      else{c.beginPath();c.arc(a.x,a.y,a.size,0,Math.PI*2);c.fill();}
    }
    c.globalAlpha=1;
  }
  function burst(x,y,kind='slash',color=theme.accent,scale=1){
    if(reduced||externalPaused||pageSuspended||document.visibilityState==='hidden'||!initialized||disposed)return;
    const duration=kind==='smoke'?680:kind==='heal'||kind==='revive'?850:600;
    if(effects.length<16)effects.push({x,y,kind,color,age:0,ttl:duration/1000,scale,seed:random(),serial:++eventSerial});
    if(particleEnabled){
      const count=Math.round((performanceMode?10:24)*Math.min(1.3,scale));
      const cap=performanceMode?48:144;
      for(let i=0;i<count&&motes.length<cap;i++){
        const m=pool.pop()||{};const a=random()*Math.PI*2,v=(30+random()*180)*scale;
        Object.assign(m,{x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(kind==='heal'||kind==='revive'?90:0),age:0,ttl:.25+random()*.65,size:.7+random()*2.4,color,kind,angle:a});motes.push(m);
      }
    }
    schedule();
  }
  function line(c,points,width,color,alpha=1){c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}
  function lightning(c,e,p){
    const span=Math.min(width*.42,230)*e.scale,points=[];
    for(let i=0;i<=12;i++)points.push([e.x-span/2+span*i/12,e.y+Math.sin(i*21.7+e.seed*91)*17*(i===0||i===12?0:1)]);
    const fade=Math.max(0,1-p*1.7);
    line(c,points,performanceMode?6:10,e.color,fade*.35);line(c,points,2.2,e.color,fade);line(c,points,.8,'#f5f7f2',fade);
    if(!performanceMode)for(let i=3;i<10;i+=3){const [x,y]=points[i];line(c,[[x,y],[x+17,y-26],[x+37,y-19],[x+49,y-47]],1,e.color,fade*.65);}
  }
  function seal(c,e,p){
    const radius=(34+Math.sin(Math.min(1,p*2)*Math.PI/2)*60)*e.scale;
    c.save();c.translate(e.x,e.y);c.rotate((e.kind==='rewrite'?-1:1)*p*1.4);
    c.strokeStyle=e.color;c.globalAlpha=(1-p)*.8;c.lineWidth=1.6;
    for(const r of [radius,radius*.76]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
    const n=performanceMode?6:12;
    for(let i=0;i<n;i++){c.save();c.rotate(i/n*Math.PI*2);c.beginPath();c.moveTo(radius*.79,-3);c.lineTo(radius*.93,-3);c.lineTo(radius*.93,4);c.moveTo(radius*.8,4);c.lineTo(radius*.85,4);c.stroke();c.restore();}
    c.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;c.lineTo(Math.cos(a)*radius*.53,Math.sin(a)*radius*.53);}c.closePath();c.stroke();c.restore();
  }
  function speedStreak(c,e,p){
    const fade=Math.max(0,1-p*1.5),span=Math.min(width*.34,210)*e.scale;
    c.save();c.translate(e.x,e.y);c.rotate(-.08);c.strokeStyle=e.color;c.lineCap='round';
    const n=performanceMode?3:6;
    for(let i=0;i<n;i++){const y=(i-(n-1)/2)*9,lag=i*11;c.globalAlpha=fade*(.28+i/n*.4);c.lineWidth=i%2?1.1:2.1;c.beginPath();c.moveTo(-span*.62-lag,y);c.lineTo(span*(.2+.65*(1-p)),y-2);c.stroke();}
    c.globalAlpha=fade*.72;c.fillStyle='#f7efe0';c.fillRect(-span*.18,-1,span*.62,2);c.restore();
  }
  function impactRing(c,e,p){
    const fade=Math.max(0,1-p),r=(18+112*Math.min(1,p*1.4))*e.scale;c.save();c.translate(e.x,e.y);
    c.globalAlpha=fade*.8;c.strokeStyle=e.color;c.lineWidth=performanceMode?2:3;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();
    const rays=performanceMode?6:10;for(let i=0;i<rays;i++){const a=i/rays*Math.PI*2,c0=Math.cos(a),s0=Math.sin(a);c.globalAlpha=fade*(.25+(i%3)*.12);c.lineWidth=1;c.beginPath();c.moveTo(c0*r*.62,s0*r*.62);c.lineTo(c0*r*1.18,s0*r*1.18);c.stroke();}
    c.restore();
  }
  function drawEffect(c,e){
    const p=Math.min(1,e.age/e.ttl);c.save();c.lineCap='round';
    if(e.kind==='lightning')lightning(c,e,p);
    else if(e.kind==='dash')speedStreak(c,e,p);
    else if(e.kind==='impact')impactRing(c,e,p);
    else if(['seal','heal','revive','rewrite'].includes(e.kind))seal(c,e,p);
    else if(e.kind==='smoke'){
      for(let i=0;i<(performanceMode?5:9);i++){
        const a=i*2.4+e.seed*6,r=15+p*65,x=e.x+Math.cos(a)*r*.7,y=e.y+Math.sin(a)*r*.4-p*35;
        c.globalAlpha=(1-p)*.19;c.fillStyle=e.color;c.beginPath();c.arc(x,y,12+p*26,0,Math.PI*2);c.fill();
      }
    } else {
      const size=Math.min(160,width*.27)*e.scale,k=Math.min(1,p*4),fade=1-p;
      c.translate(e.x,e.y);c.rotate(e.kind==='wind'?-.6:-.38);
      c.globalAlpha=fade;c.fillStyle=e.color;c.beginPath();c.moveTo(-size*k,13);c.quadraticCurveTo(0,-22,size*k,-12);c.quadraticCurveTo(0,2,-size*k,13);c.fill();
      c.globalAlpha=fade*.9;c.fillStyle='#fbf1d8';c.beginPath();c.moveTo(-size*k*.88,9);c.quadraticCurveTo(0,-6,size*k*.9,-10);c.quadraticCurveTo(0,-1,-size*k*.88,9);c.fill();
      c.setTransform(dpr,0,0,dpr,0,0);
      c.strokeStyle=e.color;c.globalAlpha=fade*.48;c.lineWidth=1.2;c.beginPath();c.ellipse(e.x,e.y,(12+90*p)*e.scale,(12+64*p)*e.scale,-.4,0,Math.PI*2);c.stroke();
    }
    c.restore();
  }
  function drawFX(dt){
    if(!fxCtx||(!effects.length&&!motes.length&&!fxDirty))return;const c=fxCtx;c.clearRect(0,0,width,height);fxDirty=false;
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;if(e.age>=e.ttl)effects.splice(i,1);else drawEffect(c,e);}
    for(let i=motes.length-1;i>=0;i--){
      const m=motes[i];m.age+=dt;if(m.age>=m.ttl){pool.push(m);motes.splice(i,1);continue;}
      m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=m.kind==='heal'||m.kind==='revive'?-15:90;m.vx*=Math.max(0,1-dt*2);
      c.globalAlpha=(1-m.age/m.ttl)*.85;c.fillStyle=m.color;c.strokeStyle=m.color;
      if(m.kind==='smoke'){c.globalAlpha*=.18;c.beginPath();c.arc(m.x,m.y,5+m.age*8,0,Math.PI*2);c.fill();}
      else if(m.kind==='revive'||m.kind==='heal'){c.fillRect(m.x,m.y,m.size*1.7,m.size*1.7);}
      else{c.lineWidth=m.size*.6;c.beginPath();c.moveTo(m.x,m.y);c.lineTo(m.x-m.vx*.035,m.y-m.vy*.035);c.stroke();}
    }c.globalAlpha=1;fxDirty=!!(effects.length||motes.length);
  }
  function frame(ts){
    raf=0;if(!wanted()){last=0;return;}
    // Quiet ambience needs only 30 updates/s; brief combat bursts retain 60.
    const interval=performanceMode||(!effects.length&&!motes.length)?1000/30:1000/60;
    if(last&&ts-last<interval-1){schedule();return;}
    const dt=last?Math.min(.05,(ts-last)/1000):1/60;last=ts;
    if(lastFrameActual){frameTimes.push(ts-lastFrameActual);if(frameTimes.length>240)frameTimes.shift();}lastFrameActual=ts;frameCount++;
    drawAmbient(dt);drawFX(dt);schedule();
  }
  function clearActivePresentation(){
    for(const id of timers)clearTimeout(id);timers.clear();
    for(const a of animations)guard(()=>a.cancel());animations.clear();
    for(const n of temporary)n.remove();temporary.clear();
    effects.length=0;while(motes.length)pool.push(motes.pop());
    fxCtx?.clearRect(0,0,width,height);
  }
  function clearTransient(){
    duelSerial++;clearActivePresentation();
    if(root){root.replaceChildren();root.classList.remove('active');}
    if(transition)transition.classList.remove('active');
    document.body?.classList.remove('r80-duel-active');
    currentDuel=null;
  }
  function pause(value=true){externalPaused=!!value;document.body.dataset.r80Paused=String(externalPaused||pageSuspended||document.visibilityState==='hidden');if(externalPaused){stop();clearTransient();clearCanvas();}else configure();}
  function setTheme(id){
    theme=themeMap[id]||themeMap.hidden_forest;
    const s=document.documentElement.style;s.setProperty('--arena-primary',theme.color);s.setProperty('--arena-accent',theme.accent);s.setProperty('--arena-rgb',theme.rgb);
    if(scene)scene.style.setProperty('--r80-world-art',`url("${new URL('assets/arenas/'+theme.art+'.webp',document.baseURI).href}")`);
    document.body.dataset.r80Arena=theme.art;
  }
  function phaseEnter(detail={}){
    const next=detail.phase||document.body.dataset.r27Phase||document.body.dataset.r18Phase||'hub';
    if(next===phase&&lastEvent!=='initializing')return;
    // A final resolved duel may finish visually over the already-updated end screen.
    // This never delays the gameplay transition or intercepts the next-match button.
    if(next==='end'&&root?.classList.contains('active')) {
      phase=next;document.body.dataset.r80Phase=next;lastEvent='phase:end';return;
    }
    clearTransient();phase=next;
    document.body.dataset.r80Phase=phase;
    if(next==='hub'||next==='initiative'||next==='draft'||next==='scroll')setTheme('hidden_forest');
    else guard(()=>{if(typeof getCurrentArena==='function')setTheme(getCurrentArena()?.id);});
    if(next!=='initiative'&&typeof cancelInitiativeR80==='function')cancelInitiativeR80();
    const node=$( {hub:'command-hub',initiative:'initiative-phase',draft:'draft-phase',scroll:'scroll-phase',arena:'arena-phase',battle:'battle-phase',end:'end-screen'}[next]);
    if(node){
      // Animate only an inner visual wrapper: never the fixed-CTA containing block.
      const child=node.querySelector('.phase-heading,.draft-stage-header,.r57-hub-grid,.r57-battle-score')||node.querySelector('h1');
      animate(child,reduced?[{opacity:.5},{opacity:1}]:[{opacity:.25,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:reduced?120:340});
    }
    if(transition&&!reduced&&next!=='hub')animate(transition,[{opacity:0,transform:'translateX(-110%) skewX(-16deg)'},{opacity:.6,offset:.35},{opacity:0,transform:'translateX(120%) skewX(-16deg)'}],{duration:430,easing:'cubic-bezier(.4,0,.2,1)'});
    if(next==='hub'){const n=$('r80-hero-cards');animate(n,reduced?[{opacity:.6},{opacity:1}]:[{opacity:0,transform:'translateY(18px) scale(.95)'},{opacity:1,transform:'none'}],{duration:680});}
    if(next==='end')later(()=>victory(),60);
    lastEvent='phase:'+phase;schedule();
  }
  function pulse(node,color){
    if(!node)return;
    animate(node,[{outline:'1px solid '+color,outlineOffset:'-2px'},{outline:'1px solid transparent',outlineOffset:'5px'}],{duration:reduced?160:450});
  }
  function initiativeStart(){
    $('init-result-text')?.removeAttribute('data-winner');
    document.querySelectorAll('.initiative-console').forEach((n,i)=>{
      pulse(n,i?'#ec9874':'#7ac3dd');
      const b=box(n);if(b&&!reduced)burst(b.cx,b.cy+10,'seal',i?'#dc956e':'#7ac3dd',.55);
    });
  }
  function initiativeResult(d){
    const n=document.querySelector(d.winner===1?'.initiative-console.player-one':d.winner===2?'.initiative-console.player-two':'.initiative-duel');
    pulse(n,theme.accent);const b=box(n);if(b)burst(b.cx,b.cy,'slash',d.winner===1?'#7ac3dd':'#e3b77d',.65);
    animate($('init-result-text'),[{opacity:.2},{opacity:1}],{duration:220});
  }
  function draftReveal(d){
    const card=$('draft-card');if(!card)return;
    card.dataset.r80Tier=String(d?.tier??'');
    animate(card,reduced?[{opacity:.65},{opacity:1}]:[{opacity:.15,translate:'0 12px',scale:'.98'},{opacity:1,translate:'0 0',scale:'1'}],{duration:reduced?100:300});
    const art=$('draft-img-container')?.querySelector('img');
    if(!reduced)animate(art,[{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:580});
  }
  function draftDecision(d){
    const src=box($('draft-img-container'));
    const host=$('draft-p'+d.targetPlayer+'-slots');
    if(!src||!host)return;
    const slots=Array.from(host.children);const last=slots[Math.max(0,Math.min(slots.length-1,Number(d.slotIndex)||0))]||host;
    const dst=box(last);pulse(last,d.targetPlayer===1?'#7ac3dd':'#dc956e');
    if(!dst||reduced)return;
    const ghost=track(el('div','r80-card-ghost'));
    const image=el('img');image.alt='';image.src=d.image;ghost.append(image);ghost.setAttribute('aria-hidden','true');
    Object.assign(ghost.style,{left:src.x+'px',top:src.y+'px',width:src.w+'px',height:src.h+'px'});document.body.append(ghost);
    const dx=dst.cx-src.cx,dy=dst.cy-src.cy,scale=Math.min(.45,dst.h/src.h);
    animate(ghost,[{opacity:.94,transform:'translate(0,0) scale(1) rotate(0deg)'},{opacity:.9,offset:.68},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(${scale}) rotate(${d.targetPlayer===1?-7:7}deg)`}],{duration:360});
    later(()=>{remove(ghost);burst(dst.cx,dst.cy,'slash',d.targetPlayer===1?'#7ac3dd':'#dc956e',.4);},370);
  }
  function scrollReveal(){
    const nodes=document.querySelectorAll('#scroll-inventory > button');
    nodes.forEach((n,i)=>animate(n,reduced?[{opacity:.7},{opacity:1}]:[{opacity:0,translate:'0 12px',rotate:'-3deg'},{opacity:1,translate:'0 0',rotate:'0deg'}],{duration:250,delay:reduced?0:i*35}));
  }
  function scrollAssigned(d){
    const n=document.querySelector(`[data-r23-scroll-fighter="${Number(d.index)}"]`),b=box(n);
    if(!b||!d.scrollId)return;const f=scrollMap[d.scrollId];if(!f)return;
    pulse(n,f.color);burst(b.cx,b.cy,f.kind,f.color,.5);
  }
  function arenaSelected(d){
    setTheme(d.arenaId);const b=box($('arena-roll-card'));if(b)burst(b.cx,b.cy,'seal',theme.accent,.7);
    animate($('arena-roll-card'),reduced?[{opacity:.7},{opacity:1}]:[{scale:'.97'},{scale:'1.025',offset:.55},{scale:'1'}],{duration:400});
  }
  const damageStates=Object.freeze({
    0:{id:'FRESH',label:'Свежий'},
    1:{id:'WOUNDED',label:'Ранен'},
    2:{id:'EXHAUSTED',label:'Истощён'},
    3:{id:'NEAR_DEATH',label:'На грани'},
    4:{id:'DEFEATED',label:'Выбыл'}
  });
  function hashText(value){let h=2166136261;for(const ch of String(value??'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function damageVariant(uid){return hashText(uid)%4;}
  function damageMeta(value){const n=Math.max(0,Math.min(4,Math.trunc(Number(value)||0)));return damageStates[n]||damageStates[0];}
  function attachDamageLayer(host,uid){
    if(!host)return null;
    const variant=damageVariant(uid);host.dataset.r80DamageVariant=String(variant);
    let layer=host.querySelector(':scope > .r80-damage-layer');
    if(!layer){layer=el('i','r80-damage-layer');layer.setAttribute('aria-hidden','true');host.append(layer);}
    layer.dataset.r80DamageVariant=String(variant);return layer;
  }
  function fighterPanel(f,side){
    const state=Math.max(0,Math.min(4,Math.trunc(Number(f.entryState ?? f.preState ?? 0)||0))),meta=damageMeta(state),variant=damageVariant(f.uid);
    const n=el('article','r80-duel-fighter side-'+side);n.dataset.r80State=String(state);n.dataset.r80FinalState=String(Math.max(0,Math.min(4,Math.trunc(Number(f.finalState)||0))));n.dataset.r80DamageVariant=String(variant);
    const rim=el('div','r80-duel-art');rim.dataset.r80State=String(state);rim.dataset.r80DamageVariant=String(variant);const image=el('img');image.src=f.image;image.alt='';image.decoding='async';rim.append(image);attachDamageLayer(rim,f.uid);
    const condition=el('span','r80-duel-condition',meta.label);condition.dataset.r80State=String(state);
    n.append(rim,el('span','r80-duel-side',side===1?'КОМАНДА 1':'КОМАНДА 2'),el('strong','r80-duel-name',f.name),condition);
    return n;
  }
  function setFighterDamage(node,stateValue,stateName){
    if(!node)return;const state=Math.max(0,Math.min(4,Math.trunc(Number(stateValue)||0))),meta=damageMeta(state);
    node.dataset.r80State=String(state);const art=node.querySelector('.r80-duel-art');if(art)art.dataset.r80State=String(state);
    const condition=node.querySelector('.r80-duel-condition');if(condition){condition.dataset.r80State=String(state);condition.textContent=stateName||meta.label;}
  }
  function dashEcho(node,direction,color){
    if(reduced||externalPaused)return;
    const art=node?.querySelector('.r80-duel-art'),r=box(art),source=art?.querySelector('img');
    if(!r||!source)return;
    for(let i=0;i<(performanceMode?1:3);i++){
      const echo=track(el('div','r80-dash-echo'));echo.setAttribute('aria-hidden','true');
      const image=el('img');image.alt='';image.src=source.src;echo.append(image);
      Object.assign(echo.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',borderColor:color});
      document.body.append(echo);
      animate(echo,[{opacity:.25-i*.045,transform:'translateX('+(-direction*i*12)+'px)'},{opacity:0,transform:'translateX('+direction*(65+i*15)+'px)'}],{duration:220+i*40,easing:'cubic-bezier(.2,.6,.4,1)'});
      later(()=>remove(echo),240+i*40);
    }
  }
  function damageFragments(node,color,count=6){
    if(reduced||performanceMode||externalPaused)return;
    const art=node?.querySelector('.r80-duel-art'),r=box(art);if(!r)return;
    for(let i=0;i<count;i++){
      const frag=track(el('i','r80-damage-fragment'));frag.setAttribute('aria-hidden','true');
      const side=i%2?-1:1,x=r.cx+(side>0?r.w*.34:-r.w*.34)+(random()-.5)*18,y=r.cy+(random()-.5)*r.h*.7;
      Object.assign(frag.style,{left:x+'px',top:y+'px',borderColor:color,transform:`rotate(${Math.round(random()*80-40)}deg)`});document.body.append(frag);
      const dx=side*(18+random()*38),dy=-18+random()*52,rot=(random()>.5?1:-1)*(35+random()*95);
      animate(frag,[{opacity:.85,transform:frag.style.transform+' scale(1)'},{opacity:0,transform:`translate(${dx}px,${dy}px) rotate(${rot}deg) scale(.55)`}],{duration:360+Math.round(random()*180),easing:'cubic-bezier(.2,.7,.2,1)'});
      later(()=>remove(frag),570);
    }
  }
  function combatStyle(d){
    const events=Array.isArray(d.scrollEvents)?d.scrollEvents:[];
    const exact=events.map(e=>scrollMap[e.scrollId]).find(Boolean);
    if(exact)return {kind:exact.kind,color:exact.color,label:exact.label,source:'SCROLL'};
    if(d.decisive==='ARENA'){
      const kind=theme.kind==='wind'?'wind':theme.kind==='rain'?'slash':theme.kind==='ember'?'slash':'impact';
      return {kind,color:theme.accent,label:'ВЛИЯНИЕ АРЕНЫ',source:'ARENA'};
    }
    const variants=['impact','slash','dash'],i=hashText(`${d.a.uid}|${d.b.uid}|${d.round}`)%variants.length;
    return {kind:variants[i],color:d.winner===1?'#82cbe6':'#e49a79',label:i===0?'СИЛОВОЕ СТОЛКНОВЕНИЕ':i===1?'РЕЗКИЙ РАЗМЕН':'СКОРОСТНОЙ РЫВОК',source:'NEUTRAL'};
  }
  function duelMotion(kind,winner,travel){
    const leftWins=winner===1,fast=kind==='dash'||kind==='lightning',soft=['seal','heal','revive','rewrite','smoke'].includes(kind);
    const reach=soft?travel*.63:fast?travel*1.28:travel;
    const rot=kind==='slash'?7:fast?2:4;
    return {
      a:[{transform:'perspective(720px) translateX(0) rotateY(-3deg) rotateZ(-3deg) scale(1)'},{transform:`perspective(720px) translateX(${reach*.72}px) rotateY(${leftWins?5:2}deg) rotateZ(${-rot*.35}deg) scale(1.012)`,offset:.52},{transform:`perspective(720px) translateX(${reach+(leftWins?(fast?22:13):5)}px) rotateY(${leftWins?8:3}deg) rotateZ(${leftWins?rot:-rot*.45}deg) scale(${leftWins?'1.045':'1.025'})`,offset:.72},{transform:'perspective(720px) translateX(0) rotateY(-3deg) rotateZ(-3deg) scale(1)'}],
      b:[{transform:'perspective(720px) translateX(0) rotateY(3deg) rotateZ(3deg) scale(1)'},{transform:`perspective(720px) translateX(${-reach*.72}px) rotateY(${leftWins?-2:-5}deg) rotateZ(${rot*.35}deg) scale(1.012)`,offset:.52},{transform:`perspective(720px) translateX(${-reach-(leftWins?5:(fast?22:13))}px) rotateY(${leftWins?-3:-8}deg) rotateZ(${leftWins?rot*.45:-rot}deg) scale(${leftWins?'1.025':'1.045'})`,offset:.72},{transform:'perspective(720px) translateX(0) rotateY(3deg) rotateZ(3deg) scale(1)'}],
      duration:fast?430:soft?500:520
    };
  }
  function finishDuel(token,reason='timer'){
    if(token!==duelSerial||!currentDuel||currentDuel.closing)return;
    currentDuel.closing=true;const panel=currentDuel.panel;currentDuel.reason=reason;if(currentDuel.skip)currentDuel.skip.disabled=true;
    // A user skip must end the whole presentation immediately, not leave old
    // combat timers/WAAPI objects alive until their original 2.6 s deadline.
    clearActivePresentation();
    if(panel&&!reduced)animate(panel,[{opacity:1},{opacity:0}],{duration:120,easing:'linear'});
    later(()=>{
      if(token!==duelSerial)return;
      root?.replaceChildren();root?.classList.remove('active');document.body.classList.remove('r80-duel-active');currentDuel=null;
      for(const a of animations)guard(()=>a.cancel());animations.clear();
      if(phase==='end')victory();
    },reduced?0:125);
  }
  function combatResolved(d){
    if(!root||!d?.a||!d?.b)return;
    if(d.arenaId)setTheme(d.arenaId);
    clearTransient();const token=++duelSerial;
    root.classList.add('active');document.body.classList.add('r80-duel-active');
    const style=combatStyle(d),loserData=d.winner===1?d.b:d.a,winnerData=d.winner===1?d.a:d.b;
    const loserStart=Number(loserData.entryState??loserData.preState??0)||0,loserEnd=Number(loserData.finalState)||0;
    const heavy=loserEnd>=3&&loserEnd>loserStart;
    const panel=el('div','r80-duel-panel');panel.dataset.r80Impact=style.kind;panel.dataset.r80Heavy=heavy?'true':'false';
    const heading=el('div','r80-duel-heading');heading.append(el('span','','ДУЭЛЬ / '+String(d.round).padStart(2,'0')),el('span','',heavy?'КРИТИЧЕСКИЙ ИСХОД':'РЕЗУЛЬТАТ РАУНДА'));
    const stage=el('div','r80-duel-stage'),a=fighterPanel(d.a,1),b=fighterPanel(d.b,2),vs=el('div','r80-duel-vs','VS');stage.append(a,vs,b);
    const out=el('div','r80-duel-outcome');out.append(el('span','','ПОБЕДИТЕЛЬ'),el('strong','',winnerData.name),el('small','',loserData.name+' · '+(loserData.finalStateName||damageMeta(loserData.finalState).label)));out.dataset.team=String(d.winner);
    const events=Array.isArray(d.scrollEvents)?d.scrollEvents:[],badges=el('div','r80-duel-events'),seen=new Set();
    for(const ev of events){const info=scrollMap[ev.scrollId];if(info&&!seen.has(ev.scrollId)){seen.add(ev.scrollId);badges.append(el('span','',info.label));}}
    if(!badges.children.length)badges.append(el('span','',style.label));
    if(heavy)badges.append(el('span','r80-heavy-badge',loserEnd>=4?'БОЕЦ ВЫБЫЛ':'КРИТИЧЕСКОЕ СОСТОЯНИЕ'));
    const skip=el('button','r80-duel-skip','ДАЛЬШЕ ›');skip.type='button';skip.disabled=true;skip.setAttribute('aria-label','Закрыть показ результата дуэли');
    panel.append(heading,stage,out,badges,skip);root.append(panel);
    const win=d.winner===1?a:b,lose=d.winner===1?b:a;
    const duration=reduced?2100:performanceMode?2350:2600,revealAt=reduced?260:performanceMode?610:720,fadeAt=duration-(reduced?180:250);
    currentDuel={token,panel,skip,revealed:false,startedAt:performance.now(),heavy,style};
    animate(panel,[{opacity:0},{opacity:1,offset:.06},{opacity:1,offset:fadeAt/duration},{opacity:0}],{duration,easing:'linear'});
    const reveal=()=>{
      if(token!==duelSerial||!currentDuel||currentDuel.revealed)return;
      currentDuel.revealed=true;
      setFighterDamage(win,winnerData.finalState,winnerData.finalStateName);setFighterDamage(lose,loserData.finalState,loserData.finalStateName);
      win.classList.add('winner');lose.classList.add('loser','damage-hit');out.classList.add('revealed');
      later(()=>{if(token===duelSerial){skip.disabled=false;skip.classList.add('ready');}},180);
    };
    skip.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!skip.disabled)finishDuel(token,'user-skip');});
    if(reduced){reveal();}
    else {
      animate(a,[{transform:'translateX(-54px) rotate(-8deg) scale(.97)',opacity:0},{transform:'translateX(0) rotate(-3deg) scale(1)',opacity:1}],{duration:260});
      animate(b,[{transform:'translateX(54px) rotate(8deg) scale(.97)',opacity:0},{transform:'translateX(0) rotate(3deg) scale(1)',opacity:1}],{duration:260});
      later(()=>{
        if(token!==duelSerial)return;
        const ar=box(a),br=box(b),direction=d.winner===1?1:-1,centerDistance=ar&&br?Math.abs(br.cx-ar.cx):300,travel=Math.max(24,Math.min(74,centerDistance*.18)),motion=duelMotion(style.kind,d.winner,travel);
        if(['dash','lightning'].includes(style.kind))dashEcho(win,direction,style.color);
        else if(style.kind==='slash')dashEcho(win,direction,style.color);
        animate(a,motion.a,{duration:motion.duration,easing:'cubic-bezier(.32,.02,.2,1)'});animate(b,motion.b,{duration:motion.duration,easing:'cubic-bezier(.32,.02,.2,1)'});
        animate(vs,[{opacity:1,scale:'1'},{opacity:.12,scale:'.64',offset:.58},{opacity:1,scale:heavy?'1.24':'1.14',offset:.74},{opacity:1,scale:'1'}],{duration:motion.duration,easing:'linear'});
      },285);
      later(()=>{
        if(token!==duelSerial)return;reveal();
        const flash=track(el('div','r80-impact-flash'+(heavy?' heavy':'')));stage.append(flash);
        animate(flash,[{opacity:0,scale:'.62'},{opacity:heavy?.74:.48,scale:heavy?'1.16':'1.08',offset:.22},{opacity:0,scale:heavy?'1.48':'1.3'}],{duration:heavy?270:190,easing:'linear'});later(()=>remove(flash),heavy?300:210);
        const stageBox=box(stage);if(stageBox){burst(stageBox.cx,stageBox.cy,style.kind,style.color,heavy?1.55:1.25);if(heavy&&!performanceMode)later(()=>burst(stageBox.cx,stageBox.cy,'slash','#f6e4bd',.82),80);}
        const recoil=heavy?31:18;
        animate(lose,[{translate:'0 0',rotate:'0deg'},{translate:(d.winner===1?recoil:-recoil)+'px '+(heavy?7:3)+'px',rotate:(d.winner===1?(heavy?'8deg':'4deg'):(heavy?'-8deg':'-4deg')),offset:.32},{translate:(d.winner===1?10:-10)+'px 1px',rotate:(d.winner===1?'2deg':'-2deg'),offset:.72},{translate:'0 0',rotate:'0deg'}],{duration:heavy?500:360,easing:'cubic-bezier(.2,.7,.2,1)'});
        animate(win,[{scale:'1'},{scale:heavy?'1.045':'1.025',offset:.35},{scale:'1'}],{duration:heavy?380:300});
        if(!performanceMode)animate(stage,[{translate:'0 0'},{translate:(heavy?'-7px':'-4px')+' 1px',offset:.15},{translate:(heavy?'7px':'4px')+' -1px',offset:.33},{translate:'-2px 0',offset:.5},{translate:'0 0'}],{duration:heavy?260:190,easing:'linear'});
        if(heavy)damageFragments(lose,style.color,loserEnd>=4?8:5);
        const winLayer=win.querySelector('.r80-damage-layer');if(winLayer&&Number(winnerData.finalState)>Number(winnerData.entryState??winnerData.preState??0))animate(winLayer,[{opacity:.35},{opacity:1}],{duration:300});
        events.slice(0,6).forEach((ev,i)=>later(()=>{if(token!==duelSerial)return;const f=scrollMap[ev.scrollId],n=ev.ownerUid===d.a.uid?a:ev.ownerUid===d.b.uid?b:win,r=box(n);if(f&&r)burst(r.cx,r.cy-18,f.kind,f.color,.62);},i*70));
      },revealAt);
    }
    later(()=>{if(token===duelSerial)finishDuel(token,'timer');},duration);
  }
  function victory(){
    const n=$('profile-victory-seal'),b=box(n);if(b)burst(b.cx,b.cy,'seal',theme.accent,1);
    animate(n,reduced?[{opacity:.5},{opacity:1}]:[{scale:'.78',opacity:0,rotate:'-12deg'},{scale:'1',opacity:1,rotate:'0deg'}],{duration:520});
    animate($('winner-text'),[{opacity:.2},{opacity:1}],{duration:600});
  }
  function present(type,detail={}){
    if(!initialized||disposed||externalPaused||pageSuspended||document.visibilityState==='hidden')return;
    lastEvent=String(type);eventLog.push({type:lastEvent,time:Math.round(performance.now())});if(eventLog.length>32)eventLog.shift();
    const handlers={phaseEnter,initiativeRollStart:initiativeStart,initiativeResult,draftReveal,draftDecision,scrollRolled:scrollReveal,scrollAssigned,arenaSelected,combatResolved,matchEnd:victory};
    if(handlers[type])guard(()=>handlers[type](detail));
  }
  function tilt(node){
    if(!node||node.dataset.tiltBound==='1')return;node.dataset.tiltBound='1';
    const reset=()=>{node.style.removeProperty('--r80-tilt-x');node.style.removeProperty('--r80-tilt-y');node.classList.remove('r80-tilting');};
    node.addEventListener('pointermove',e=>{
      if(disposed||reduced||performanceMode||e.pointerType!=='mouse')return reset();
      const r=node.getBoundingClientRect();if(!r.width||!r.height)return;
      node.style.setProperty('--r80-tilt-x',(-((e.clientY-r.top)/r.height-.5)*3)+'deg');
      node.style.setProperty('--r80-tilt-y',(((e.clientX-r.left)/r.width-.5)*3)+'deg');node.classList.add('r80-tilting');
    },{passive:true});node.addEventListener('pointerleave',reset,{passive:true});
  }
  function audit(){
    const times=[...frameTimes].sort((a,b)=>a-b);
    return {version:VERSION,initialized,phase,arena:theme.art,motion:reduced?'reduced':'full',quality:performanceMode?'performance':'quality',externalPaused,pageSuspended,rafRunning:!!raf,rafLoops:raf?1:0,ambient:ambient.length,eventParticles:motes.length,activeEmitters:effects.length,temporaryNodes:temporary.size,animations:animations.size,timers:timers.size,duelPanels:root?.children.length||0,currentDuel:currentDuel?{revealed:!!currentDuel.revealed,heavy:!!currentDuel.heavy,family:currentDuel.style?.kind||null}:null,frameCount,frameIntervalMedianMs:times.length?+times[Math.floor(times.length*.5)].toFixed(2):null,frameIntervalP95Ms:times.length?+times[Math.floor(times.length*.95)].toFixed(2):null,measurement:'local presentation draw intervals, not device FPS',lastEvent,errors:[...errors],events:[...eventLog]};
  }
  function dispose(){stop();clearTransient();for(const [t,n,f,o] of listeners)t.removeEventListener(n,f,o);listeners.length=0;disposed=true;ambient.length=0;pool.length=0;clearCanvas();root?.remove();fxCanvas?.remove();scene?.remove();transition?.remove();}
  function init(){
    if(initialized||disposed)return;
    guard(()=>{
      initialized=true;document.body.classList.add('r80-visual');document.body.dataset.presentationVersion=VERSION;
      scene=el('div','r80-world');scene.id='r80-world';scene.setAttribute('aria-hidden','true');
      scene.append(el('div','r80-world-art'),el('div','r80-world-mist'),el('div','r80-world-grid'));
      document.body.prepend(scene);
      ambientCanvas=$('chakra-canvas');ambientCtx=ambientCanvas?.getContext('2d');if(ambientCanvas){ambientCanvas.setAttribute('aria-hidden','true');ambientCanvas.style.removeProperty('display');}
      fxCanvas=el('canvas','r80-fx-canvas');fxCanvas.id='r80-fx-canvas';fxCanvas.setAttribute('aria-hidden','true');fxCtx=fxCanvas.getContext('2d');document.body.append(fxCanvas);
      root=el('div','r80-combat-cinematic');root.id='r80-combat-cinematic';root.setAttribute('aria-hidden','true');document.body.append(root);
      transition=el('div','r80-transition');transition.setAttribute('aria-hidden','true');document.body.append(transition);
      listen(document,'r27:phase-change',e=>{
        const detail={...e.detail};phaseRequest++;
        // State event may precede DOM render. One scheduled turn, not a DOM polling loop.
        const token=phaseRequest;later(()=>{if(token===phaseRequest)phaseEnter(detail);},0);
      });
      listen(document,'r61:arena-selected',e=>present('arenaSelected',e.detail));
      listen(document,'visibilitychange',()=>{document.body.dataset.r80Paused=String(document.visibilityState==='hidden'||externalPaused||pageSuspended);if(document.visibilityState==='hidden'){stop();clearTransient();clearCanvas();}else configure();});
      listen(global,'resize',()=>{resize();clearTransient();configure();},{passive:true});
      listen(global,'pagehide',()=>{pageSuspended=true;document.body.dataset.r80Paused='true';stop();clearTransient();clearCanvas();});
      listen(global,'pageshow',()=>{pageSuspended=false;configure();});
      // The dice are also a generous pointer target; the semantic button remains authoritative.
      listen(document,'click',e=>{if(e.target.closest('.initiative-console')&&phase==='initiative')$('roll-init-btn')?.click();});
      const hero=$('r80-hero-cards'),heroTarget=hero?.parentElement;if(heroTarget)listen(heroTarget,'pointermove',e=>{
        if(e.pointerType!=='mouse'||reduced||performanceMode)return;
        const r=hero.getBoundingClientRect();hero.style.setProperty('--hero-x',(((e.clientX-r.left)/r.width-.5)*8)+'px');hero.style.setProperty('--hero-y',(((e.clientY-r.top)/r.height-.5)*5)+'px');
      },{passive:true});
      if(heroTarget)listen(heroTarget,'pointerleave',()=>{hero.style.setProperty('--hero-x','0px');hero.style.setProperty('--hero-y','0px');});
      configure();setTheme('hidden_forest');phase='';phaseEnter({phase:document.body.dataset.r27Phase||'hub'});
      for(const n of document.querySelectorAll('.card-3d'))tilt(n);
    });
  }
  global.R80_VISUALS=Object.freeze({version:VERSION,init,present,configure,pause,resume:()=>pause(false),dispose,audit,tilt,burst,damageVariant});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
