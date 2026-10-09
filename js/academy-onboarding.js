/* SHINOBI ACADEMY V2 — one continuous, isolated practice mission.
 * Does not write to live team, CPU, profile, economy, ELO, online or lore charge state.
 * Uses the game's original pure resolveCombat() to calculate the final demonstration.
 */
(function(){
  'use strict';
  const VERSION='2.0.0',KEY='shinobi_academy_progress_v1',TOTAL=6;
  const HERO='fighter_003',PARTNER='fighter_004',RIVAL='fighter_073',ARENA='hidden_forest';
  const TOPICS=['Старт','Забрать','Передать','Связь','Свиток','Арена','Дуэль'];
  const TITLES=['Ваша первая миссия','Возьмите первого союзника','Решите, кому достанется карта','Создайте связь персонажей','Подготовьте свиток к бою','Изучите особенности арены','Примите боевое решение','Академия пройдена'];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blank=()=>({rolled:false,owned:[],enemy:[],link:false,leader:HERO,scrollSelected:false,scrollOwner:null,arenaId:null});
  const state={active:false,step:0,sub:0,done:false,busy:false,feedback:'',chosen:HERO,duel:null,events:[],focusBefore:null,timer:null,hudExpanded:false,mission:blank()};
  let root=null,sessionProgress={};
  const load=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return v?.schema===1?v:sessionProgress;}catch(_){return sessionProgress;}};
  const save=patch=>{sessionProgress={...load(),...patch,schema:1};try{localStorage.setItem(KEY,JSON.stringify(sessionProgress));}catch(_){}};
  const completed=()=>!!load().completedAt,skipped=()=>!!load().skipped;
  const prefReduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches||document.body?.dataset.r21Motion==='reduced';}catch(_){return false;}};
  const trace=(type,extra={})=>{state.events.push({type,step:state.step,at:Date.now(),...extra});if(state.events.length>90)state.events.shift();};
  const fighter=uid=>{try{return typeof getFighterByUid==='function'?getFighterByUid(uid):null;}catch(_){return null;}};
  const name=(uid,fallback='Боец')=>esc(fighter(uid)?.name||fallback);
  const art=uid=>'assets/portraits/'+encodeURIComponent(String(uid).replace(/[^a-zA-Z0-9_]/g,''))+'.webp';
  const img=(uid,alt='',cls='')=>`<img class="${cls}" src="${art(uid)}" alt="${esc(alt)}" loading="eager" decoding="async">`;
  const portrait=(uid,label='',cls='')=>`<div class="ac-portrait ${cls}">${img(uid,label||fighter(uid)?.name||'Боец')}<div class="ac-portrait-label">${esc(label||fighter(uid)?.name||'Боец')}</div></div>`;
  const buttons=items=>`<div class="ac-options">${items.map(x=>`<button type="button" class="ac-choice ${x.primary?'ac-choice-primary':''}" data-ac-action="${esc(x.action)}" ${x.value?`data-ac-value="${esc(x.value)}"`:''} ${state.busy?'disabled':''}>${x.icon?`<span class="ac-choice-icon" aria-hidden="true">${x.icon}</span>`:''}<span>${esc(x.text)}</span></button>`).join('')}</div>`;
  const owned=uid=>state.mission.owned.includes(uid);
  function persist(){save({academyMissionVersion:2,mission:{...state.mission,owned:[...state.mission.owned],enemy:[...state.mission.enemy]},progressStep:state.step,progressDone:state.done});}
  function restored(x){
    const m=blank();if(!x||typeof x!=='object')return m;
    m.rolled=!!x.rolled;m.owned=[HERO,PARTNER].filter(uid=>Array.isArray(x.owned)&&x.owned.includes(uid));
    m.enemy=Array.isArray(x.enemy)&&x.enemy.includes(RIVAL)?[RIVAL]:[];
    m.link=!!x.link&&m.owned.length===2;
    m.leader=x.leader===PARTNER?PARTNER:HERO;
    m.scrollSelected=!!x.scrollSelected;
    m.scrollOwner=m.scrollSelected&&m.owned.includes(x.scrollOwner)?x.scrollOwner:null;
    m.arenaId=x.arenaId===ARENA?ARENA:null;return m;
  }
  function stageCopy(){
    const c=[
      ['ПРОЛОГ · ЖРЕБИЙ','Вы капитан отряда. Проведём одну связанную тренировочную миссию: каждое ваше решение сохранится на следующих этапах.','Кубики в этом первом примере дают 6 : 2; в настоящем матче жребий случайный.'],
      ['УРОК 1 ИЗ 6 · KEEP','Первым открывается ваш будущий союзник. Нажмите «Забрать» — он останется в отряде на протяжении всей миссии.','KEEP сохраняет открытую карту вам. Пять слотов команды заполняются в ходе настоящего драфта.'],
      ['УРОК 2 ИЗ 6 · PASS','Сейчас появилась карта соперника. Выбирайте осознанно: если передать её, она окажется у противника в учебной дуэли.','PASS передаёт бойца сопернику. Это не всегда лучший ход: оценивайте полезность карты для обеих сторон.'],
      ['УРОК 3 ИЗ 6 · СВЯЗЬ','Ваш следующий учебный выбор — союзник для первого бойца. Получите его и объедините пару в одну составную карту.','Пара «Два пути Team 7» действительно существует в базе игры. В полноценном режиме связывание подтверждается правилами сборки команды.'],
      ['УРОК 4 ИЗ 6 · СВИТОК','Свиток «Шуншин» даёт первому бойцу право первого удара. В этой миссии назначьте его выбранному лидеру пары.','Один свиток — один владелец и один заряд. Он не переходит автоматически к другому бойцу.'],
      ['УРОК 5 ИЗ 6 · АРЕНА','Определите арену. Полученное поле сохранится до дуэли и будет передано в реальный боевой расчёт.','Арена влияет на соответствие бойцов местности. Её преимущества не гарантируют победу.'],
      ['УРОК 6 ИЗ 6 · ДУЭЛЬ','Выберите бойца из собранной пары. Соперник уже открыл свою карту. Проверьте, кому назначен свиток и какая арена выпала.','Дуэль рассчитывает реальный движок. После неё разберём, что изменили свиток и арена, и проверим ваше понимание.'],
      ['МИССИЯ ЗАВЕРШЕНА','Вы прошли связанный учебный сценарий: от жребия до решения в бою. Следующая ступень — полный тренировочный матч 5×5.','Мини-миссия не меняет ELO, монеты или реальный игровой прогресс. Полный тренировочный матч — отдельная практика со всеми слотами.']
    ][state.step];return {eyebrow:c[0],intro:c[1],tip:c[2]};
  }
  function missionHud(){
    if(state.step===0||state.step===7)return '';
    const m=state.mission,slots=m.link?1:m.owned.length;
    const allies=m.owned.map(uid=>`<span class="ac-hud-fighter">${name(uid)}</span>`).join('')||'<span class="ac-hud-empty">Пока нет бойцов</span>';
    return `<div class="ac-mission-hud" data-expanded="${state.hudExpanded?'yes':'no'}" aria-label="Состояние учебной миссии">
      <div class="ac-hud-compact"><span>ОТРЯД: ${slots}/5 · CPU: ${m.enemy.length} · ${m.scrollOwner?'⚡':'—'} · ${m.arenaId?'🌲':'—'}</span><button type="button" data-ac-action="toggle-hud" aria-expanded="${state.hudExpanded?'true':'false'}">${state.hudExpanded?'СКРЫТЬ':'ДЕТАЛИ'} <span aria-hidden="true">${state.hudExpanded?'▴':'▾'}</span></button></div>
      <div class="ac-hud-details"><div><small>ВАШ ОТРЯД · ${slots} / 5 СЛОТОВ</small><strong>${allies}</strong></div><div><small>СОПЕРНИК</small><strong>${m.enemy.length?name(RIVAL):'Ожидает карту'}</strong></div><div><small>ПОДГОТОВКА</small><strong>${m.scrollOwner?'⚡ Свиток · '+name(m.scrollOwner):'Без свитка'}${m.arenaId?' · Лес скрытых троп':''}</strong></div></div></div>`;
  }
  function scene(){
    const m=state.mission;
    switch(state.step){
      case 0:return `<div class="ac-intro-scene"><div class="ac-seal" aria-hidden="true">忍</div><div class="ac-prologue-grid"><div class="ac-intro-card">${portrait(HERO,'ПЕРВЫЙ СОЮЗНИК','ac-intro-portrait')}</div><div class="ac-dice-panel"><span class="ac-mark">КТО ПЕРВЫМ ВЫБИРАЕТ?</span><div class="ac-dice-result"><div><small>ВЫ</small><strong>${m.rolled?'6':'?'}</strong></div><b>:</b><div><small>CPU</small><strong>${m.rolled?'2':'?'}</strong></div></div>${m.rolled?'<p class="ac-dice-success">✓ Первый выбор ваш</p>':buttons([{text:state.busy?'ЖДЁМ ЖРЕБИЙ…':'БРОСИТЬ КУБИКИ',action:'roll-init',primary:true,icon:'◈'}])}</div></div><div class="ac-intro-stats"><span><b>6</b> взаимосвязанных уроков</span><span><b>0</b> потерь рейтинга</span><span><b>1</b> учебная миссия</span></div></div>`;
      case 1:
      case 2:{
        const take=state.step===1,uid=take?HERO:RIVAL;
        return `<div class="ac-training-board"><div class="ac-score-line"><div class="ac-team"><small>ВАШ ОТРЯД</small><strong>${m.owned.length} бойц.</strong></div><span class="ac-versus">VS</span><div class="ac-team ac-enemy"><small>СОПЕРНИК</small><strong>${m.enemy.length} бойц.</strong></div></div><div class="ac-draft-surface">${portrait(uid,'ОТКРЫТАЯ КАРТА','ac-major-portrait')}<div class="ac-draft-info"><span class="ac-mark">ШАГ ДРАФТА</span><h3>${name(uid)}</h3><p>${take?'Этот союзник потребуется вам для следующего урока — связи персонажей.':'Эта карта действительно достанется сопернику в завершающей дуэли.'}</p>${state.done?`<div class="ac-verified">✓ ${take?'Боец в вашем отряде':'Карта передана сопернику'}</div>`:buttons([{text:'ЗАБРАТЬ · KEEP',action:'keep',primary:take,icon:'+'},{text:'ОТДАТЬ · PASS',action:'pass',primary:!take,icon:'→'}])}</div></div><div class="ac-rule-strip"><span>ВАША КОМАНДА ${m.owned.length}/5</span><span>ЦЕЛЬ: ${take?'ЗАБРАТЬ':'ПЕРЕДАТЬ'} КАРТУ</span></div></div>`;
      }
      case 3:{
        if(!owned(PARTNER))return `<div class="ac-training-board ac-lore-board"><div class="ac-bond-header"><span class="ac-mark">СЛЕДУЮЩАЯ КАРТА ДРАФТА</span><strong>Союзник для связи</strong><small>Вы получили ${name(HERO)} на первом шаге. Теперь дополните состав.</small></div><div class="ac-draft-surface">${portrait(PARTNER,'НОВАЯ КАРТА','ac-major-portrait')}<div class="ac-draft-info"><h3>${name(PARTNER)}</h3><p>Эта карта вместе с первой может образовать связь «Два пути Team 7».</p>${buttons([{text:'ЗАБРАТЬ СОЮЗНИКА',action:'recruit-partner',primary:true,icon:'+'}])}</div></div></div>`;
        return `<div class="ac-training-board ac-lore-board"><div class="ac-bond-header"><span class="ac-mark">ПАРНАЯ КАРТА · ДВА ПУТИ TEAM 7</span><strong>${m.link?'Связь собрана · 1 слот':'Выберите лидера связи'}</strong><small>Два полученных бойца могут представлять одну составную карту</small></div><div class="ac-bond-pair"><button class="ac-fighter-option ${m.link&&m.leader===HERO?'ac-picked':''}" type="button" data-ac-action="leader" data-ac-value="${HERO}" ${state.done?'disabled':''}>${portrait(HERO,'ПЕРВЫЙ СОЮЗНИК')}<strong>${name(HERO)}</strong><small>${m.link&&m.leader===HERO?'✓ ЛИДЕР':'НАЗНАЧИТЬ ЛИДЕРОМ'}</small></button><div class="ac-bond-mark" aria-hidden="true">+</div><button class="ac-fighter-option ${m.link&&m.leader===PARTNER?'ac-picked':''}" type="button" data-ac-action="leader" data-ac-value="${PARTNER}" ${state.done?'disabled':''}>${portrait(PARTNER,'ВТОРОЙ СОЮЗНИК')}<strong>${name(PARTNER)}</strong><small>${m.link&&m.leader===PARTNER?'✓ ЛИДЕР':'НАЗНАЧИТЬ ЛИДЕРОМ'}</small></button></div><div class="ac-bond-footer"><span class="ac-bond-chain">2 ПЕРСОНАЖА → 1 СЛОТ</span><p>${m.link?`Лидер: <b>${name(m.leader)}</b>. Его вы сможете использовать в учебной дуэли, а связь останется в вашем составе.`:'Выберите лидера — это влияет на последующее назначение свитка.'}</p></div></div>`;
      }
      case 4:return `<div class="ac-training-board ac-scroll-board"><div class="ac-scroll-path"><div class="ac-scroll-item ${m.scrollSelected?'ac-selected':''}"><span class="ac-scroll-icon" aria-hidden="true">⚡</span><b>ШУНШИН</b><small>Первый удар · 1 заряд</small><button type="button" data-ac-action="choose-scroll" ${m.scrollSelected?'disabled':''}>${m.scrollSelected?'✓ СВИТОК ВЫБРАН':'1. ВЫБРАТЬ СВИТОК'}</button></div><div class="ac-scroll-arrow" aria-hidden="true">→</div><div class="ac-scroll-item ac-scroll-target ${m.scrollOwner?'ac-selected':''}">${portrait(m.leader,'ЛИДЕР','ac-small-portrait')}<b>${name(m.leader)}</b><small>${m.scrollOwner?'⚡ Шуншин назначен':'Нет снаряжения'}</small><button type="button" data-ac-action="equip" ${!m.scrollSelected||state.done?'disabled':''}>${m.scrollOwner?'✓ НАЗНАЧЕНО':'2. НАЗНАЧИТЬ'}</button></div></div><div class="ac-rule-strip"><span>Только выбранному бойцу</span><span>1 заряд</span></div></div>`;
      case 5:return `<div class="ac-training-board ac-arena-board"><div class="ac-arena-visual ${state.busy?'ac-rolling':''}"><img src="assets/arenas/${m.arenaId?'hidden_forest':'open_expanse'}.webp" alt="${m.arenaId?'Лес скрытых троп':'Пример арены'}" decoding="async"><div class="ac-arena-overlay"><span class="ac-mark">${m.arenaId?'АРЕНА ВЫПАЛА':'ПЯТЬ ВАРИАНТОВ ПОЛЯ'}</span><strong>${m.arenaId?'ЛЕС СКРЫТЫХ ТРОП':'ОПРЕДЕЛИТЕ ПОЛЕ'}</strong><p>${m.arenaId?'Здесь ценятся сенсорика, контроль и скрытность. Эти условия войдут в расчёт дуэли.':'В тренировке покажем один заранее подготовленный результат.'}</p></div></div>${m.arenaId?'<div class="ac-verified">✓ Поле сохранено для следующего урока</div>':buttons([{text:state.busy?'ОПРЕДЕЛЯЕМ…':'ПРОКРУТИТЬ АРЕНУ',action:'arena-roll',primary:true,icon:'◈'}])}<div class="ac-rule-strip"><span>5 арен</span><span>Общие правила поля</span></div></div>`;
      case 6:{
        const selected=state.sub>=1,confirmed=state.sub>=2,finished=state.sub>=3;
        const mine=selected?state.chosen:m.leader;
        const r=state.duel;
        const resultLabel=r?(r.winnerUid===mine?'ВАШ БОЕЦ ВЫИГРАЛ':'СОПЕРНИК ВЫИГРАЛ'):'';
        const scrollActive=mine===m.scrollOwner;
        return `<div class="ac-training-board ac-battle-board"><div class="ac-combat-side"><div class="ac-combat-column"><span class="ac-mark">ВАША КАРТА</span>${portrait(mine,'ВАШ БОЕЦ','ac-combat-portrait')}<div class="ac-battle-status">${r?resultLabel:confirmed?'ВЫБОР ПОДТВЕРЖДЁН':selected?'БОЕЦ ВЫБРАН':'ВЫБЕРИТЕ БОЙЦА'}</div></div><span class="ac-combat-vs">VS</span><div class="ac-combat-column"><span class="ac-mark">КАРТА СОПЕРНИКА</span>${portrait(RIVAL,'СОПЕРНИК','ac-combat-portrait')}<div class="ac-battle-status">КАРТА ОТКРЫТА</div></div></div>
        <div class="ac-fight-context"><span>🌲 ${m.arenaId?'Лес скрытых троп':'Арена не выбрана'}</span><span>⚡ ${scrollActive?'Шуншин на выбранном бойце':'Шуншин назначен другому бойцу'}</span></div>
        ${!selected?`<p class="ac-choice-label">Выберите бойца. Свиток закреплён за ${name(m.scrollOwner)}.</p><div class="ac-battle-choices">${m.owned.map(uid=>`<button type="button" data-ac-action="choose-fighter" data-ac-value="${uid}">${img(uid,fighter(uid)?.name||uid)}<span>${name(uid)}${uid===m.scrollOwner?' · ⚡':''}</span></button>`).join('')}</div>`:''}
        ${selected&&!confirmed?buttons([{text:'2. ПОДТВЕРДИТЬ БОЙЦА',action:'confirm-fighter',primary:true,icon:'✓'},{text:'СМЕНИТЬ БОЙЦА',action:'change-fighter'}]):''}
        ${confirmed&&!finished?buttons([{text:'3. РАЗРЕШИТЬ ДУЭЛЬ',action:'fight',primary:true,icon:'⚔'}]):''}
        ${finished&&r?`<div class="ac-battle-result" role="status"><strong>${esc(resultLabel)}</strong><p>${esc(r.summary)}</p><div class="ac-result-facts"><div><b>БАЗОВАЯ МАТРИЦА</b><span>${name(r.baseWinnerUid)} ${r.baseSeverity!==null?'· состояние '+r.baseSeverity:''}</span></div><div><b>ИТОГ С ПОЛЕМ И СВИТКОМ</b><span>${name(r.winnerUid)} · состояние ${r.severity}</span></div><div><b>АРЕНА</b><span>${esc(r.arenaDetail)}</span></div><div><b>СВИТОК</b><span>${esc(r.scrollDetail)}</span></div><div><b>СВЯЗЬ</b><span>${esc(r.loreDetail)}</span></div></div></div>${!state.done?`<div class="ac-reflection"><strong>ПРОВЕРЬТЕ ПОНИМАНИЕ</strong><p>Если вы выбираете другого бойца, что происходит со свитком?</p>${buttons([{text:'Он автоматически перейдёт к выбранному',action:'reflect',value:'transfer'},{text:'Останется на назначенном владельце',action:'reflect',value:'owner'},{text:'Подействует сразу на всю команду',action:'reflect',value:'all'}])}</div>`:''}`:''}</div>`;
      }
      default:return `<div class="ac-complete-scene"><div class="ac-end-emblem" aria-hidden="true">忍</div><h3>ПЕРВАЯ МИССИЯ ВЫПОЛНЕНА</h3><p>Вы прошли путь от жребия до реальной учебной дуэли: сохранили бойцов, собрали связь, экипировали свиток и учли арену.</p><div class="ac-completed-grid"><span><b>6 / 6</b> связанных заданий</span><span><b>0</b> изменений Elo и монет</span></div><p class="ac-next-course">Следующий шаг — большой матч 5×5 со всеми правилами. Он остаётся отдельной практикой, а не продолжением этого короткого боя.</p>${buttons([{text:'ПОЛНЫЙ УЧЕБНЫЙ МАТЧ · С ТРЕНЕРОМ',action:'training',primary:true,icon:'⚔'},{text:'ВЫБРАТЬ РЕЖИМ ИГРЫ',action:'modes',icon:'▶'},{text:'ПОВТОРИТЬ АКАДЕМИЮ',action:'restart',icon:'↻'}])}</div>`;
    }
  }
  function render(opts={}){
    if(!state.active||!root)return;
    const oldMain=root.querySelector('.ac-main'),oldScroll=oldMain?.scrollTop||0;
    const oldFocus=root.contains(document.activeElement)?document.activeElement:null;
    const previousAction=oldFocus?.dataset?.acAction||'',previousValue=oldFocus?.dataset?.acValue||'';
    const step=state.step,info=stageCopy();
    const pct=step===7?100:Math.round(Math.max(0,step-1)/TOTAL*100);
    const nav=step===7?'':`<div class="ac-progress-nav" aria-label="Прогресс обучения">${TOPICS.map((topic,i)=>`<span class="${i===step?'now':i<step?'passed':''}" title="${esc(topic)}"><i></i><em>${esc(topic)}</em></span>`).join('')}</div>`;
    root.innerHTML=`<div class="ac-ambient" aria-hidden="true"><i></i><i></i><i></i></div><div class="ac-shell"><header class="ac-header"><div class="ac-brand"><span class="ac-brand-mark" aria-hidden="true">忍</span><div><small>ПЕРВАЯ МИССИЯ · V2</small><strong>АКАДЕМИЯ ШИНОБИ</strong></div></div><div class="ac-header-right"><span class="ac-chapter">${step===0?'ВВЕДЕНИЕ':step===7?'ГОТОВО':`${step} / ${TOTAL}`}</span><button type="button" class="ac-header-exit" data-ac-action="close" aria-label="Закрыть Академию">×</button></div></header><div class="ac-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс обучения"><span style="width:${pct}%"></span></div>${nav}
      ${missionHud()}
      <main class="ac-main"><section class="ac-teaching"><span class="ac-kicker">${esc(info.eyebrow)}</span><h2 id="academy-title">${esc(TITLES[step])}</h2><p class="ac-intro">${esc(info.intro)}</p><div class="ac-tip"><span aria-hidden="true">i</span><p>${esc(info.tip)}</p></div></section>${step<7&&!state.done?'<button class="ac-mobile-action-jump" type="button" data-ac-action="show-target">↓ К ДЕЙСТВИЮ</button>':''}<section class="ac-playground" aria-label="Интерактивное задание">${scene()}<div class="ac-feedback ${state.feedback?'visible':''}" role="status" aria-live="polite">${state.feedback?esc(state.feedback):''}</div></section></main>
      <footer class="ac-footer"><div class="ac-footer-left"><button type="button" data-ac-action="back" ${step===0?'disabled':''}>← НАЗАД</button><span>${step===7?'АКАДЕМИЯ ПРОЙДЕНА':state.done?'УРОК ПРОЙДЕН · МОЖНО ПРОДОЛЖИТЬ':'ВЫПОЛНИТЕ ДЕЙСТВИЕ НА ЭКРАНЕ'}</span></div><div class="ac-footer-actions">${step===7?'':state.done?`<button type="button" class="ac-primary" data-ac-action="next">${step===0?'НАЧАТЬ УРОКИ':step===TOTAL?'ЗАВЕРШИТЬ АКАДЕМИЮ':'СЛЕДУЮЩИЙ УРОК'} →</button>`:'<button type="button" class="ac-secondary" data-ac-action="hint">ПОДСКАЗКА</button>'}</div></footer>${step<7?'<div class="ac-bottom-exit"><button type="button" data-ac-action="skip">ПРОПУСТИТЬ ОБУЧЕНИЕ И ПЕРЕЙТИ К ИГРЕ</button></div>':''}</div>`;
    root.dataset.step=String(step);root.dataset.done=state.done?'yes':'no';
    const nextMain=root.querySelector('.ac-main');if(nextMain)nextMain.scrollTop=opts.resetScroll?0:oldScroll;
    if(previousAction&&!opts.resetScroll){const sel=`[data-ac-action="${previousAction}"]${previousValue?`[data-ac-value="${previousValue}"]`:''}`;const newer=root.querySelector(sel);if(newer&&!newer.disabled)try{newer.focus({preventScroll:true});}catch(_){}}
  }
  function resetFrom(n){
    const m=state.mission;
    if(n<=0){state.mission=blank();return;}
    if(n<=1){m.owned=[];m.enemy=[];m.link=false;m.leader=HERO;m.scrollSelected=false;m.scrollOwner=null;m.arenaId=null;return;}
    if(n<=2){m.enemy=[];m.owned=[HERO];m.link=false;m.leader=HERO;m.scrollSelected=false;m.scrollOwner=null;m.arenaId=null;return;}
    if(n<=3){m.owned=[HERO];m.enemy=[RIVAL];m.link=false;m.leader=HERO;m.scrollSelected=false;m.scrollOwner=null;m.arenaId=null;return;}
    if(n<=4){m.scrollSelected=false;m.scrollOwner=null;m.arenaId=null;return;}
    if(n<=5){m.arenaId=null;}
  }
  function go(n){
    if(state.timer)clearTimeout(state.timer);state.timer=null;
    const target=Math.max(0,Math.min(7,n));if(target<state.step)resetFrom(target);
    state.step=target;state.sub=0;state.busy=false;state.done=false;state.feedback='';state.duel=null;
    if(target!==7)persist();trace('step-change');render({resetScroll:true});
  }
  function complete(message){state.done=true;state.busy=false;state.feedback=message;persist();trace('step-complete');render();}
  function close(){if(!state.active)return false;if(state.timer)clearTimeout(state.timer);state.timer=null;persist();state.active=false;root?.remove();root=null;document.body?.classList.remove('academy-open');try{state.focusBefore?.focus?.({preventScroll:true});}catch(_){}trace('close');return true;}
  function open(opts={}){
    if(state.active)return true;
    if(document.body?.classList.contains('r34-training-active')||globalThis.R33_GUIDED_MATCH?.status?.().active)return false;
    try{const modal=$('r21-tutorial-modal');modal?.classList.add('hidden');modal?.setAttribute('aria-hidden','true');}catch(_){ }
    const p=load();const resumable=!opts.restart&&!completed()&&!skipped()&&p.academyMissionVersion===2;
    state.mission=resumable?restored(p.mission):blank();state.step=resumable?Math.max(0,Math.min(6,Number(p.progressStep)||0)):0;
    state.done=resumable&&state.step<6&&!!p.progressDone;state.hudExpanded=false;state.sub=0;state.busy=false;state.feedback='';state.duel=null;state.focusBefore=document.activeElement;
    state.active=true;root=document.createElement('div');root.className='academy-root';root.id='academy-root';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','academy-title');root.addEventListener('click',onClick);document.body.appendChild(root);document.body.classList.add('academy-open');render({resetScroll:true});
    try{root.querySelector('.ac-header-exit')?.focus({preventScroll:true});}catch(_){ }trace('open',{resumable});return true;
  }
  function finish(){save({completedAt:new Date().toISOString(),skipped:false,academyMissionVersion:2,progressStep:7,progressDone:true,mission:state.mission});trace('complete');try{if(typeof r21UpdateSettings==='function')r21UpdateSettings({tutorial:{dismissedFirstRun:true}});if(typeof r21UpdateFirstRunBanner==='function')r21UpdateFirstRunBanner();}catch(_){ }go(7);}
  function skipAndPlay(){save({skipped:true,progressStep:state.step,progressDone:state.done,academyMissionVersion:2,mission:state.mission});trace('skip');close();try{if(typeof r21UpdateSettings==='function')r21UpdateSettings({tutorial:{dismissedFirstRun:true}});if(typeof r21UpdateFirstRunBanner==='function')r21UpdateFirstRunBanner();}catch(_){ }return globalThis.APP_UI?.openModeSelect?.()||false;}
  function gatePlay(){if(state.active)return true;if(completed()||skipped())return globalThis.APP_UI?.openModeSelect?.()||false;return open();}
  function startTraining(){close();if(typeof globalThis.R34_GUIDED_SCENARIO?.start==='function')return globalThis.R34_GUIDED_SCENARIO.start();if(typeof globalThis.R33_GUIDED_MATCH?.start==='function')return globalThis.R33_GUIDED_MATCH.start();return false;}
  function realDuel(uid){
    try{
      if(typeof resolveCombat!=='function')return {ok:false,errorCode:'NO_COMBAT_RESOLVER'};
      const m=state.mission,scrollActive=m.scrollOwner===uid;
      const base=resolveCombat(uid,RIVAL,{phase:'ACADEMY_BASE',arenaContext:null,scrollContext:null});if(!base?.ok)return base;
      // Fresh resolver snapshots: no get/set on any live fighter's scroll or arena state.
      const arenaContext=typeof getArenaContext==='function'?getArenaContext(m.arenaId):{arenaId:m.arenaId};
      const scrollContext={fighterAUid:uid,fighterBUid:RIVAL,fighterA:{scrollId:scrollActive?'SHUNSHIN':null,effectId:scrollActive?'SWIFT_STRIKE':null,firstStrike:scrollActive,energyLock:false,suppressedOpponentCaps:[]},fighterB:{scrollId:null,effectId:null,firstStrike:false,energyLock:false,suppressedOpponentCaps:[]},resolverScrolls:[]};
      // Explicit one-time practice snapshot of a REAL lore pair. Never call
      // LORE_COMBAT.buildContext/ensure/commit: those manage live match charges.
      const pair=typeof LORE_CARDS!=='undefined'?LORE_CARDS.find(c=>c.kind==='pair'&&c.members?.length===2&&c.members.includes(HERO)&&c.members.includes(PARTNER)):null;
      const loreContext=pair&&m.link?{
        firstPlacer:2,counterPickerPlayer:1,arenaContext,scrollContext,preDuelScrollOwners:[],
        fighterA:{player:1,fighterUid:uid,card:pair,chargesRemaining:1,entryState:0,arenaFit:null,fighterArenaFit:null},
        fighterB:{player:2,fighterUid:RIVAL,card:null,chargesRemaining:0,entryState:0,arenaFit:null,fighterArenaFit:null}
      }:null;
      const r=resolveCombat(uid,RIVAL,{phase:'ACADEMY_PRACTICE',arenaContext,scrollContext,loreContext});if(!r?.ok)return r;
      const arenaRow=(r.arenaEffect?.trace||[]).find(t=>t.stage==='ARENA_ANALYSIS');
      const scrollRow=(r.scrollEffect?.trace||[]).find(t=>t.stage==='SCROLL_RESOLVER');
      const arenaDetail=r.arenaContextApplied?`Оценка соответствия: ваш боец ${arenaRow?.fighterAScore??'—'}, соперник ${arenaRow?.fighterBScore??'—'}; ${r.arenaEffectApplied?'изменила исход или состояние':'победителя и состояние не изменила'}`:'Нет эффекта';
      const scrollDetail=scrollActive?`Шуншин активирован (первый удар); давление ${scrollRow?.fighterAPressure??'—'}; ${r.scrollOverrideApplied?'изменил победителя':'победитель не изменился'}`:'Не активирован: выбран другой боец';
      const loreDetail=r.loreEffect?.active?(r.loreEffect.usedCard?`Связь «${pair?.title||'Два пути Team 7'}» помогла по правилам движка (в учебной миссии заряд не списывается)`:`Связь «${pair?.title||'Два пути Team 7'}» учтена, но не потребовала срабатывания бонуса`):'Эффект связи не сработал';
      return {ok:true,winnerUid:r.winnerUid,baseWinnerUid:base.winnerUid,baseSeverity:base.winnerExitSeverity,severity:r.winnerExitSeverity,arenaDetail,scrollDetail,loreDetail,loreApplied:!!r.loreEffect?.active,scrollActive,arenaApplied:r.arenaContextApplied,scrollApplied:r.scrollEffectApplied,summary:base.winnerUid!==r.winnerUid?'Условия подготовки изменили победителя по правилам движка.':'Победитель остался тем же. Но подготовка могла повлиять на состояние бойца и преимущество в дуэли.'};
    }catch(e){return {ok:false,errorCode:String(e?.message||e).slice(0,120)};}
  }
  function action(a,value){
    if(a==='toggle-hud'){state.hudExpanded=!state.hudExpanded;render();return;}
    if(a==='show-target'){
      const btn=root?.querySelector('.ac-playground button[data-ac-action]:not([disabled])');if(btn){btn.scrollIntoView({block:'center',inline:'nearest',behavior:prefReduced()?'instant':'smooth'});try{btn.focus({preventScroll:true});}catch(_){}}
      return;
    }
    if(a==='close'){close();return;}if(a==='skip'){skipAndPlay();return;}
    if(a==='restart'){state.mission=blank();go(0);return;}
    if(a==='modes'){close();globalThis.APP_UI?.openModeSelect?.();return;}
    if(a==='training'){startTraining();return;}
    if(a==='back'){if(state.step>0)go(state.step-1);return;}
    if(a==='hint'){
      const hints={0:'Бросьте кубики: этот учебный жребий определён заранее.',1:'Нажмите KEEP, чтобы сохранить первого бойца для будущей связки.',2:'Нажмите PASS: эта карта станет соперником в дуэли.',3:owned(PARTNER)?'Выберите лидера связки; ему мы назначим свиток.':'Заберите вторую карту: она нужна для связи.',4:state.mission.scrollSelected?'Назначьте свиток выбранному лидеру.':'Сначала выберите свиток Шуншин.',5:'Прокрутите поле: в этом примере выпадет Лес скрытых троп.',6:state.sub===0?'Выберите бойца. Подумайте, на ком свиток.':state.sub===1?'Подтвердите выбор или смените бойца.':state.sub===2?'Нажмите «Разрешить дуэль».':'Вспомните: свиток закреплён за конкретным бойцом, а не за всей командой.'};
      state.feedback=hints[state.step]||'Прочитайте цель урока.';render();return;
    }
    if(a==='next'){if(state.done){if(state.step===TOTAL)finish();else go(state.step+1);}return;}
    if(state.done||state.busy)return;
    const m=state.mission;
    if(state.step===0&&a==='roll-init'){
      state.busy=true;state.feedback='Подбрасываем кубики…';render();state.timer=setTimeout(()=>{if(!state.active||state.step!==0)return;m.rolled=true;complete('Жребий 6 : 2. Первый выбор ваш — отправляемся собирать отряд.');},prefReduced()?100:450);return;
    }
    if((state.step===1||state.step===2)&&(a==='keep'||a==='pass')){
      const expect=state.step===1?'keep':'pass';if(a!==expect){state.feedback=expect==='keep'?'Это PASS: он отдаст нужного союзника. Сейчас используйте KEEP.':'Это KEEP: карта достанется вам. В этом упражнении используйте PASS.';trace('recoverable-mistake',{action:a});render();return;}
      if(a==='keep'&&!owned(HERO))m.owned.push(HERO);if(a==='pass'&&!m.enemy.includes(RIVAL))m.enemy.push(RIVAL);
      complete(a==='keep'?'Вы сохранили союзника; он будет доступен дальше в миссии.':'Карта передана CPU: это будет ваш противник в конце миссии.');return;
    }
    if(state.step===3){
      if(a==='recruit-partner'&&!owned(PARTNER)){m.owned.push(PARTNER);state.sub=1;state.feedback='У вас два союзника. Теперь назначьте лидера парной карты.';persist();render();return;}
      if(a==='leader'&&owned(PARTNER)&&(value===HERO||value===PARTNER)){
        // Confirm the actual pair exists in the game; do not fabricate a composite card.
        const found=typeof LORE_CARDS!=='undefined'&&LORE_CARDS.some(c=>c.kind==='pair'&&c.members?.length===2&&c.members.includes(HERO)&&c.members.includes(PARTNER));
        if(!found){state.feedback='Связь не найдена в базе игры. Нельзя продолжать с вымышленной комбинацией.';render();return;}
        m.link=true;m.leader=value;complete('Парная карта готова. Она занимает один слот и сохранится до дуэли.');return;
      }
    }
    if(state.step===4){if(a==='choose-scroll'&&!m.scrollSelected){m.scrollSelected=true;state.feedback='Свиток выбран. Назначьте его лидеру справа.';persist();render();return;}
      if(a==='equip'&&m.scrollSelected&&!m.scrollOwner){m.scrollOwner=m.leader;complete('Свиток назначен выбранному лидеру; другие бойцы не получат его автоматически.');return;}}
    if(state.step===5&&a==='arena-roll'){
      state.busy=true;state.feedback='Определяем арену…';render();state.timer=setTimeout(()=>{if(!state.active||state.step!==5)return;m.arenaId=ARENA;complete('Выпал Лес скрытых троп. Сравнение бойцов на этом поле состоится в следующей дуэли.');},prefReduced()?100:540);return;
    }
    if(state.step===6){
      if(a==='choose-fighter'&&m.owned.includes(value)&&state.sub===0){state.chosen=value;state.sub=1;state.feedback=value===m.scrollOwner?'Вы выбрали владельца свитка. Его эффект сработает.':'Вы выбрали бойца без свитка. Это разрешено — оцените риск.';render();return;}
      if(a==='change-fighter'&&state.sub===1){state.sub=0;state.feedback='Выберите другого бойца.';render();return;}
      if(a==='confirm-fighter'&&state.sub===1){state.sub=2;state.feedback='Выбор зафиксирован. Посмотрите на подготовку и проведите дуэль.';render();return;}
      if(a==='fight'&&state.sub===2){const r=realDuel(state.chosen);trace('resolver-demo',{ok:!!r?.ok,errorCode:r?.errorCode||null});if(!r?.ok){state.feedback='Движок не смог рассчитать бой: '+(r?.errorCode||'неизвестная ошибка');render();return;}state.duel=r;state.sub=3;state.feedback='Результат получен от настоящего движка. Прочитайте разбор и ответьте на вопрос.';render();return;}
      if(a==='reflect'&&state.sub===3){if(value==='owner'){complete('Верно! Свиток сохраняется у назначенного бойца. Вы умеете учитывать подготовку, а не просто нажимать кнопки.');}else{state.feedback='Подумайте, на какого бойца вы назначили свиток. Заряд не переносится к другому участнику пары.';trace('recoverable-mistake',{action:'reflect'});render();}return;}
    }
  }
  function onClick(e){const b=e.target?.closest?.('[data-ac-action]');if(!b||b.disabled||!root?.contains(b))return;e.preventDefault();e.stopPropagation();action(b.dataset.acAction,b.dataset.acValue);}
  function onKeyDown(e){if(!state.active||!root)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}if(e.key!=='Tab')return;const list=[...root.querySelectorAll('button:not([disabled])')].filter(b=>b.getClientRects().length);if(!list.length)return;const i=list.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();list[list.length-1].focus();}else if(!e.shiftKey&&(i===list.length-1||i<0)){e.preventDefault();list[0].focus();}}
  function audit(){const missing=state.active?['academy-root','academy-title'].filter(id=>!$(id)):[];return Object.freeze({version:VERSION,active:state.active,step:state.step,sub:state.sub,total:TOTAL,done:state.done,completed:completed(),skipped:skipped(),missing,mission:JSON.parse(JSON.stringify(state.mission)),duel:state.duel?{...state.duel}:null,profileWrites:0,onlineWrites:0,events:[...state.events.slice(-14)]});}
  document.addEventListener('keydown',onKeyDown,true);
  globalThis.SHINOBI_ACADEMY=Object.freeze({version:VERSION,open,close,gatePlay,skipAndPlay,startTraining,audit,completed,reset:()=>{save({completedAt:null,skipped:false,academyMissionVersion:2,progressStep:0,progressDone:false,mission:blank()});if(state.active){state.mission=blank();go(0);return true;}return open({restart:true});}});
})();
