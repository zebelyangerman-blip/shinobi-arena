/* SHINOBI ACADEMY V1 — interactive first-run onboarding.
 * Independent training sandbox: no writes to combat, online, economy, Elo or match state.
 * Only calls resolveCombat() as a read-only demonstration on existing database fighters.
 */
(function () {
  'use strict';
  const VERSION = '1.0.0';
  const KEY = 'shinobi_academy_progress_v1';
  const TOTAL = 6;
  const HERO = 'fighter_003';
  const PARTNER = 'fighter_004';
  const RIVAL = 'fighter_073';
  const TITLES = [
    'Добро пожаловать в Академию',
    'Соберите свой первый отряд',
    'Передайте карту сопернику',
    'Откройте связь персонажей',
    'Подготовьте тактический свиток',
    'Узнайте, как работает арена',
    'Проведите первую дуэль',
    'Вы готовы к настоящей миссии'
  ];
  const TOPICS = ['Начало', 'Забрать', 'Передать', 'Связь', 'Свиток', 'Арена', 'Дуэль'];
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {active:false,step:0,sub:0,done:false,busy:false,feedback:'',chosen:HERO,leader:HERO,duel:null,events:[],focusBefore:null,timer:null};
  let root = null;
  let sessionProgress = {};
  const load = () => {try {const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x && x.schema===1?x:sessionProgress;}catch(_){return sessionProgress;}};
  const save = patch => {sessionProgress={...load(),...patch,schema:1};try{localStorage.setItem(KEY,JSON.stringify(sessionProgress));return true;}catch(_){return false;}};
  const hasCompleted = () => !!load().completedAt;
  const bypassed = () => !!load().skipped;
  const prefReduced = () => {try{return matchMedia('(prefers-reduced-motion: reduce)').matches || document.body?.dataset.r21Motion==='reduced';}catch(_){return false;}};
  const trace = (type,extra={}) => {state.events.push({type,step:state.step,at:Date.now(),...extra});if(state.events.length>80)state.events.shift();};
  const fighter = uid => {try {return typeof getFighterByUid === 'function' ? getFighterByUid(uid) : null;}catch(_){return null;}};
  const name = (uid,fallback) => esc(fighter(uid)?.name || fallback);
  const art = uid => 'assets/portraits/'+encodeURIComponent(String(uid).replace(/[^a-zA-Z0-9_]/g,''))+'.webp';
  const img = (uid,alt='',className='') => `<img class="${className}" src="${art(uid)}" alt="${esc(alt)}" loading="eager" decoding="async">`;
  const friendly = (uid,other='Шиноби') => `<span class="ac-fighter-name">${name(uid,other)}</span>`;
  const portrait = (uid,label='',extra='') => `<div class="ac-portrait ${extra}">${img(uid, label||fighter(uid)?.name||'Боец')}<div class="ac-portrait-label">${esc(label||fighter(uid)?.name||'Боец')}</div></div>`;
  const locked = () => state.done;
  const buttons = (arr) => `<div class="ac-options">${arr.map(x=>`<button type="button" class="ac-choice ${x.primary?'ac-choice-primary':''} ${x.kind||''}" data-ac-action="${esc(x.action)}" ${x.value?`data-ac-value="${esc(x.value)}"`:''} ${state.busy?'disabled':''}>${x.icon?`<span class="ac-choice-icon" aria-hidden="true">${x.icon}</span>`:''}<span>${esc(x.text)}</span></button>`).join('')}</div>`;
  function stageCopy(){
    switch(state.step){
      case 0: return {eyebrow:'ПРОЛОГ · ВАША РОЛЬ И ЖРЕБИЙ',intro:'Вы — капитан отряда. Первый шаг в игре — жребий: бросьте кубики и узнайте, кто первым выбирает бойца.',tip:'Это учебный бросок 6 : 2. В настоящем матче оба кубика случайны, а наказаний за ошибки в Академии нет.'};
      case 1: return {eyebrow:'УРОК 1 ИЗ 6 · ДРАФТ',intro:'Перед вами открытая карта. Кнопка «ЗАБРАТЬ» отправляет бойца в вашу команду. Соберите своего первого бойца.',tip:'В матче вы и соперник постепенно заполняете пять карточных слотов. Изучите только одно действие — забрать.'};
      case 2: return {eyebrow:'УРОК 2 ИЗ 6 · ДРАФТ',intro:'Не всякая открытая карта должна остаться у вас. Нажмите «ОТДАТЬ», чтобы отправить следующего бойца сопернику.',tip:'KEEP = забрать себе. PASS = отдать сопернику. В настоящем драфте оба варианта могут быть полезны.'};
      case 3: return {eyebrow:'УРОК 3 ИЗ 6 · СВЯЗИ',intro:'Некоторые знакомые союзники автоматически образуют составную карту. Для такой карты выберите лидера: он участвует в базовом поединке.',tip:'Участники связки не превращаются в отдельных бойцов на поле: одна составная карта занимает один слот. Дополнительные эффекты объясняются по мере игры.'};
      case 4: return {eyebrow:'УРОК 4 ИЗ 6 · СНАРЯЖЕНИЕ',intro:'Перед боем игрок получает набор тактических свитков. Сначала возьмите свиток, потом назначьте его бойцу.',tip:'Свиток не обязателен. На бойце может быть максимум один свиток, каждый с одним зарядом. В этой тренировке ресурсы не тратятся.'};
      case 5: return {eyebrow:'УРОК 5 ИЗ 6 · АРЕНА',intro:'Поле боя влияет на тактику. Попробуйте прокрутить арену и посмотрите выпавшее поле.',tip:'В обычном матче поле выбирается случайной прокруткой, а не вручную. Здесь для ясности показан один учебный результат.'};
      case 6: return {eyebrow:'УРОК 6 ИЗ 6 · БОЙ',intro:'Выберите бойца, подтвердите выбор и запустите дуэль. Соперник уже открыл свою карту — вы можете подобрать контрпик.',tip:'Итог рассчитывается реальной базовой системой противостояний. В полном матче дополнительно учитываются усталость, свитки, арена и связи.'};
      default: return {eyebrow:'ЗАДАНИЯ ПРОЙДЕНЫ',intro:'Теперь вы умеете принимать ключевые решения. Следующий шаг — настоящий матч с тренером, который проведёт через все пять слотов.',tip:'Сложные детали не нужно запоминать заранее. Обучение можно открыть снова из штаба или настроек.'};
    }
  }
  function scene(){
    switch(state.step){
      case 0: return `<div class="ac-intro-scene"><div class="ac-seal" aria-hidden="true">忍</div><div class="ac-prologue-grid"><div class="ac-intro-card">${portrait(HERO,'ВАШ ПЕРВЫЙ БОЕЦ','ac-intro-portrait')}</div><div class="ac-dice-panel"><span class="ac-mark">КТО ХОДИТ ПЕРВЫМ?</span><div class="ac-dice-result"><div><small>ВЫ</small><strong>${state.done?'6':'?'}</strong></div><b>:</b><div><small>CPU</small><strong>${state.done?'2':'?'}</strong></div></div>${state.done?'<p class="ac-dice-success">✓ Вы выбираете первым</p>':buttons([{text:state.busy?'БРОСАЕМ…':'БРОСИТЬ КУБИКИ',action:'roll-init',primary:true,icon:'◈'}])}</div></div><div class="ac-intro-stats"><span><b>6</b> простых заданий</span><span><b>0</b> потерь рейтинга</span><span><b>5×5</b> освоите позже</span></div></div>`;
      case 1:
      case 2: {
        const keep = state.step===1,uid=keep?HERO:RIVAL;
        return `<div class="ac-training-board"><div class="ac-score-line"><div class="ac-team"><small>ВАШ ОТРЯД</small><strong>${keep?(state.done?'1':'0'):'1'} / 5</strong></div><span class="ac-versus">VS</span><div class="ac-team ac-enemy"><small>СОПЕРНИК</small><strong>${keep?'0':(state.done?'1':'0')} / 5</strong></div></div>
          <div class="ac-draft-surface">${portrait(uid,keep?'ОТКРЫТАЯ КАРТА':'НОВЫЙ БОЕЦ','ac-major-portrait')}<div class="ac-draft-info"><span class="ac-mark">ОТКРЫТАЯ КАРТА</span><h3>${name(uid,'Боец')}</h3><p>${keep?'Цель: заберите бойца в свой отряд.':'Цель: отдайте бойца сопернику.'}</p>${state.done?`<div class="ac-verified"><span aria-hidden="true">✓</span>${keep?'Боец добавлен в ваш отряд':'Боец отправлен сопернику'}</div>`:buttons([{text:'ЗАБРАТЬ · KEEP',action:'keep',primary:keep,icon:'+'},{text:'ОТДАТЬ · PASS',action:'pass',primary:!keep,icon:'→'}])}</div></div>
          <div class="ac-rule-strip"><span>ВАША КОМАНДА ${keep?(state.done?'1':'0'):'1'}/5</span><span>${keep?'ЗАБРАТЬ':'ОТДАТЬ'} КАРТУ</span><span>РЕШЕНИЕ БЕЗ ТАЙМЕРА</span></div></div>`;
      }
      case 3: return `<div class="ac-training-board ac-lore-board"><div class="ac-bond-header"><span class="ac-mark">СОСТАВНАЯ КАРТА · TEAM 7</span><strong>ДВА ПУТИ</strong><small>Выберите лидера — это реальное решение перед матчем</small></div><div class="ac-bond-pair">
        <button class="ac-fighter-option ${state.done&&state.leader===HERO?'ac-picked':''}" type="button" data-ac-action="leader" data-ac-value="${HERO}" ${state.done?'disabled':''}>${portrait(HERO,'НАРУТО')}<strong>${name(HERO,'Наруто')}</strong><small>${state.done&&state.leader===HERO?'ВЫБРАН ЛИДЕРОМ':'ВЫБРАТЬ ЛИДЕРОМ'}</small></button>
        <div class="ac-bond-mark" aria-hidden="true">+</div><button class="ac-fighter-option ${state.done&&state.leader===PARTNER?'ac-picked':''}" type="button" data-ac-action="leader" data-ac-value="${PARTNER}" ${state.done?'disabled':''}>${portrait(PARTNER,'САСКЕ')}<strong>${name(PARTNER,'Саске')}</strong><small>${state.done&&state.leader===PARTNER?'ВЫБРАН ЛИДЕРОМ':'ВЫБРАТЬ ЛИДЕРОМ'}</small></button>
        </div><div class="ac-bond-footer"><span class="ac-bond-chain">1 КАРТА · 1 СЛОТ</span><p>${state.done?`Лидер выбран: <b>${name(state.leader,'Боец')}</b>. Остальные участники помогают эффектами связи.`:'Связь появляется автоматически, если в отряде есть подходящие бойцы.'}</p></div></div>`;
      case 4: return `<div class="ac-training-board ac-scroll-board"><div class="ac-scroll-path"><div class="ac-scroll-item ${state.sub>=1?'ac-selected':''}"><span class="ac-scroll-icon" aria-hidden="true">⚡</span><b>ШУНШИН</b><small>1 заряд · первый удар</small><button type="button" data-ac-action="choose-scroll" ${state.sub!==0?'disabled':''}>${state.sub>=1?'СВИТОК ВЫБРАН':'1. ВЫБРАТЬ СВИТОК'}</button></div><div class="ac-scroll-arrow" aria-hidden="true">→</div><div class="ac-scroll-item ac-scroll-target ${state.done?'ac-selected':''}">${portrait(HERO,'ВАШ БОЕЦ','ac-small-portrait')}<b>${name(HERO,'Наруто')}</b><small>${state.done?'Шуншин назначен':'Пустой слот свитка'}</small><button type="button" data-ac-action="equip" ${state.sub!==1||state.done?'disabled':''}>${state.done?'✓ НАЗНАЧЕНО':'2. НАЗНАЧИТЬ'}</button></div></div><div class="ac-rule-strip"><span>СВИТОК НЕОБЯЗАТЕЛЕН</span><span>1 НА БОЙЦА</span><span>1 ЗАРЯД</span></div></div>`;
      case 5: return `<div class="ac-training-board ac-arena-board"><div class="ac-arena-visual ${state.busy?'ac-rolling':''}"><img src="assets/arenas/${state.done?'hidden_forest':'open_expanse'}.webp" alt="${state.done?'Лес скрытых троп':'Пример арены'}" decoding="async"><div class="ac-arena-overlay"><span class="ac-mark">${state.done?'УЧЕБНЫЙ РЕЗУЛЬТАТ':'ПЯТЬ АРЕН'}</span><strong>${state.done?'ЛЕС СКРЫТЫХ ТРОП':'КАКАЯ АРЕНА ВЫПАДЕТ?'}</strong><p>${state.done?'Скрытность, сенсорика и контроль особенно полезны.':'Поле выбирается случайной прокруткой.'}</p></div></div>${state.done?'<div class="ac-verified">✓ Вы видите арену до выбора бойцов</div>':buttons([{text:state.busy?'АРЕНА ОПРЕДЕЛЯЕТСЯ…':'ПРОКРУТИТЬ АРЕНУ',action:'arena-roll',primary:true,icon:'◈'}])}<div class="ac-rule-strip"><span>5 РАЗНЫХ ПОЛЕЙ</span><span>ОДНО НА ВЕСЬ МАТЧ</span></div></div>`;
      case 6: {
        const selected = state.sub>=1,confirmed = state.sub>=2,finished=state.done;
        const u = state.chosen;
        const result=state.duel;
        const resultLabel=finished?(result?.ok?(result.winnerUid===u?'ВАШ БОЕЦ ВЫИГРАЛ ДУЭЛЬ':'СОПЕРНИК ВЫИГРАЛ ДУЭЛЬ'):'РАСЧЁТ НЕ ЗАВЕРШЁН'):'';
        return `<div class="ac-training-board ac-battle-board"><div class="ac-combat-side"><div class="ac-combat-column"><span class="ac-mark">ВАШ ВЫБОР</span>${portrait(selected?u:HERO,'ИГРОК 1','ac-combat-portrait')}<div class="ac-battle-status">${finished?resultLabel:confirmed?'ВЫБОР ПОДТВЕРЖДЁН':selected?'БОЕЦ ВЫБРАН':'ВЫБЕРИТЕ БОЙЦА'}</div></div><span class="ac-combat-vs">VS</span><div class="ac-combat-column"><span class="ac-mark">ОТКРЫТАЯ КАРТА CPU</span>${portrait(RIVAL,'СОПЕРНИК','ac-combat-portrait')}<div class="ac-battle-status">ГОТОВ К БОЮ</div></div></div>
        ${!selected?`<div class="ac-choice-label">1. ВЫБЕРИТЕ ОДНОГО БОЙЦА</div><div class="ac-battle-choices"><button type="button" data-ac-action="choose-fighter" data-ac-value="${HERO}">${img(HERO,'Наруто')}<span>${name(HERO,'Наруто')}</span></button><button type="button" data-ac-action="choose-fighter" data-ac-value="${PARTNER}">${img(PARTNER,'Саске')}<span>${name(PARTNER,'Саске')}</span></button></div>`:''}
        ${selected&&!confirmed?buttons([{text:'2. ПОДТВЕРДИТЬ БОЙЦА',action:'confirm-fighter',primary:true,icon:'✓'},{text:'СМЕНИТЬ',action:'change-fighter'}]):''}
        ${confirmed&&!finished?buttons([{text:'3. РАЗРЕШИТЬ ДУЭЛЬ',action:'fight',primary:true,icon:'⚔'}]):''}
        ${finished?`<div class="ac-battle-result" role="status"><strong>${esc(resultLabel)}</strong><p>Результат вычислен боевым движком на основе базового взаимодействия этих бойцов. Тренировочный результат не записан в статистику.</p></div>`:''}
        </div>`;
      }
      default: return `<div class="ac-complete-scene"><div class="ac-end-emblem" aria-hidden="true">忍</div><h3>МИССИЯ ВЫПОЛНЕНА</h3><p>Теперь вы знаете, что делают KEEP и PASS, как выбрать лидера, назначить свиток, определить арену и провести поединок.</p><div class="ac-completed-grid"><span><b>6 / 6</b> практических заданий</span><span><b>0</b> изменений Elo и монет</span></div>${buttons([{text:'ПОЛНЫЙ УЧЕБНЫЙ МАТЧ · С ТРЕНЕРОМ',action:'training',primary:true,icon:'⚔'},{text:'ВЫБРАТЬ РЕЖИМ ИГРЫ',action:'modes',icon:'▶'},{text:'ПОВТОРИТЬ АКАДЕМИЮ',action:'restart',icon:'↻'}])}</div>`;
    }
  }
  function render(){
    if(!root||!state.active)return;
    const step=state.step,info=stageCopy();
    const pct=step===7?100:Math.round(Math.max(0,step-1)/TOTAL*100);
    const nav=step===7?'':`<div class="ac-progress-nav" aria-label="Прогресс обучения">${TOPICS.map((topic,i)=>`<span class="${i===step?'now':i<step?'passed':''}" title="${esc(topic)}"><i></i><em>${esc(topic)}</em></span>`).join('')}</div>`;
    root.innerHTML=`<div class="ac-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
       <div class="ac-shell"><header class="ac-header"><div class="ac-brand"><span class="ac-brand-mark" aria-hidden="true">忍</span><div><small>ПЕРВАЯ МИССИЯ</small><strong>АКАДЕМИЯ ШИНОБИ</strong></div></div><div class="ac-header-right"><span class="ac-chapter">${step===0?'ВВЕДЕНИЕ':step===7?'ГОТОВО':`${step} / ${TOTAL}`}</span><button type="button" class="ac-header-exit" data-ac-action="close" aria-label="Закрыть Академию">×</button></div></header>
       <div class="ac-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс обучения"><span style="width:${pct}%"></span></div>
       ${nav}<main class="ac-main"><section class="ac-teaching"><span class="ac-kicker">${esc(info.eyebrow)}</span><h2 id="academy-title">${esc(TITLES[step])}</h2><p class="ac-intro">${esc(info.intro)}</p><div class="ac-tip"><span aria-hidden="true">i</span><p>${esc(info.tip)}</p></div>${step>0&&step<7?`<div class="ac-why">${step===1?'Начните с одного понятного выбора. Сложные параметры карт пока не нужны.':step===2?'Вы сами решаете, кому достанется открытая карта.':step===3?'При сборе всей Team 7 можно улучшить составную карту; это изучим позже.':step===4?'В обычном матче свитки назначаются после завершения драфта.':step===5?'Поле действует на весь матч. Состав и выбранные техники имеют значение.':'Выбирающий вторым может ответить на уже открытого противника.'}</div>`:''}</section>${step<7&&!state.done?'<button class="ac-mobile-action-jump" type="button" data-ac-action="show-target">↓ ПОКАЗАТЬ ДЕЙСТВИЕ НА ЭКРАНЕ</button>':''}<section class="ac-playground" aria-label="Интерактивное задание">${scene()}<div class="ac-feedback ${state.feedback?'visible':''}" role="status" aria-live="polite">${state.feedback?esc(state.feedback):''}</div></section></main>
       <footer class="ac-footer"><div class="ac-footer-left"><button type="button" data-ac-action="back" ${step<=0?'disabled':''}>← НАЗАД</button><span>${step===0?'СТАРТ':step===7?'АКАДЕМИЯ ПРОЙДЕНА':state.done?'УРОК ПРОЙДЕН · МОЖНО ПРОДОЛЖИТЬ':'ВЫПОЛНИТЕ ДЕЙСТВИЕ НА ЭКРАНЕ'}</span></div><div class="ac-footer-actions">${step===0?(state.done?'<button type="button" class="ac-primary" data-ac-action="next">НАЧАТЬ 6 УРОКОВ →</button>':'<button type="button" class="ac-secondary" data-ac-action="hint">ПОДСКАЗКА</button>'):step===7?'':state.done?`<button type="button" class="ac-primary" data-ac-action="next">${step===TOTAL?'ЗАВЕРШИТЬ АКАДЕМИЮ':'СЛЕДУЮЩИЙ УРОК'} →</button>`:'<button type="button" class="ac-secondary" data-ac-action="hint">ПОДСКАЗКА</button>'}</div></footer>
       ${step<7?'<div class="ac-bottom-exit"><button type="button" data-ac-action="skip">ПРОПУСТИТЬ ОБУЧЕНИЕ И ПЕРЕЙТИ К ИГРЕ</button></div>':''}
       </div>`;
    root.dataset.step=String(step);
    root.dataset.done=state.done?'yes':'no';
    const progress = root.querySelector('.ac-shell');
    if(progress)progress.scrollTop=0;
  }
  function go(n){clearTimeout(state.timer);state.timer=null;state.step=Math.max(0,Math.min(7,n));state.sub=0;state.busy=false;state.done=false;state.feedback='';state.duel=null;save({progressStep:state.step});trace('step-change');render();}
  function complete(message){state.done=true;state.busy=false;state.feedback=message;trace('step-complete');render();}
  function close(){if(!state.active)return false;clearTimeout(state.timer);state.timer=null;state.active=false;root?.remove();root=null;document.body?.classList.remove('academy-open');try{state.focusBefore?.focus?.({preventScroll:true});}catch(_){}trace('close');return true;}
  function open(opts={}){
    if(state.active)return true;
    if(document.body?.classList.contains('r34-training-active') || globalThis.R33_GUIDED_MATCH?.status?.().active)return false;
    try{document.getElementById('r21-tutorial-modal')?.classList.add('hidden');document.getElementById('r21-tutorial-modal')?.setAttribute('aria-hidden','true');}catch(_){}
    const progress=load();state.step=opts.restart?0:(!hasCompleted()&&!bypassed()?Math.min(6,Math.max(0,Number(progress.progressStep)||0)):0);
    state.active=true;state.sub=0;state.done=false;state.feedback='';state.busy=false;state.duel=null;state.focusBefore=document.activeElement;
    root=document.createElement('div');root.className='academy-root';root.id='academy-root';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','academy-title');
    root.addEventListener('click',onClick);document.body.appendChild(root);document.body.classList.add('academy-open');render();
    root.querySelector('.ac-header-exit')?.focus({preventScroll:true});trace('open');return true;
  }
  function finish(){save({completedAt:new Date().toISOString(),skipped:false,progressStep:7});trace('complete');try{if(typeof r21UpdateSettings==='function')r21UpdateSettings({tutorial:{dismissedFirstRun:true}});if(typeof r21UpdateFirstRunBanner==='function')r21UpdateFirstRunBanner();}catch(_){ }go(7);}
  function skipAndPlay(){save({skipped:true,progressStep:state.step});trace('skip');close();try{if(typeof r21UpdateSettings==='function')r21UpdateSettings({tutorial:{dismissedFirstRun:true}});if(typeof r21UpdateFirstRunBanner==='function')r21UpdateFirstRunBanner();}catch(_){}return globalThis.APP_UI?.openModeSelect?.()||false;}
  function gatePlay(){if(state.active)return true;/* Earlier slideshow completion is not proof that this interactive Academy was seen. */if(hasCompleted()||bypassed())return globalThis.APP_UI?.openModeSelect?.()||false;return open();}
  function startTraining(){close();if(typeof globalThis.R34_GUIDED_SCENARIO?.start==='function')return globalThis.R34_GUIDED_SCENARIO.start();if(typeof globalThis.R33_GUIDED_MATCH?.start==='function')return globalThis.R33_GUIDED_MATCH.start();return false;}
  function realDuel(uid){try{
    if(typeof resolveCombat !== 'function')return {ok:false,errorCode:'NO_COMBAT_RESOLVER'};
    /* Existing pure engine; no mutation of squads, scroll inventory, ELO or online rooms. */
    return resolveCombat(uid,RIVAL,{phase:'ACADEMY_DEMO',scrollContext:null,arenaContext:null});
  }catch(e){return {ok:false,errorCode:String(e&&e.message||e).slice(0,100)};}}
  function action(a,value){
    if(a==='show-target'){const next=root?.querySelector('.ac-playground button[data-ac-action]:not([disabled])');if(next){next.scrollIntoView({block:'center',inline:'nearest',behavior:prefReduced()?'instant':'smooth'});}return;}
    if(a==='close'){close();return;}
    if(a==='skip'){skipAndPlay();return;}
    if(a==='restart'){go(0);return;}
    if(a==='modes'){close();globalThis.APP_UI?.openModeSelect?.();return;}
    if(a==='training'){startTraining();return;}
    if(a==='back'){if(state.step>0)go(state.step-1);return;}
    if(a==='hint'){const hints={0:'Нажмите «БРОСИТЬ КУБИКИ», чтобы пройти учебный жребий.',1:'Нажмите «ЗАБРАТЬ · KEEP».',2:'Нажмите «ОТДАТЬ · PASS».',3:'Выберите любую карту, чтобы сделать её лидером.',4:state.sub===0?'Нажмите «1. ВЫБРАТЬ СВИТОК».':'Нажмите «2. НАЗНАЧИТЬ».',5:'Нажмите «ПРОКРУТИТЬ АРЕНУ».',6:state.sub===0?'Нажмите на любого из двух ваших бойцов.':state.sub===1?'Подтвердите выбранного бойца.':'Разрешите дуэль.'};state.feedback=hints[state.step]||'Читайте короткую цель слева.';render();return;}
    if(a==='next'){if(state.step===0&&state.done){go(1);return;}if(state.done){if(state.step===TOTAL)finish();else go(state.step+1);}return;}
    if(state.done||state.busy)return;
    if(state.step===0&&a==='roll-init'){state.busy=true;state.feedback='Подбрасываем кубики…';render();state.timer=setTimeout(()=>{if(!state.active||state.step!==0)return;complete('Жребий завершён: 6 : 2. Вы выбираете первого бойца.');},prefReduced()?120:560);return;}
    if(state.step===1||state.step===2){if(a!=='keep'&&a!=='pass')return;const expected=state.step===1?'keep':'pass';if(a===expected){complete(expected==='keep'?'Верно. KEEP оставляет открытую карту в вашей команде.':'Верно. PASS передаёт открытую карту сопернику.');}else{state.feedback=expected==='keep'?'Это PASS: он отдаст карту сопернику. Сейчас нажмите «ЗАБРАТЬ».':'Это KEEP: он заберёт карту вам. Сейчас нажмите «ОТДАТЬ».';trace('recoverable-mistake',{action:a});render();}return;}
    if(state.step===3&&a==='leader'&&(value===HERO||value===PARTNER)){state.leader=value;complete('Лидер выбран. В настоящем матче связь формируется автоматически, а лидера можно выбрать перед боем.');return;}
    if(state.step===4){if(a==='choose-scroll'&&state.sub===0){state.sub=1;state.feedback='Свиток выбран. Теперь назначьте его бойцу справа.';render();return;}if(a==='equip'&&state.sub===1){complete('Свиток назначен. В полном матче он получит один реальный заряд.');return;}}
    if(state.step===5&&a==='arena-roll'){state.busy=true;state.feedback='Прокручиваем учебные арены…';render();state.timer=setTimeout(()=>{if(!state.active||state.step!==5)return;complete('Арена открыта. Перед выбором бойца теперь можно учесть особенности поля.');},prefReduced()?120:650);return;}
    if(state.step===6){if(a==='choose-fighter'&&(value===HERO||value===PARTNER)&&state.sub===0){state.chosen=value;state.sub=1;state.feedback='Вы выбрали бойца. Теперь подтвердите выбор.';render();return;}if(a==='change-fighter'&&state.sub===1){state.sub=0;state.feedback='Выберите другого бойца.';render();return;}if(a==='confirm-fighter'&&state.sub===1){state.sub=2;state.feedback='Боец подтверждён. Теперь можно провести дуэль.';render();return;}if(a==='fight'&&state.sub===2){const r=realDuel(state.chosen);trace('resolver-demo',{ok:!!r?.ok,errorCode:r?.errorCode||null});if(!r?.ok){state.feedback='Учебный расчёт временно недоступен. Проверьте данные бойцов и повторите дуэль.';render();return;}state.duel={ok:true,winnerUid:r.winnerUid,loserUid:r.loserUid||null};complete('Дуэль завершена. В настоящем матче результат зависит от действующих правил и состояния обоих бойцов.');return;}}
  }
  function onClick(e){const b=e.target?.closest?.('[data-ac-action]');if(!b||b.disabled)return;e.preventDefault();e.stopPropagation();action(b.dataset.acAction,b.dataset.acValue);}
  function onKeyDown(e){if(!state.active||!root)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}if(e.key!=='Tab')return;const list=[...root.querySelectorAll('button:not([disabled])')].filter(b=>b.getClientRects().length);if(!list.length)return;const i=list.indexOf(document.activeElement);if(e.shiftKey&&(i<=0)){e.preventDefault();list[list.length-1].focus();}else if(!e.shiftKey&&(i===list.length-1||i<0)){e.preventDefault();list[0].focus();}}
  function audit(){const essentials=['academy-root','academy-title'],nodes=state.active?essentials.filter(x=>!$(x)):[];return Object.freeze({version:VERSION,active:state.active,step:state.step,total:TOTAL,done:state.done,completed:hasCompleted(),skipped:bypassed(),missing:nodes,profileWrites:0,onlineWrites:0,events:[...state.events.slice(-12)]});}
  document.addEventListener('keydown',onKeyDown,true);
  globalThis.SHINOBI_ACADEMY=Object.freeze({version:VERSION,open,close,gatePlay,skipAndPlay,startTraining,audit,completed:hasCompleted,reset:()=>{save({completedAt:null,skipped:false,progressStep:0});return open({restart:true});}});
})();
