/* SHINOBI ACADEMY V3 — continuous, rule-accurate, accessible learning mission.
 * Does not write to live team, CPU, profile, economy, ELO, online or lore charge state.
 * Uses the game's original pure resolveCombat() to calculate the final demonstration.
 */
(function(){
  'use strict';
  const VERSION='3.0.0',KEY='shinobi_academy_progress_v1',TOTAL=6;
  const HERO='fighter_003',PARTNER='fighter_004',RIVAL='fighter_001',ARENA='hidden_forest';
  const TOPICS=['Старт','Забрать','Передать','Связь','Свиток','Арена','Дуэль'];
  const TITLES=['Ваша первая миссия','Возьмите первого союзника','Решите, кому достанется карта','Создайте связь персонажей','Подготовьте свиток к бою','Изучите особенности арены','Примите боевое решение','Академия пройдена'];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blank=()=>({rolled:false,owned:[],enemy:[],link:false,leader:HERO,scrollSelected:false,scrollOwner:null,arenaId:null});
  const state={active:false,step:0,sub:0,done:false,busy:false,feedback:'',chosen:HERO,duel:null,events:[],focusBefore:null,timer:null,hudExpanded:false,guide:null,guideSelected:null,guideFilter:'',scrollQuiz:false,arenaQuiz:false,linkQuiz:false,mission:blank()};
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
  function persist(){save({academyMissionVersion:3,mission:{...state.mission,owned:[...state.mission.owned],enemy:[...state.mission.enemy]},progressStep:state.step,progressDone:state.done,scrollQuiz:state.scrollQuiz,arenaQuiz:state.arenaQuiz});}
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
      ['УРОК 1 ИЗ 6 · KEEP','Первым открывается ваш будущий союзник. Нажмите «Забрать» — он останется в вашем отряде на протяжении миссии.','KEEP сохраняет открытую карту вам, PASS отдаёт её сопернику. При сборке связки несколько бойцов могут занять один слот из пяти.'],
      ['УРОК 2 ИЗ 6 · PASS','Сейчас мы намеренно совершим рискованный ход: передадим очень сильную карту сопернику и увидим последствия. В настоящем матче так делать обычно невыгодно.','PASS отдаёт открытую карту противнику. Не повторяйте это автоматически: сравнивайте силу и будущие связи обеих команд.'],
      ['УРОК 3 ИЗ 6 · СВЯЗЬ','Получите второго союзника, создайте составную карту и выберите её лидера. Затем проверьте, что происходит при поражении лидера.','Лидер участвует в базовом матчапе; остальные поддерживают. Пара занимает один слот, имеет общую судьбу при поражении лидера и один заряд эффекта. Групповая связь — два заряда.'],
      ['УРОК 4 ИЗ 6 · СВИТКИ','Изучите шесть видов свитков, затем решите, какой помогает раненому бойцу. После этого назначьте «Теневой рывок» лидеру вашей пары.','У каждого свитка — свой момент активации. Один заряд не гарантирует победу, снаряжение закрепляется за владельцем.'],
      ['УРОК 5 ИЗ 6 · АРЕНА','Посмотрите все пять арен и их особенности, затем определите учебное поле и выберите наиболее подходящую тактику.','Арена одна для всего боя и оценивает способности обеих сторон. Бонус может изменить состояние победителя, а иногда не влияет на результат.'],
      ['УРОК 6 ИЗ 6 · ДУЭЛЬ','В бой вступает одна составная карта с выбранным лидером — не два независимых бойца. Соперник получил сильную карту после рискованного PASS.','Сначала посмотрите, кто бы победил без подготовки, затем сравните результат с ареной, свитком и зарядом связи. Состояние победителя также важно.'],
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

  const timingNames={PRE_DUEL:'До дуэли',RESOLVER:'При расчёте боя',ON_DEFEAT:'При поражении',POST_DUEL:'После дуэли'};
  const scrollExamples={
    SHUNSHIN:'Близкий по силам матчап: первый удар создаёт давление, но не гарантирует победу.',
    IZANAGI:'Лидер должен выбыть: печать может удержать его на грани, но не сделать здоровым.',
    KAGE_BUNSHIN:'Проигранная дуэль: двойник принимает удар, владелец остаётся раненым.',
    FUINJUTSU:'Противник полагается на подавляемые способности: часть приёмов будет заблокирована на одну дуэль.',
    EDO_TENSEI:'Союзник уже выбыл и есть допустимая цель: свиток возвращает его истощённым.',
    IRYO_NINJUTSU:'Боец ранен или истощён перед дуэлью: печать улучшит состояние на одну ступень.'
  };
  const familyLessons={
    COMBAT_SYNC:'Усиливает парное боевое взаимодействие; в близком матчапе может смягчить износ или изменить исход.',
    INITIATIVE:'Работает с порядком выставления; важно, кто открывает бой и кто отвечает контрпиком.',
    PROTECTION:'При поражении может удержать составную карту от окончательного выбывания, расходуя заряд.',
    RECOVERY:'Перед дуэлью восстанавливает состояние при выполнении условий; заряд не бесконечен.',
    TACTICAL_READ:'Помогает точнее отработать контрпик против уже открытого противника.',
    ARENA_CONTROL:'Зависит от соответствия бойцов выбранной местности; полезно сверять арену заранее.',
    SCROLL_SYNERGY:'Усиливает подходящий действительно применённый свиток; пустое снаряжение не усиливает.',
    ENDURANCE:'Помогает сохранить состояние после размена, а не обеспечивает автоматическую победу.'
  };
  const scrolls=()=>typeof SCROLL_TYPES!=='undefined'?Object.values(SCROLL_TYPES):[];
  const arenas=()=>typeof ARENA_RULES!=='undefined'?ARENA_RULES:[];
  const families=()=>typeof LORE_EFFECT_FAMILIES!=='undefined'?Object.values(LORE_EFFECT_FAMILIES):[];
  const lore=()=>typeof LORE_CARDS!=='undefined'?LORE_CARDS:[];
  const attrition=()=>typeof ATTRITION_STATE_META!=='undefined'?ATTRITION_STATE_META:[];
  function guideButton(tab='scrolls',label='СПРАВОЧНИК ПРАВИЛ'){
    return `<button type="button" class="ac-guide-link" data-ac-action="guide" data-ac-value="${esc(tab)}">${esc(label)} ↗</button>`;
  }
  function guideStats(){
    return `<div class="ac-guide-stats" aria-label="Справочные разделы"><span>6 СВИТКОВ</span><span>5 АРЕН</span><span>8 ЭФФЕКТОВ СВЯЗЕЙ</span><span>115 КОМБИНАЦИЙ</span></div>`;
  }
  function scrollLibrary(standalone=false){
    return `<section class="ac-library-block" aria-label="Шесть свитков"><div class="ac-library-heading"><strong>ШЕСТЬ СВИТКОВ</strong><span>Коснитесь карточки, чтобы увидеть описание, пример и момент активации</span></div><div class="ac-info-grid ac-scroll-grid">${scrolls().map(s=>`<article class="ac-info-card"><div class="ac-info-icon" aria-hidden="true">${s.emoji||'◇'}</div><div><h4>${esc(s.name)}</h4><small>${esc(timingNames[typeof SCROLL_RULES!=='undefined'?SCROLL_RULES[s.id]?.timing:'']||'В бою')} · 1 заряд</small><p>${esc(s.desc)}</p><p class="ac-info-example"><b>Пример:</b> ${esc(scrollExamples[s.id]||'Применяется при соблюдении условий.')}</p></div></article>`).join('')}</div>${!standalone?'<p class="ac-caution">Важно: назначьте свиток конкретному бойцу. Он не переносится на другого автоматически. Наличие предмета не равно гарантии срабатывания.</p>':''}</section>`;
  }
  function arenaLibrary(){
    return `<section class="ac-library-block" aria-label="Пять арен"><div class="ac-library-heading"><strong>ПЯТЬ АРЕН</strong><span>Разные способности получают преимущества в разных условиях</span></div><div class="ac-info-grid ac-arena-grid">${arenas().map(a=>`<article class="ac-info-card"><img class="ac-arena-thumb" src="${esc(a.art)}" alt="${esc(a.name)}" loading="lazy"><h4>${esc(a.name)}</h4><p>${esc(a.description)}</p><small>Особенно полезны: ${esc((a.tags||[]).join(' · '))}</small></article>`).join('')}</div><p class="ac-caution">Бонус зависит от конкретных бойцов. Даже подходящая арена не гарантирует победу.</p></section>`;
  }
  function familyLibrary(){
    return `<section class="ac-library-block"><div class="ac-library-heading"><strong>ВОСЕМЬ ВИДОВ ПОДДЕРЖКИ</strong><span>У связок разные условия, время срабатывания и заряды</span></div><div class="ac-info-grid">${families().map(f=>`<article class="ac-info-card"><h4>${esc(f.label)}</h4><small>${esc(timingNames[f.timing]||'В бою')}</small><p>${esc(familyLessons[f.id]||'Условия зависят от типа связи.')}</p></article>`).join('')}</div><p class="ac-caution">Обычная пара имеет 1 заряд связи, групповая карта — 2. Участники поддерживают лидера, а не участвуют отдельными картами.</p></section>`;
  }
  function statusLibrary(){
    return `<section class="ac-library-block"><div class="ac-library-heading"><strong>СОСТОЯНИЯ БОЙЦОВ</strong><span>Износ снижает эффективность при последующих дуэлях</span></div><div class="ac-status-grid">${attrition().map(a=>`<div><strong>${esc(a.label)}</strong><span>${Math.round(a.multiplier*100)}% силы</span></div>`).join('')}</div><p class="ac-caution">Победа с ранением и победа без ранений — не одно и то же. После тяжёлого боя важна сохранность отряда.</p></section>`;
  }
  function cardLibrary(){
    const query=state.guideFilter.trim().toLocaleLowerCase('ru');const subset=lore().filter(c=>!query||[c.title,c.effectLabel,c.kind,...(c.canonicalMembers||[])].join(' ').toLocaleLowerCase('ru').includes(query));
    const list=subset.slice(0,40);
    return `<section class="ac-library-block"><div class="ac-library-heading"><strong>КАТАЛОГ СОСТАВНЫХ КАРТ</strong><span>Доступны все ${lore().length} комбинаций: пары и группы</span></div><label class="ac-search-label" for="ac-guide-search">Найти персонажа, связь или эффект</label><input id="ac-guide-search" class="ac-guide-search" type="search" placeholder="Например: Team 7, защита, Наруто" value="${esc(state.guideFilter)}" autocomplete="off" data-ac-search><p class="ac-search-count">Найдено ${subset.length}; показано ${list.length}. Уточните запрос для остальных.</p><div class="ac-card-list">${list.map(c=>`<article><div><b>${esc(c.title)}</b><small>${c.kind==='group'?'ГРУППА':'ПАРА'} · ${c.members.length} участников · ${c.maxCharges} ${c.maxCharges===1?'заряд':'заряда'}</small></div><p>${esc((c.canonicalMembers||c.members).join(' + '))}</p><p><strong>${esc(c.effectLabel||'Эффект')}</strong> — ${esc(c.effectDescription||familyLessons[c.effectFamily]||'')}</p></article>`).join('')||'<p>Совпадений нет. Попробуйте другое имя.</p>'}</div><p class="ac-caution">115 карт доступны для поиска, но их нельзя собрать без необходимых участников; некоторые перекрываются. Все эффекты основаны на текущей боевой базе.</p></section>`;
  }
  function guideMarkup(){
    if(!state.guide)return '';
    const tabs=[['scrolls','Свитки'],['arenas','Арены'],['families','Эффекты связей'],['cards','115 связок'],['states','Состояния']];
    return `<div class="ac-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="ac-guide-title"><section class="ac-guide-panel"><header class="ac-guide-header"><div><small>АТЛАС МЕХАНИК · АКАДЕМИЯ V3</small><h2 id="ac-guide-title">Все правила под рукой</h2></div><button type="button" class="ac-guide-close" data-ac-action="guide-close" aria-label="Закрыть справочник">×</button></header><nav class="ac-guide-tabs" aria-label="Темы справочника">${tabs.map(([id,t])=>`<button type="button" data-ac-action="guide" data-ac-value="${id}" aria-current="${state.guide===id?'page':'false'}">${t}</button>`).join('')}</nav><div class="ac-guide-body">${state.guide==='scrolls'?scrollLibrary(true):state.guide==='arenas'?arenaLibrary():state.guide==='families'?familyLibrary():state.guide==='cards'?cardLibrary():statusLibrary()}</div><footer class="ac-guide-footer">Описания взяты из текущей базы игры. <button type="button" data-ac-action="guide-close">ВЕРНУТЬСЯ К МИССИИ</button></footer></section></div>`;
  }

  function scene(){
    const m=state.mission;
    switch(state.step){
      case 0:return `<div class="ac-intro-scene"><div class="ac-seal" aria-hidden="true">忍</div><div class="ac-prologue-grid"><div class="ac-intro-card">${portrait(HERO,'ПЕРВЫЙ СОЮЗНИК','ac-intro-portrait')}</div><div class="ac-dice-panel"><span class="ac-mark">КТО ПЕРВЫМ ВЫБИРАЕТ?</span><div class="ac-dice-result"><div><small>ВЫ</small><strong>${m.rolled?'6':'?'}</strong></div><b>:</b><div><small>CPU</small><strong>${m.rolled?'2':'?'}</strong></div></div>${m.rolled?'<p class="ac-dice-success">✓ Первый выбор ваш</p>':buttons([{text:state.busy?'ЖДЁМ ЖРЕБИЙ…':'БРОСИТЬ КУБИКИ',action:'roll-init',primary:true,icon:'◈'}])}</div></div><div class="ac-intro-stats"><span><b>6</b> взаимосвязанных уроков</span><span><b>0</b> потерь рейтинга</span><span><b>1</b> учебная миссия</span></div></div>`;
      case 1:
      case 2:{
        const take=state.step===1,uid=take?HERO:RIVAL;
        return `<div class="ac-training-board"><div class="ac-score-line"><div class="ac-team"><small>ВАШ ОТРЯД</small><strong>${m.owned.length} бойц.</strong></div><span class="ac-versus">VS</span><div class="ac-team ac-enemy"><small>СОПЕРНИК</small><strong>${m.enemy.length} бойц.</strong></div></div><div class="ac-draft-surface">${portrait(uid,'ОТКРЫТАЯ КАРТА','ac-major-portrait')}<div class="ac-draft-info"><span class="ac-mark">ШАГ ДРАФТА</span><h3>${name(uid)}</h3><p>${take?'Этот союзник потребуется вам для следующего урока — связи персонажей.':'В этом уроке сильный соперник получит карту по вашему PASS. Это намеренная учебная ошибка, чтобы увидеть цену невыгодного обмена.'}</p>${state.done?`<div class="ac-verified">✓ ${take?'Боец в вашем отряде':'Карта передана сопернику'}</div>`:buttons([{text:'ЗАБРАТЬ · KEEP',action:'keep',primary:take,icon:'+'},{text:'ОТДАТЬ · PASS',action:'pass',primary:!take,icon:'→'}])}</div></div><div class="ac-rule-strip"><span>ВАША КОМАНДА ${m.owned.length}/5</span><span>ЦЕЛЬ: ${take?'ЗАБРАТЬ':'ПЕРЕДАТЬ'} КАРТУ</span></div></div>`;
      }
      case 3:{
        if(!owned(PARTNER))return `<div class="ac-training-board ac-lore-board"><div class="ac-bond-header"><span class="ac-mark">СЛЕДУЮЩАЯ КАРТА ДРАФТА</span><strong>Союзник для связи</strong><small>Вы получили ${name(HERO)} на первом шаге. Теперь дополните состав.</small></div><div class="ac-draft-surface">${portrait(PARTNER,'НОВАЯ КАРТА','ac-major-portrait')}<div class="ac-draft-info"><h3>${name(PARTNER)}</h3><p>Эта карта вместе с первой может образовать связь «Два пути Team 7».</p>${buttons([{text:'ЗАБРАТЬ СОЮЗНИКА',action:'recruit-partner',primary:true,icon:'+'}])}</div></div></div>`;
        return `<div class="ac-training-board ac-lore-board"><div class="ac-bond-header"><span class="ac-mark">ПАРНАЯ КАРТА · ДВА ПУТИ TEAM 7</span><strong>${m.link?'Связь собрана · 1 слот':'Выберите лидера связи'}</strong><small>Два полученных бойца могут представлять одну составную карту</small></div><div class="ac-bond-pair"><button class="ac-fighter-option ${m.link&&m.leader===HERO?'ac-picked':''}" type="button" data-ac-action="leader" data-ac-value="${HERO}" ${state.done?'disabled':''}>${portrait(HERO,'ПЕРВЫЙ СОЮЗНИК')}<strong>${name(HERO)}</strong><small>${m.link&&m.leader===HERO?'✓ ЛИДЕР':'НАЗНАЧИТЬ ЛИДЕРОМ'}</small></button><div class="ac-bond-mark" aria-hidden="true">+</div><button class="ac-fighter-option ${m.link&&m.leader===PARTNER?'ac-picked':''}" type="button" data-ac-action="leader" data-ac-value="${PARTNER}" ${state.done?'disabled':''}>${portrait(PARTNER,'ВТОРОЙ СОЮЗНИК')}<strong>${name(PARTNER)}</strong><small>${m.link&&m.leader===PARTNER?'✓ ЛИДЕР':'НАЗНАЧИТЬ ЛИДЕРОМ'}</small></button></div><div class="ac-bond-footer"><span class="ac-bond-chain">2 ПЕРСОНАЖА → 1 СЛОТ</span><p>${m.link?`Лидер: <b>${name(m.leader)}</b>. Именно он сразится от имени пары; поражение лидера выведет всю составную карту.`:'Выберите лидера — это влияет на последующее назначение свитка.'}</p><div class="ac-principle">ОБЩАЯ СУДЬБА: лидер выходит в бой; второй участник поддерживает. Если лидер выбывает, выбывает вся составная карта.</div>${familyLibrary()}${guideButton('cards','НАЙТИ СВЯЗКУ СРЕДИ 115')}</div></div>`;
      }
      case 4:return `<div class="ac-training-board ac-scroll-board">${scrollLibrary()}${!state.scrollQuiz?`<section class="ac-inline-quiz" aria-label="Вопрос о свитках"><strong>ПРОВЕРКА: БОЕЦ РАНЕН ПЕРЕД ДУЭЛЬЮ</strong><p>Какой свиток поможет улучшить его состояние на одну ступень?</p>${buttons([{text:'Исцеляющая печать',action:'scroll-quiz',value:'IRYO_NINJUTSU',primary:true},{text:'Теневые двойники',action:'scroll-quiz',value:'KAGE_BUNSHIN'},{text:'Теневой рывок',action:'scroll-quiz',value:'SHUNSHIN'}])}</section>`:`<div class="ac-verified">✓ Верно! Для раненого перед боем подходит Исцеляющая печать. Теперь потренируем Теневой рывок.</div><div class="ac-scroll-path"><div class="ac-scroll-item ${m.scrollSelected?'ac-selected':''}"><span class="ac-scroll-icon" aria-hidden="true">⚡</span><b>ТЕНЕВОЙ РЫВОК · ШУНШИН</b><small>Первый удар · 1 заряд</small><button type="button" data-ac-action="choose-scroll" ${m.scrollSelected?'disabled':''}>${m.scrollSelected?'✓ ВЫБРАНО':'1. ВЫБРАТЬ СВИТОК'}</button></div><div class="ac-scroll-arrow" aria-hidden="true">→</div><div class="ac-scroll-item ac-scroll-target ${m.scrollOwner?'ac-selected':''}">${portrait(m.leader,'ЛИДЕР','ac-small-portrait')}<b>${name(m.leader)}</b><small>${m.scrollOwner?'⚡ Свиток назначен':'Нет снаряжения'}</small><button type="button" data-ac-action="equip" ${!m.scrollSelected||state.done?'disabled':''}>${m.scrollOwner?'✓ НАЗНАЧЕНО':'2. НАЗНАЧИТЬ'}</button></div></div>`}<div class="ac-rule-strip"><span>Шесть типов · по одному заряду</span><span>Срабатывают при разных условиях</span></div></div>`;
      case 5:return `<div class="ac-training-board ac-arena-board">${arenaLibrary()}<div class="ac-arena-visual ${state.busy?'ac-rolling':''}"><img src="assets/arenas/${m.arenaId?'hidden_forest':'open_expanse'}.webp" alt="${m.arenaId?'Лес скрытых троп':'Учебная арена'}" decoding="async"><div class="ac-arena-overlay"><span class="ac-mark">${m.arenaId?'АРЕНА ОПРЕДЕЛЕНА':'УЧЕБНЫЙ ЖРЕБИЙ'}</span><strong>${m.arenaId?'ЛЕС СКРЫТЫХ ТРОП':'ПРОКРУТИТЬ ПОЛЕ'}</strong><p>${m.arenaId?'Арена сохранена до дуэли; в реальном матче поле выпадает случайно.':'Для сравнения боевых эффектов результат в Академии задан заранее.'}</p></div></div>${!m.arenaId?buttons([{text:state.busy?'ОПРЕДЕЛЯЕМ…':'ПРОКРУТИТЬ АРЕНУ',action:'arena-roll',primary:true,icon:'◈'}]):!state.arenaQuiz?`<section class="ac-inline-quiz"><strong>КАКАЯ ТАКТИКА ПОДОЙДЁТ ДЛЯ ЛЕСА?</strong><p>Выберите свойства, которые арена оценивает особенно высоко.</p>${buttons([{text:'Контроль и сенсорика',action:'arena-quiz',value:'sensing',primary:true},{text:'Только дальность',action:'arena-quiz',value:'range'},{text:'Всегда самый высокий тир',action:'arena-quiz',value:'tier'}])}</section>`:'<div class="ac-verified">✓ Верно! Учитывайте способности и местность, а не только тир бойца.</div>'}<div class="ac-rule-strip"><span>5 арен</span><span>Случайное поле в обычной игре</span></div></div>`;
      case 6:{
        const selected=state.sub>=1,confirmed=state.sub>=2,finished=state.sub>=3;
        const mine=m.leader;
        const r=state.duel;
        const resultLabel=r?(r.winnerUid===mine?'ВАШ БОЕЦ ВЫИГРАЛ':'СОПЕРНИК ВЫИГРАЛ'):'';
        const scrollActive=mine===m.scrollOwner;
        return `<div class="ac-training-board ac-battle-board"><div class="ac-combat-side"><div class="ac-combat-column"><span class="ac-mark">ВАША КАРТА</span>${portrait(mine,'ВАШ БОЕЦ','ac-combat-portrait')}<div class="ac-battle-status">${r?resultLabel:confirmed?'ВЫБОР ПОДТВЕРЖДЁН':selected?'БОЕЦ ВЫБРАН':'ВЫБЕРИТЕ БОЙЦА'}</div></div><span class="ac-combat-vs">VS</span><div class="ac-combat-column"><span class="ac-mark">КАРТА СОПЕРНИКА</span>${portrait(RIVAL,'СОПЕРНИК','ac-combat-portrait')}<div class="ac-battle-status">КАРТА ОТКРЫТА</div></div></div>
        <div class="ac-fight-context"><span>🌲 ${m.arenaId?'Лес скрытых троп':'Арена не выбрана'}</span><span>⚡ ${scrollActive?'Шуншин на выбранном бойце':'Шуншин назначен другому бойцу'}</span></div>
        ${!selected?`<p class="ac-choice-label">В бой можно выставить только всю составную карту с выбранным лидером. Участник поддержки не считается второй картой.</p><div class="ac-battle-choices"><button type="button" data-ac-action="choose-card" data-ac-value="${m.leader}">${img(m.leader,fighter(m.leader)?.name||'Лидер')}<span>ВЫСТАВИТЬ ПАРНУЮ КАРТУ · ${name(m.leader)} (лидер)</span></button><button type="button" class="ac-incorrect" data-ac-action="choose-support">${img(m.leader===HERO?PARTNER:HERO,'Участник поддержки')}<span>Отдельно выставить бойца поддержки?</span></button></div>`:''}
        ${selected&&!confirmed?buttons([{text:'2. ПОДТВЕРДИТЬ БОЙЦА',action:'confirm-fighter',primary:true,icon:'✓'},{text:'СМЕНИТЬ БОЙЦА',action:'change-fighter'}]):''}
        ${confirmed&&!finished?buttons([{text:'3. РАЗРЕШИТЬ ДУЭЛЬ',action:'fight',primary:true,icon:'⚔'}]):''}
        ${finished&&r?`<div class="ac-battle-result" role="status" tabindex="-1"><strong>${esc(resultLabel)}</strong><p>${esc(r.summary)}</p><div class="ac-result-facts"><div><b>БАЗОВАЯ МАТРИЦА</b><span>${name(r.baseWinnerUid)} ${r.baseSeverity!==null?'· '+esc(attrition()[Number(r.baseSeverity)]?.label||'Состояние '+r.baseSeverity):''}</span></div><div><b>ИТОГ С ПОЛЕМ И СВИТКОМ</b><span>${name(r.winnerUid)} · ${esc(attrition()[Number(r.severity)]?.label||"Состояние "+r.severity)}</span></div><div><b>АРЕНА</b><span>${esc(r.arenaDetail)}</span></div><div><b>СВИТОК</b><span>${esc(r.scrollDetail)}</span></div><div><b>СВЯЗЬ</b><span>${esc(r.loreDetail)}</span></div><div class="ac-stage-results"><b>ЭФФЕКТ ПОДГОТОВКИ ПО ШАГАМ</b>${r.stageRows.map(row=>`<p><strong>${esc(row.label)}:</strong> ${esc(row.text)}</p>`).join('')}</div></div></div>${!state.done?`<div class="ac-reflection"><strong>ПРОВЕРЬТЕ ПОНИМАНИЕ</strong><p>Вы выставили одну составную карту. Кто сражался в дуэли и что произойдёт с участниками связи при выбывании лидера?</p>${buttons([{text:'Поддержка не участвует отдельно: дерётся выбранный лидер',action:'reflect',value:'owner'},{text:'Можно отдельно выставить обоих участников',action:'reflect',value:'transfer'},{text:'Свиток автоматически переносится на поддержку',action:'reflect',value:'all'}])}</div>`:''}`:''}</div>`;
      }
      default:return `<div class="ac-complete-scene"><div class="ac-end-emblem" aria-hidden="true">忍</div><h3>ПЕРВАЯ МИССИЯ ВЫПОЛНЕНА</h3><p>Вы прошли путь от жребия до реальной учебной дуэли: сохранили бойцов, собрали связь, экипировали свиток и учли арену.</p><div class="ac-completed-grid"><span><b>6 / 6</b> связанных заданий</span><span><b>0</b> изменений Elo и монет</span></div>${guideStats()}<p class="ac-next-course">Открывайте Атлас механик в любой момент. Дальше — настоящий тренировочный матч 5×5: драфт, свитки, арену и бой вы пройдёте самостоятельно, с подсказками тренера.</p>${guideButton('scrolls','ПОВТОРИТЬ ВСЕ МЕХАНИКИ')}${buttons([{text:'ПОЛНЫЙ УЧЕБНЫЙ МАТЧ · С ТРЕНЕРОМ',action:'training',primary:true,icon:'⚔'},{text:'ВЫБРАТЬ РЕЖИМ ИГРЫ',action:'modes',icon:'▶'},{text:'ПОВТОРИТЬ АКАДЕМИЮ',action:'restart',icon:'↻'}])}</div>`;
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
    root.innerHTML=`<div class="ac-ambient" aria-hidden="true"><i></i><i></i><i></i></div><div class="ac-shell"><header class="ac-header"><div class="ac-brand"><span class="ac-brand-mark" aria-hidden="true">忍</span><div><small>ПЕРВАЯ МИССИЯ · V3</small><strong>АКАДЕМИЯ ШИНОБИ</strong></div></div><div class="ac-header-right"><button type="button" class="ac-header-guide" data-ac-action="guide" data-ac-value="scrolls">АТЛАС ПРАВИЛ</button><span class="ac-chapter">${step===0?'ВВЕДЕНИЕ':step===7?'ГОТОВО':`${step} / ${TOTAL}`}</span><button type="button" class="ac-header-exit" data-ac-action="close" aria-label="Закрыть Академию">×</button></div></header><div class="ac-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс обучения"><span style="width:${pct}%"></span></div>${nav}
      ${missionHud()}
      <main class="ac-main"><section class="ac-teaching"><span class="ac-kicker">${esc(info.eyebrow)}</span><h2 id="academy-title">${esc(TITLES[step])}</h2><p class="ac-intro">${esc(info.intro)}</p><div class="ac-tip"><span aria-hidden="true">i</span><p>${esc(info.tip)}</p></div></section>${step<7&&!state.done?'<button class="ac-mobile-action-jump" type="button" data-ac-action="show-target">↓ К ДЕЙСТВИЮ</button>':''}<section class="ac-playground" aria-label="Интерактивное задание">${scene()}<div class="ac-feedback ${state.feedback?'visible':''}" role="status" aria-live="polite">${state.feedback?esc(state.feedback):''}</div></section></main>
      <footer class="ac-footer"><div class="ac-footer-left"><button type="button" data-ac-action="back" ${step===0?'disabled':''}>← НАЗАД</button><span>${step===7?'АКАДЕМИЯ ПРОЙДЕНА':state.done?'УРОК ПРОЙДЕН · МОЖНО ПРОДОЛЖИТЬ':'ВЫПОЛНИТЕ ДЕЙСТВИЕ НА ЭКРАНЕ'}</span></div><div class="ac-footer-actions">${step===7?'':state.done?`<button type="button" class="ac-primary" data-ac-action="next">${step===0?'НАЧАТЬ УРОКИ':step===TOTAL?'ЗАВЕРШИТЬ АКАДЕМИЮ':'СЛЕДУЮЩИЙ УРОК'} →</button>`:'<button type="button" class="ac-secondary" data-ac-action="hint">ПОДСКАЗКА</button>'}</div></footer>${step<7?'<div class="ac-bottom-exit"><button type="button" data-ac-action="skip">ПРОПУСТИТЬ ОБУЧЕНИЕ И ПЕРЕЙТИ К ИГРЕ</button></div>':''}${guideMarkup()}</div>`;
    root.dataset.step=String(step);root.dataset.done=state.done?'yes':'no';
    const nextMain=root.querySelector('.ac-main');if(nextMain)nextMain.scrollTop=opts.resetScroll?0:oldScroll;
    if(opts.focusResult){const result=nextMain?.querySelector('.ac-battle-result');if(result){result.scrollIntoView({block:'start',behavior:'instant'});try{result.focus({preventScroll:true});}catch(_){}}}
    if(previousAction&&!opts.resetScroll&&!opts.focusResult){const sel=`[data-ac-action="${previousAction}"]${previousValue?`[data-ac-value="${previousValue}"]`:''}`;const newer=root.querySelector(sel);if(newer&&!newer.disabled)try{newer.focus({preventScroll:true});}catch(_){}}
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
    const target=Math.max(0,Math.min(7,n));if(target<state.step){resetFrom(target);if(target<=4)state.scrollQuiz=false;if(target<=5)state.arenaQuiz=false;}
    state.step=target;state.sub=0;state.busy=false;state.done=false;state.feedback='';state.duel=null;
    if(target!==7)persist();trace('step-change');render({resetScroll:true});
  }
  function complete(message){state.done=true;state.busy=false;state.feedback=message;persist();trace('step-complete');render();}
  function close(){if(!state.active)return false;if(state.timer)clearTimeout(state.timer);state.timer=null;persist();state.active=false;root?.remove();root=null;document.body?.classList.remove('academy-open');try{state.focusBefore?.focus?.({preventScroll:true});}catch(_){}trace('close');return true;}
  function open(opts={}){
    if(state.active)return true;
    if(document.body?.classList.contains('r34-training-active')||globalThis.R33_GUIDED_MATCH?.status?.().active)return false;
    try{const modal=$('r21-tutorial-modal');modal?.classList.add('hidden');modal?.setAttribute('aria-hidden','true');}catch(_){ }
    const p=load();const resumable=!opts.restart&&!completed()&&!skipped()&&p.academyMissionVersion===3;
    state.mission=resumable?restored(p.mission):blank();state.step=resumable?Math.max(0,Math.min(6,Number(p.progressStep)||0)):0;
    state.done=resumable&&state.step<6&&!!p.progressDone;state.hudExpanded=false;state.guide=null;state.scrollQuiz=!!(resumable&&p.scrollQuiz);state.arenaQuiz=!!(resumable&&p.arenaQuiz);state.sub=0;state.busy=false;state.feedback='';state.duel=null;state.focusBefore=document.activeElement;
    state.active=true;root=document.createElement('div');root.className='academy-root';root.id='academy-root';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','academy-title');root.addEventListener('click',onClick);root.addEventListener('input',e=>{if(e.target?.matches?.('[data-ac-search]')){state.guideFilter=e.target.value;const field=root.querySelector('.ac-guide-body');if(field){const previous=field.scrollTop;field.innerHTML=cardLibrary();field.scrollTop=previous;const input=field.querySelector('[data-ac-search]');if(input){input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);}}}});document.body.appendChild(root);document.body.classList.add('academy-open');render({resetScroll:true});
    try{root.querySelector('.ac-header-exit')?.focus({preventScroll:true});}catch(_){ }trace('open',{resumable});return true;
  }
  function finish(){save({completedAt:new Date().toISOString(),skipped:false,academyMissionVersion:3,progressStep:7,progressDone:true,mission:state.mission});trace('complete');try{if(typeof r21UpdateSettings==='function')r21UpdateSettings({tutorial:{dismissedFirstRun:true}});if(typeof r21UpdateFirstRunBanner==='function')r21UpdateFirstRunBanner();}catch(_){ }go(7);}
  function skipAndPlay(){save({skipped:true,progressStep:state.step,progressDone:state.done,scrollQuiz:state.scrollQuiz,arenaQuiz:state.arenaQuiz,academyMissionVersion:3,mission:state.mission});trace('skip');close();try{if(typeof r21UpdateSettings==='function')r21UpdateSettings({tutorial:{dismissedFirstRun:true}});if(typeof r21UpdateFirstRunBanner==='function')r21UpdateFirstRunBanner();}catch(_){ }return globalThis.APP_UI?.openModeSelect?.()||false;}
  function gatePlay(){if(state.active)return true;if(completed()||skipped())return globalThis.APP_UI?.openModeSelect?.()||false;return open();}
  function startTraining(){close();try{globalThis.r21CloseTutorial?.();}catch(_){}const ok=typeof globalThis.R34_GUIDED_SCENARIO?.start==='function'?globalThis.R34_GUIDED_SCENARIO.start():typeof globalThis.R33_GUIDED_MATCH?.start==='function'?globalThis.R33_GUIDED_MATCH.start():false;try{globalThis.r21CloseTutorial?.();}catch(_){}return ok;}
  function realDuel(uid){
    try{
      if(typeof resolveCombat!=='function')return {ok:false,errorCode:'NO_COMBAT_RESOLVER'};
      const m=state.mission;if(!m.link||uid!==m.leader)return {ok:false,errorCode:'NOT_COMPOSITE_LEADER'};
      const scrollActive=m.scrollOwner===uid;
      const base=resolveCombat(uid,RIVAL,{phase:'ACADEMY_BASE',arenaContext:null,scrollContext:null});if(!base?.ok)return base;
      const arenaContext=typeof getArenaContext==='function'?getArenaContext(m.arenaId):{arenaId:m.arenaId};
      const makeScroll=(active)=>({fighterAUid:uid,fighterBUid:RIVAL,fighterA:{scrollId:active?'SHUNSHIN':null,effectId:active?'SWIFT_STRIKE':null,firstStrike:active,energyLock:false,suppressedOpponentCaps:[]},fighterB:{scrollId:null,effectId:null,firstStrike:false,energyLock:false,suppressedOpponentCaps:[]},resolverScrolls:[]});
      const arenaOnly=resolveCombat(uid,RIVAL,{phase:'ACADEMY_ARENA_ONLY',arenaContext,scrollContext:makeScroll(false)});if(!arenaOnly?.ok)return arenaOnly;
      const scrollContext=makeScroll(scrollActive);
      const withScroll=resolveCombat(uid,RIVAL,{phase:'ACADEMY_WITH_SCROLL',arenaContext,scrollContext});if(!withScroll?.ok)return withScroll;
      const pair=typeof LORE_CARDS!=='undefined'?LORE_CARDS.find(c=>c.kind==='pair'&&c.members?.length===2&&c.members.includes(HERO)&&c.members.includes(PARTNER)):null;
      if(!pair)return {ok:false,errorCode:'LORE_PAIR_MISSING'};
      const loreContext={firstPlacer:2,counterPickerPlayer:1,arenaContext,scrollContext,preDuelScrollOwners:[],fighterA:{player:1,fighterUid:uid,card:pair,chargesRemaining:1,entryState:0,arenaFit:null,fighterArenaFit:null},fighterB:{player:2,fighterUid:RIVAL,card:null,chargesRemaining:0,entryState:0,arenaFit:null,fighterArenaFit:null}};
      const r=resolveCombat(uid,RIVAL,{phase:'ACADEMY_PRACTICE',arenaContext,scrollContext,loreContext});if(!r?.ok)return r;
      const resultText=x=>`${x.winnerUid===uid?'победа лидера':'победа соперника'} · ${attrition()[Number(x.winnerExitSeverity)]?.label||'состояние '+x.winnerExitSeverity}`;
      const stageRows=[{label:'Без подготовки',text:resultText(base)},{label:'После учёта арены',text:resultText(arenaOnly)},{label:'После применения свитка',text:resultText(withScroll)},{label:'С поддержкой связки',text:resultText(r)}];
      const diff=(x,y)=>x.winnerUid!==y.winnerUid||Number(x.winnerExitSeverity)!==Number(y.winnerExitSeverity);
      const arenaDetail=diff(base,arenaOnly)?'Арена изменила итог или состояние относительно базы.':'Арена рассмотрена; в этом матче победитель и состояние не изменились.';
      const scrollDetail=scrollActive?(diff(arenaOnly,withScroll)?'Теневой рывок активирован: первый удар изменил исход или состояние.':'Теневой рывок сработал как первый удар, но итог и состояние остались прежними.'):'Свиток не активирован: выбран не его владелец.';
      const loreDetail=r.loreEffect?.usedCard?`«${pair.title}» использовала заряд, эффект применён по правилам боя.`:`«${pair.title}» учтена; заряд не понадобился для изменения результата.`;
      return {ok:true,winnerUid:r.winnerUid,baseWinnerUid:base.winnerUid,baseSeverity:base.winnerExitSeverity,severity:r.winnerExitSeverity,arenaDetail,scrollDetail,loreDetail,loreApplied:!!r.loreEffectApplied,scrollActive,arenaApplied:!!r.arenaContextApplied,scrollApplied:!!r.scrollEffectApplied,stageRows,summary:diff(base,r)?'Подготовка действительно изменила исход или состояние. Ни один эффект не гарантирует победу в произвольном бою.':'Исход и состояние в этом примере не изменились. Эффект может сработать без переворота результата.'};
    }catch(e){return {ok:false,errorCode:String(e?.message||e).slice(0,120)};}
  }
  function action(a,value){
    if(a==='guide'){state.guide=['scrolls','arenas','families','cards','states'].includes(value)?value:'scrolls';state.guideFilter=state.guide==='cards'?state.guideFilter:'';render();try{root?.querySelector('.ac-guide-close')?.focus({preventScroll:true});}catch(_){}return;}
    if(a==='guide-close'){state.guide=null;render();try{root?.querySelector('.ac-header-guide')?.focus({preventScroll:true});}catch(_){}return;}
    if(state.guide)return;
    if(a==='toggle-hud'){state.hudExpanded=!state.hudExpanded;render();return;}
    if(a==='show-target'){
      const btn=root?.querySelector('.ac-playground button[data-ac-action]:not([disabled])');if(btn){btn.scrollIntoView({block:'center',inline:'nearest',behavior:prefReduced()?'instant':'smooth'});try{btn.focus({preventScroll:true});}catch(_){}}
      return;
    }
    if(a==='close'){close();return;}if(a==='skip'){skipAndPlay();return;}
    if(a==='restart'){state.mission=blank();state.scrollQuiz=false;state.arenaQuiz=false;go(0);return;}
    if(a==='modes'){close();globalThis.APP_UI?.openModeSelect?.();return;}
    if(a==='training'){startTraining();return;}
    if(a==='back'){if(state.step>0)go(state.step-1);return;}
    if(a==='hint'){
      const hints={0:'Бросьте кубики: этот учебный жребий определён заранее.',1:'Нажмите KEEP, чтобы сохранить первого бойца для будущей связки.',2:'Нажмите PASS: эта карта станет соперником в дуэли.',3:owned(PARTNER)?'Выберите лидера связки; ему мы назначим свиток.':'Заберите вторую карту: она нужна для связи.',4:state.mission.scrollSelected?'Назначьте свиток выбранному лидеру.':'Сначала выберите свиток Шуншин.',5:'Прокрутите поле: в этом примере выпадет Лес скрытых троп.',6:state.sub===0?'Выберите составную карту: в бой выходит только выбранный лидер.':state.sub===1?'Подтвердите бой лидера: другой участник пары — поддержка.':state.sub===2?'Нажмите «Разрешить дуэль».':'Вспомните: в бой выходит один лидер всей составной карты.'};
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
    if(state.step===4){if(a==='scroll-quiz'&&!state.scrollQuiz){if(value==='IRYO_NINJUTSU'){state.scrollQuiz=true;state.feedback='Верно: лечение действует до боя. Теневые двойники защищают после проигрыша, а Шуншин даёт первый удар.';persist();render();}else{state.feedback='Не совсем. Нужен свиток, который лечит до дуэли, а не защищает от поражения и не даёт первый удар.';trace('recoverable-mistake',{action:'scroll-quiz'});render();}return;}if(!state.scrollQuiz)return; if(a==='choose-scroll'&&!m.scrollSelected){m.scrollSelected=true;state.feedback='Свиток выбран. Назначьте его лидеру справа.';persist();render();return;}
      if(a==='equip'&&m.scrollSelected&&!m.scrollOwner){m.scrollOwner=m.leader;complete('Свиток назначен выбранному лидеру; другие бойцы не получат его автоматически.');return;}}
    if(state.step===5&&a==='arena-quiz'&&m.arenaId){if(value==='sensing'){state.arenaQuiz=true;complete('Верно: в лесу помогают сенсорика, контроль и скрытность. Но победу это не гарантирует.');}else{state.feedback='Попробуйте снова. Лес особенно полезен для сенсорики, скрытности и контроля — это написано на карточке арены.';trace('recoverable-mistake',{action:'arena-quiz'});render();}return;}
    if(state.step===5&&a==='arena-roll'){
      state.busy=true;state.feedback='Определяем арену…';render();state.timer=setTimeout(()=>{if(!state.active||state.step!==5)return;m.arenaId=ARENA;state.busy=false;state.feedback='Выпал Лес скрытых троп. Теперь ответьте на вопрос о его преимуществах.';persist();render();},prefReduced()?100:540);return;
    }
    if(state.step===6){
      if(a==='choose-support'&&state.sub===0){state.feedback='Это лишь участник поддержки, не самостоятельная карта. В дуэль может выйти только составная карта с назначенным лидером.';trace('recoverable-mistake',{action:'choose-support'});render();return;}
      if(a==='choose-card'&&value===m.leader&&state.sub===0){state.chosen=value;state.sub=1;state.feedback='Вы выставили одну составную карту. Сражается лидер, второй участник даёт общий эффект поддержки.';render();return;}
      if(a==='change-fighter'&&state.sub===1){state.sub=0;state.feedback='Выберите другого бойца.';render();return;}
      if(a==='confirm-fighter'&&state.sub===1){state.sub=2;state.feedback='Выбор зафиксирован. Посмотрите на подготовку и проведите дуэль.';render();return;}
      if(a==='fight'&&state.sub===2){const r=realDuel(state.chosen);trace('resolver-demo',{ok:!!r?.ok,errorCode:r?.errorCode||null});if(!r?.ok){state.feedback='Движок не смог рассчитать бой: '+(r?.errorCode||'неизвестная ошибка');render();return;}state.duel=r;state.sub=3;state.feedback='Результат получен от настоящего движка. Сравните четыре этапа расчёта, затем ответьте на вопрос.';render({focusResult:true});return;}
      if(a==='reflect'&&state.sub===3){if(value==='owner'){complete('Верно! Бьётся лидер составной карты; остальные участники поддерживают и разделяют судьбу карты.');}else{state.feedback='Подумайте: связка занимает один слот, и только её лидер выходит на дуэль. Снаряжение остаётся на владельце.';trace('recoverable-mistake',{action:'reflect'});render();}return;}
    }
  }
  function onClick(e){const b=e.target?.closest?.('[data-ac-action]');if(!b||b.disabled||!root?.contains(b))return;e.preventDefault();e.stopPropagation();action(b.dataset.acAction,b.dataset.acValue);}
  function onKeyDown(e){if(!state.active||!root)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(state.guide){state.guide=null;render();}else close();return;}if(e.key!=='Tab')return;const zone=state.guide?root.querySelector('.ac-guide-overlay'):root;const list=[...zone.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(b=>b.getClientRects().length);if(!list.length)return;const i=list.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();list[list.length-1].focus();}else if(!e.shiftKey&&(i===list.length-1||i<0)){e.preventDefault();list[0].focus();}}
  function audit(){const missing=state.active?['academy-root','academy-title'].filter(id=>!$(id)):[];return Object.freeze({version:VERSION,active:state.active,step:state.step,sub:state.sub,total:TOTAL,done:state.done,completed:completed(),skipped:skipped(),missing,mission:JSON.parse(JSON.stringify(state.mission)),duel:state.duel?{...state.duel}:null,profileWrites:0,onlineWrites:0,events:[...state.events.slice(-14)]});}
  document.addEventListener('keydown',onKeyDown,true);
  globalThis.SHINOBI_ACADEMY=Object.freeze({version:VERSION,open,close,gatePlay,skipAndPlay,startTraining,audit,completed,reset:()=>{save({completedAt:null,skipped:false,academyMissionVersion:3,progressStep:0,progressDone:false,scrollQuiz:false,arenaQuiz:false,mission:blank()});if(state.active){state.mission=blank();go(0);return true;}return open({restart:true});}});
})();
