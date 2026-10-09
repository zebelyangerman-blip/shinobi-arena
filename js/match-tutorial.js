/* Обучение встроено в настоящий матч. Никакого отдельного игрового поля. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TABS=[['fighters','Бойцы'],['scrolls','Свитки'],['arenas','Арены'],['links','Связки'],['states','Состояния'],['ranks','Ранги']];
const SCROLL_DESC_RU={
 SHUNSHIN:'Даёт первый удар в дуэли и преимущество в близком бою. Не гарантирует победу.',
 IZANAGI:'Если владелец проиграет, один раз предотвратит его выбывание: он останется «На грани».',
 KAGE_BUNSHIN:'Первое поражение принимает двойник. Владелец останется в состоянии «Ранен».',
 FUINJUTSU:'На одну дуэль подавляет только те способности врага, которые можно заблокировать.',
 EDO_TENSEI:'При допустимых условиях возвращает одного выбывшего союзника в состоянии «Истощён».',
 IRYO_NINJUTSU:'Перед дуэлью улучшает состояние владельца на ступень, если он ранен или истощён.'
};
const scrollDesc = s => SCROLL_DESC_RU[s?.id]||s?.desc||'';
const scrollCases=[
  {q:'Боец ранен. Что поможет восстановиться до новой дуэли?',a:'IRYO_NINJUTSU',options:['IZANAGI','IRYO_NINJUTSU','SHUNSHIN']},
  {q:'Как сохранить владельца после проигранного боя за счёт двойника?',a:'KAGE_BUNSHIN',options:['KAGE_BUNSHIN','EDO_TENSEI','FUINJUTSU']},
  {q:'Чем помешать подавляемым способностям противника?',a:'FUINJUTSU',options:['SHUNSHIN','IZANAGI','FUINJUTSU']},
  {q:'Что может вернуть уже выбывшего союзника истощённым?',a:'EDO_TENSEI',options:['KAGE_BUNSHIN','EDO_TENSEI','IRYO_NINJUTSU']},
  {q:'Как удержать проигравшего владельца «На грани», а не потерять?',a:'IZANAGI',options:['IZANAGI','SHUNSHIN','FUINJUTSU']},
  {q:'Чем получить первый удар в следующей дуэли?',a:'SHUNSHIN',options:['IRYO_NINJUTSU','SHUNSHIN','KAGE_BUNSHIN']}
];
const state={started:false,expanded:false,tab:'fighters',query:'',scrollId:'SHUNSHIN',question:0,answered:false,arenaShown:false,phase:'',coach:null,skipConfirm:false,postTab:'scrolls',postAnswers:{},postError:''};
const rows = x=>Array.isArray(x)?x:Object.values(x||{});
const data=(name,fallback)=>{try{switch(name){case 'fighters':return typeof DB==='undefined'?fallback:DB;case 'scrolls':return typeof SCROLL_TYPES==='undefined'?fallback:Object.values(SCROLL_TYPES);case 'arenas':return typeof ARENA_RULES==='undefined'?fallback:ARENA_RULES;case 'links':return typeof LORE_CARDS==='undefined'?fallback:LORE_CARDS;case 'families':return typeof LORE_EFFECT_FAMILIES==='undefined'?fallback:Object.values(LORE_EFFECT_FAMILIES);case 'states':return typeof ATTRITION_STATE_META==='undefined'?fallback:ATTRITION_STATE_META;case 'ranks':return typeof R20_PROFILE_RULES==='undefined'?fallback:R20_PROFILE_RULES.rankBands;}}catch(_){ }return fallback;};
const fighters=()=>data('fighters',[]),scrolls=()=>data('scrolls',[]),arenas=()=>data('arenas',[]),links=()=>data('links',[]);
const fighter=id=>fighters().find(f=>f.uid===id);
const meta=f=>{try{return typeof getTierRule==='function'?getTierRule(f.tier):null;}catch(_){return null;}};
const ROLE_RU={apex:'универсал высокого класса',area:'контроль площади',assassin:'точечная атака',attrition:'бой на истощение',balanced:'сбалансированный',burst:'быстрый урон',control:'контроль противника',healer:'лечение',melee:'ближний бой',ranged:'дальний бой',sensor:'разведка',specialist:'особые техники',speed:'скорость',summoner:'призыв',support:'поддержка',tank:'защита'};
const RANGE_RU={close:'близкая',long:'дальняя','mid-long':'средняя и дальняя',mixed:'разная'};
function briefFighter(f){
 if(!f)return '';
 const rule=meta(f),roles=(f.archetypes||[]).slice(0,2).map(s=>ROLE_RU[s]||s).map(esc).join(' и ');
 const cp=(typeof COMBAT_PROFILE_BY_FIGHTER_UID!=='undefined')?COMBAT_PROFILE_BY_FIGHTER_UID.get(f.uid):null;
 const skills=(cp?.capabilities||[]).slice(0,2).map(id=>(typeof SHINOBI_COMBAT_CAPABILITIES!=='undefined'?SHINOBI_COMBAT_CAPABILITIES[id]?.name:null)||id).map(esc).join(', ');
 const reach=RANGE_RU[cp?.tactical?.preferredRange]||'зависит от ситуации';
 return `<span class="mt-fighter-inspect"><strong>${esc(f.name)}</strong> · класс ${esc(rule?.label||'?')}<span>Роль: ${roles||'адаптивный боец'}. ${skills?'Особенности: '+skills+'. ':''}Дистанция: ${esc(reach)}. Тир не гарантирует победу: важны контрпик, арена и состояние.</span></span>`;
}
function safePhase(){return document.body?.dataset.r18Phase||'';}
function setExtra(html){const x=$('mt-lesson-extra');if(!x)return;x.innerHTML=html;x.hidden=!state.expanded;}
function contents(){
 const d=state.coach||{},p=state.phase||safePhase();
 if(p==='initiative')return `<p class="mt-detail">Вы управляете отрядом из 5 боевых карт. Этапы: <b>жребий → выбор карт → свитки → арена → дуэли</b>. Победит тот, кто выведет команду соперника из боя. На каждом шаге нужно действовать самому.</p><div class="mt-inline-step"><span>Сейчас:</span><strong>бросьте кубики</strong></div><p>В этом матче жребий и набор карт заранее подготовлены, чтобы можно было учиться на понятных ситуациях. В обычной игре они случайны.</p><p>Ранги бойцов SSS–C и ваш рейтинг Elo — разные вещи. Разницу можно посмотреть в «Правилах».</p>`;
 if(p==='draft'){
  const f=typeof currentChar==='undefined'?null:currentChar;
  let relation='';
  try{if(f&&typeof COMPOSITE_CARDS!=='undefined'&&typeof p1Team!=='undefined'){const pv=COMPOSITE_CARDS.preview(p1Team,f,1);const cs=[...(pv.groups||[]),...(pv.pairs||[])];if(cs.length)relation=`<p class="mt-link-tip">Связь доступна: <strong>${esc(cs[0].title||cs[0].name||'Составная карта')}</strong>. Несколько участников занимают один слот; в бою действует один выбранный лидер.</p>`;}}catch(_){ }
  const isLead=$('r63-leader-modal')&&!$('r63-leader-modal').classList.contains('hidden');
  const card=f?briefFighter(f):'';
  return `<p class="mt-detail">${isLead?'Лидер определяет базовую дуэль, остальные дают поддержку. При выбывании лидера выбывает вся составная карта.':'Забрать (KEEP) — оставить карту себе. Отдать (PASS) — передать сопернику. Даже сильную карту иногда приходится передавать, если её некуда поставить, зато другая карта завершит важную связку.'}</p>${card}${relation}${d.text?`<p class="mt-note">На этой карте: ${esc(d.text)}</p>`:''}<div class="mt-note">Смотрите не только на тир, но и на состав: 5 мест — это ограничение, а контрпик и связи иногда сильнее одной редкой карты.</div>`;
 }
 if(p==='scroll')return scrollPracticeHtml();
 if(p==='arena')return `<p class="mt-detail">Арена общая для обеих команд. Подходящая местность усиливает профиль способностей, но не гарантирует победу. В матче поле определяется прокруткой.</p><div class="mt-mini-cards">${arenas().map(a=>`<button type="button" data-mt-action="arena-info" data-mt-value="${esc(a.id)}" class="mt-mini-card ${state.arenaShown===a.id?'selected':''}"><span>${esc(a.icon)}</span>${esc(a.name)}</button>`).join('')}</div><p class="mt-focus-explain" id="mt-arena-detail">${esc(arenas().find(a=>a.id===state.arenaShown)?.description||'Выберите арену, чтобы увидеть её тактический смысл.')}</p>`;
 if(p==='battle'){
  let enemy='';try{if(typeof arenaSlot2!=='undefined'&&arenaSlot2){enemy=`<p class="mt-note">Открытый соперник: <b>${esc(arenaSlot2.name)}</b>. Если выбираете вторым, ищите выгодный ответ и берегите дорогие карты.</p>`;}}catch(_){ }
  return `<p class="mt-detail">Порядок имеет значение: второй игрок видит выбранную карту и может ответить контрпиком. Выбирайте бойца, подтверждайте его, наблюдайте влияние свитка и арены. Сильнейший тир не равен победе.</p>${enemy}${d.text?`<p class="mt-note">${esc(d.text)}</p>`:''}<p>Состояние бойца ухудшается после тяжёлых дуэлей: свежий → ранен → истощён → на грани → выбыл. Последние четыре состояния уменьшают шансы следующих боёв.</p>`;
 }
 return `<p class="mt-detail">Матч завершён. Теперь вы знаете порядок действий, свитки, связи и тактику ответного выбора. Следующий матч можно провести самостоятельно.</p>`;
}
function scrollPracticeHtml(){const ss=scrolls();const current=ss.find(s=>s.id===state.scrollId)||ss[0];const test=scrollCases[Math.min(state.question,scrollCases.length-1)];let quiz='';if(state.question<scrollCases.length){quiz=`<div class="mt-practice"><div class="mt-practice-count">Практика со свитками · ${state.question+1}/${scrollCases.length}</div><p>${esc(test.q)}</p><div class="mt-answers">${test.options.map(id=>{const s=ss.find(x=>x.id===id);return `<button type="button" data-mt-action="answer" data-mt-value="${esc(id)}">${esc(s?.name?.replace(/^Свиток /,'')||id)}</button>`;}).join('')}</div><div id="mt-answer-feedback" role="status"></div></div>`;}else quiz='<p class="mt-good">Шесть ситуаций разобраны. Теперь примените полученные свитки к реальным бойцам в этом матче.</p>';
return `<p class="mt-detail">У каждого свитка один заряд. В бою выпадет набор кандидатов — назначайте предмет бойцу, который способен использовать его в нужный момент. Выберите свиток ниже для короткого объяснения.</p><div class="mt-mini-cards mt-scroll-grid">${ss.map(s=>`<button type="button" data-mt-action="scroll-info" data-mt-value="${esc(s.id)}" class="mt-mini-card ${s.id===state.scrollId?'selected':''}"><span>${esc(s.emoji)}</span>${esc(s.name.replace(/^Свиток /,''))}</button>`).join('')}</div><p class="mt-focus-explain"><strong>${esc(current?.name||'')}</strong>: ${esc(scrollDesc(current))}</p>${quiz}`;}
function renderCoach(){if(!state.coach)return;const x=$('r33-coach');if(!x)return;const phase=state.phase;const desc=$('r33-coach-text');if(desc){const d=state.coach;const rules={initiative:'Добро пожаловать! Здесь вы научитесь игре прямо в матче. Начните с жребия: победитель выбирает первым.',draft:'Оцените карту и составы. Забрать или отдать?',scroll:'Назначьте подходящий свиток бойцу. Каждый действует по-своему.',arena:'Прокрутите арену: условия меняют преимущества бойцов.',battle:'Выберите бойца, оцените контрпик и подтвердите выбор.',end:'Учебный матч завершён.'};let text=rules[phase]||d.text;
 const brief=t=>{const clean=String(t||'').replace(/\s+/g,' ').replace(/matchup/gi,'дуэли').replace(/\bCPU\b/g,'соперник').trim();return clean.length>160?clean.slice(0,156).replace(/\s+\S*$/,'')+'…':clean;};
 if(phase==='draft'&&typeof currentChar!=='undefined'&&currentChar)text=brief(d.text)||`${currentChar.name}: забрать или отдать?`;
 if(phase==='scroll')text='Выберите свиток, затем бойца-получателя. После назначения подтвердите комплект.';
 if(phase==='battle'&&d.text){
  const advice=brief(d.text),coverage=advice.match(/^(.+?) покрывает (\d+)\/(\d+)/);
  if(d.title?.includes('Выберите открывающего')&&coverage)text=`Совет: ${coverage[1]} полезен против ${coverage[2]} из ${coverage[3]} бойцов соперника.`;
  else if(d.title?.includes('Выберите контрпик'))text='Соперник уже открыл карту. Выберите подходящий ответ.';
  else if(d.title?.includes('Подтвердите'))text='До подтверждения выбор можно изменить. Затем зафиксируйте бойца.';
  else if(d.title?.includes('CPU'))text='Соперник выбирает бойца. Скоро ваш ход.';
  else if(d.title?.includes('Дуэль готова'))text='Оба бойца выбраны. Запустите дуэль.';
  else{const first=(advice.match(/^[^.!?]+[.!?]?/)||[advice])[0];text=first.length<=86?first:brief(first.slice(0,82));}
 }if(d.title?.toLowerCase().includes('лидер'))text='Выберите лидера связи. Другие участники поддержат, но не будут отдельными картами.';if(d.title?.includes('CPU'))text='Соперник делает ход. Скоро ваш выбор.';if(d.title?.includes('Связ'))text='Несколько персонажей могут объединиться в одну карту. Нужен лидер.';desc.textContent=text;}
 const strong=$('r33-coach-title');if(strong&&state.coach.title){let title=state.coach.title.replace(/Рекомендация:\s*(KEEP|PASS)/,'Совет: $1').replace('Фиксированный жребий для обучения','Начните с жребия').replace('Наблюдайте решение Easy CPU','Ход соперника').replace('CPU готовит фиксированный закрытый набор','Подготовка соперника');strong.textContent=title;}
 setExtra(contents()+(state.expanded?'<button type="button" class="mt-jump-action" data-mt-action="jump">К ИГРОВОМУ ДЕЙСТВИЮ ↓</button>':''));
 const expand=$('[mt-expand]')||document.querySelector('[data-mt-action="expand"]');if(expand){expand.textContent=state.expanded?'СВЕРНУТЬ':phase==='scroll'?'6 ПРИМЕРОВ':'ПОДРОБНЕЕ';expand.setAttribute('aria-expanded',String(state.expanded));expand.setAttribute('aria-controls','mt-lesson-extra');}
 x.classList.toggle('mt-expanded',state.expanded);x.dataset.mtPhase=phase;const skip=x.querySelector('[data-mt-action=skip]');if(skip)skip.hidden=phase==='end';
}
function openReference(tab='fighters'){state.tab=tab;state.query='';const p=$('mt-reference');if(!p)return;p.hidden=false;document.body.classList.add('mt-reference-open');renderReference();p.querySelector('[data-mt-action="close-reference"]')?.focus();}
function closeReference(){const p=$('mt-reference');if(p)p.hidden=true;document.body.classList.remove('mt-reference-open');}
function renderReference(){const root=$('mt-reference');if(!root||root.hidden)return;root.querySelector('.mt-reference-tabs').innerHTML=TABS.map(([id,label])=>`<button type="button" role="tab" data-mt-action="tab" data-mt-value="${id}" aria-selected="${id===state.tab?'true':'false'}">${label}</button>`).join('');let html='';const search=`<label class="mt-search-label">Поиск <input id="mt-search" placeholder="Имя или свойство" value="${esc(state.query)}" autocomplete="off"></label>`;const q=state.query.trim().toLocaleLowerCase('ru-RU');
 if(state.tab==='fighters'){const all=fighters(),flt=all.filter(f=>`${f.name} ${(f.archetypes||[]).join(' ')}`.toLocaleLowerCase('ru-RU').includes(q));html=search+`<p class="mt-count">${flt.length} из ${all.length} бойцов. На поле вы изучаете каждого по мере появления.</p><div class="mt-list">${flt.slice(0,24).map(f=>`<div class="mt-roster-line"><img loading="lazy" src="assets/portraits/${esc(f.uid)}.webp" alt=""><div>${briefFighter(f)}</div></div>`).join('')}</div>${flt.length>24?'<p>Уточните поиск, чтобы увидеть остальных.</p>':''}`;}
 if(state.tab==='scrolls')html=`<p>Свиток привязывается к владельцу и обычно расходуется один раз. Нельзя считать, что любой свиток автоматически выигрывает бой.</p><div class="mt-list">${scrolls().map(s=>`<div class="mt-library-line"><strong>${esc(s.emoji)} ${esc(s.name)}</strong><p>${esc(scrollDesc(s))}</p></div>`).join('')}</div>`;
 if(state.tab==='arenas')html=`<p>Поле действует сразу на обе команды. Выбор бойца нужно сопоставлять с местностью.</p><div class="mt-list">${arenas().map(a=>`<div class="mt-library-line"><strong>${esc(a.icon)} ${esc(a.name)}</strong><p>${esc(a.description)} Подходят: ${esc((a.tags||[]).join(', '))}.</p></div>`).join('')}</div>`;
 if(state.tab==='links'){const all=links(),flt=all.filter(l=>`${l.title||l.name||''} ${(l.members||[]).map(id=>fighter(id)?.name||'').join(' ')}`.toLocaleLowerCase('ru-RU').includes(q));html=search+`<p class="mt-count">${flt.length} из ${all.length} комбинаций. Пара занимает один слот и имеет один заряд эффекта; группа — два заряда.</p><div class="mt-list">${flt.slice(0,24).map(l=>`<div class="mt-library-line"><strong>${esc(l.title||l.name||l.id)}</strong><p>${esc((l.members||[]).map(id=>fighter(id)?.name||id).join(' + '))} · ${esc(data('families',[]).find(f=>f.id===l.effectFamily)?.label||'совместное действие')}.</p></div>`).join('')}</div>${flt.length>24?'<p>Уточните имя, чтобы найти другую связку.</p>':''}`;}
 if(state.tab==='states')html='<p>После тяжёлой дуэли боец может ослабнуть. Эти состояния влияют на его эффективность.</p><div class="mt-list">'+data('states',[]).map(s=>`<div class="mt-library-line"><strong>${esc(s.label)}</strong><p>Эффективность: ${Math.round((Number(s.multiplier)||0)*100)}%. ${s.selectable?'Можно выставлять в бой.':'Выбыл, недоступен для боя.'}</p></div>`).join('')+'</div>';
 if(state.tab==='ranks'){html='<p><b>Тир SSS–C</b> — класс и редкость конкретного персонажа. <b>Рейтинг Elo</b> — ваш личный прогресс за завершённые рейтинговые серии. Не путайте их: редкая карта не гарантирует победу.</p><div class="mt-list">'+data('ranks',[]).map(r=>`<div class="mt-library-line"><strong>${esc(r.name)}</strong><p>От ${Number(r.min)} Elo</p></div>`).join('')+'</div><p>Учебный матч не начисляет рейтинг или монеты.</p>';
 }
 root.querySelector('.mt-reference-body').innerHTML=html;
}
// Small post-match reinforcement inside the native result screen, not a second minigame.
// This panel has no game writes and never appears during the battle animation.
const POST_LESSONS=[
 {id:'scrolls',title:'Свитки',reference:'scrolls',icon:'📜',
  summary:'Свиток назначается конкретному бойцу. У него ограниченный заряд; эффект зависит от ситуации и не гарантирует победу.',
  example:'Пример: раненого бойца стоит подготовить к следующему раунду, а не тратить атакующий свиток наугад.',
  question:'Боец ранен перед следующей дуэлью. Что поможет восстановить его состояние?',
  choices:[['SHUNSHIN','Теневой рывок'],['IRYO_NINJUTSU','Исцеляющая печать'],['KAGE_BUNSHIN','Теневые двойники']],answer:'IRYO_NINJUTSU',
  why:'Исцеляющая печать улучшает состояние раненого или истощённого владельца перед боем. Рывок даёт первый удар, двойники защищают от поражения.'},
 {id:'links',title:'Связки',reference:'links',icon:'✦',
  summary:'Связка объединяет участников в одну боевую карту. Выбранный лидер сражается, остальные усиливают его своим эффектом.',
  example:'Пример: Наруто и Саске могут стать одной картой, но вместе несут и общий риск поражения.',
  question:'Что происходит с составной картой, если её лидер окончательно выбывает?',
  choices:[['one','Теряется только лидер, остальные остаются'],['all','Выбывает вся составная карта'],['scroll','Пропадает только свиток']],answer:'all',
  why:'У составной карты общая судьба. Если лидер окончательно выбыл, все участники этой карты покидают бой; поддержка не превращается в отдельные карты.'},
 {id:'arenas',title:'Арены',reference:'arenas',icon:'◎',
  summary:'Арена действует на обе команды. Местность усиливает подходящие свойства персонажей, но не отменяет обычные контрпики.',
  example:'Пример: на водных каналах важен профиль бойца, а не только его редкость SSS, S или A.',
  question:'Как лучше выбрать бойца после определения арены?',
  choices:[['tier','Всегда брать самый высокий тир'],['fit','Учитывать местность, контрпик и состояние'],['ignore','Не учитывать арену']],answer:'fit',
  why:'Местность может усилить определённые способности, однако также важны открытый противник, его слабости и износ бойцов.'}
];
function postLesson(id){return POST_LESSONS.find(x=>x.id===id)||POST_LESSONS[0];}
function postStatus(){return POST_LESSONS.filter(x=>!!state.postAnswers[x.id]).length;}
function removePostMatch(){document.getElementById('mt-postmatch-review')?.remove();}
function renderPostMatch(){
 const root=$('mt-postmatch-review');if(!root)return;
 const l=postLesson(state.postTab),done=!!state.postAnswers[l.id],num=postStatus(),all=num===POST_LESSONS.length;
 const next=POST_LESSONS.find(x=>!state.postAnswers[x.id]&&x.id!==l.id);
 root.innerHTML=`<div class="mt-review-head"><div><span class="mt-review-eyebrow">ПОСЛЕ МАТЧА · 3 КОРОТКИХ ПОВТОРЕНИЯ</span><h3>Закрепите главное</h3></div><span class="mt-review-progress" aria-label="Проверено ${num} из 3">${num}/3</span></div>
 <p class="mt-review-intro">Вспомните, как сработали механики в бою. Это необязательно: можно вернуться в штаб в любой момент.</p>
 <div class="mt-review-tabs" role="tablist" aria-label="Темы повторения">${POST_LESSONS.map(x=>`<button type="button" role="tab" data-mt-action="post-tab" data-mt-value="${x.id}" aria-selected="${l.id===x.id}" class="${l.id===x.id?'selected':''}">${esc(x.title)} ${state.postAnswers[x.id]?'✓':''}</button>`).join('')}</div>
 <div class="mt-review-lesson" role="tabpanel"><h4>${esc(l.icon)} ${esc(l.title)} — как это работает</h4><p>${esc(l.summary)}</p><p class="mt-review-example">${esc(l.example)}</p>
 <div class="mt-review-question"><strong>${esc(l.question)}</strong><div class="mt-review-answers">${l.choices.map(([id,text])=>`<button type="button" data-mt-action="post-answer" data-mt-value="${esc(id)}" ${done?'disabled':''} class="${done&&id===l.answer?'correct':''}">${esc(text)}</button>`).join('')}</div>
 <p class="mt-review-feedback ${done?'correct':state.postError?'incorrect':''}" role="status" aria-live="polite">${done?'Верно. '+esc(l.why):esc(state.postError)}</p></div>
 <div class="mt-review-footer"><button type="button" class="mt-review-more" data-mt-action="post-reference" data-mt-value="${l.reference}">Все правила раздела ↗</button>${next?`<button type="button" class="mt-review-next" data-mt-action="post-tab" data-mt-value="${next.id}">Следующее: ${esc(next.title)} →</button>`:all?'<span class="mt-review-done">Главное закреплено. Можно переходить к самостоятельной игре.</span>':''}</div></div>`;
}
function ensurePostMatch(){
 if(safePhase()!=='end'||!globalThis.R34_GUIDED_SCENARIO?.status?.().active)return false;
 const end=$('end-screen'),progress=$('progression-results-panel'),action=$('end-action-btn');if(!end||!progress||!action)return false;
 let panel=$('mt-postmatch-review');if(!panel){panel=document.createElement('section');panel.id='mt-postmatch-review';panel.className='mt-postmatch-review';panel.setAttribute('aria-label','Закрепление материала после учебного матча');progress.insertAdjacentElement('afterend',panel);}
 renderPostMatch();return true;
}
function onAction(e){const b=e.target.closest('[data-mt-action]');if(!b)return;const action=b.dataset.mtAction,value=b.dataset.mtValue;e.preventDefault();
 if(action==='post-tab'){state.postTab=value;state.postError='';renderPostMatch();$('mt-postmatch-review')?.querySelector('[data-mt-action=post-tab][data-mt-value="'+value+'"]')?.focus();return;}
 if(action==='post-answer'){const lesson=postLesson(state.postTab);if(state.postAnswers[lesson.id])return;if(value===lesson.answer){state.postAnswers[lesson.id]=true;state.postError='';}else{state.postError='Не совсем так. Подумайте, какую задачу решает эта механика, и выберите другой ответ.';}renderPostMatch();return;}
 if(action==='post-reference'){openReference(value||'scrolls');return;}
 if(action==='expand'){state.skipConfirm=false;state.expanded=!state.expanded;renderCoach();}
 if(action==='jump'){
  const targets=['.r34-recommended:not(.hidden)','.r33-focus:not(.hidden)',...(state.phase==='arena'?['#roll-arena-btn:not(.hidden)','#enter-battle-btn:not(.hidden)']:state.phase==='battle'?['#lock-p1-btn:not(.hidden)','#fight-btn:not(.hidden)','#p1-roster']:state.phase==='scroll'?['#scroll-selection-area:not(.hidden)','#roll-scrolls-btn:not(.hidden)']:[])];
  const target=targets.map(s=>document.querySelector(s)).find(n=>n&&!n.closest('#r33-coach')&&n.getClientRects().length);
  state.expanded=false;renderCoach();requestAnimationFrame(()=>{try{(target||document.getElementById((state.phase==='arena'?'arena':'battle')+'-phase'))?.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});}catch(_){}});
 }
 if(action==='reference')openReference(state.phase==='scroll'?'scrolls':state.phase==='arena'?'arenas':state.phase==='draft'?'fighters':'states');
 if(action==='close-reference')closeReference();
 if(action==='tab'){state.tab=value;state.query='';renderReference();}
 if(action==='scroll-info'){state.scrollId=value;renderCoach();}
 if(action==='arena-info'){state.arenaShown=value;renderCoach();}
 if(action==='answer'){const q=scrollCases[state.question];if(!q||state.answered)return;const ok=q.a===value;const fb=$('mt-answer-feedback');if(fb){fb.className=ok?'mt-good':'mt-error';fb.textContent=ok?'Верно. '+scrollDesc(scrolls().find(s=>s.id===q.a)):'Попробуйте ещё раз: выберите свиток, который соответствует описанной ситуации.';}if(ok){state.answered=true;setTimeout(()=>{state.question++;state.answered=false;if(state.phase==='scroll')renderCoach();},1100);}}
 if(action==='skip'){state.skipConfirm=!state.skipConfirm;const box=$('mt-lesson-extra');if(state.skipConfirm){state.expanded=true;renderCoach();box.insertAdjacentHTML('beforeend','<p class="mt-warning">Пропустить обучение? Его можно запустить позже через кнопку «Обучение» в штабе.</p><button class="mt-confirm-skip" data-mt-action="confirm-skip">ПРОПУСТИТЬ И ВЕРНУТЬСЯ В ШТАБ</button>');}}
 if(action==='confirm-skip'){try{r21UpdateSettings({tutorial:{dismissedFirstRun:true}});}catch(_){ }state.skipConfirm=false;closeReference();globalThis.R34_GUIDED_SCENARIO?.teardown?.();globalThis.R33_GUIDED_MATCH?.abort?.();}
}
function attachCoach(){const c=$('r33-coach'),main=$('main-container');if(!c||!main||!document.body?.classList.contains('r34-training-active'))return;if(!document.body.classList.contains('r67-mobile')&&c.parentNode!==main)main.prepend(c);}
function init(){document.addEventListener('click',onAction);document.addEventListener('input',e=>{if(e.target?.id==='mt-search'){const caret=e.target.selectionStart;state.query=e.target.value;renderReference();const n=$('mt-search');n?.focus();n?.setSelectionRange(caret,caret);}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mt-reference')?.hidden){e.preventDefault();closeReference();}});
 document.addEventListener('mt:coach',e=>{const d=e.detail||{};const old=state.phase,prevTitle=state.coach?.title;state.coach=d;state.phase=d.phase||safePhase();if(old!==state.phase){state.expanded=false;state.arenaShown=false;state.skipConfirm=false;closeReference();}
 if(state.phase==='initiative'&&old!=='initiative'){removePostMatch();state.postTab='scrolls';state.postAnswers={};state.postError='';}
 if(prevTitle!==d.title&&state.phase!=='scroll'&&state.phase!=='end'){state.expanded=false;state.skipConfirm=false;}
 if(state.phase==='end'){
   // End-screen recap replaces the instructor strip; no overlay blocks the R80 victory presentation.
   $('r33-coach')?.classList.add('hidden');setTimeout(ensurePostMatch,75);
 }else{renderCoach();setTimeout(attachCoach,0);} });
 // Re-evaluate advice when the native game displays the next draft card.
 let draftRaf=0;
 const onDraftChanged=()=>{if(draftRaf)clearTimeout(draftRaf);draftRaf=setTimeout(()=>{draftRaf=0;if(safePhase()==='draft')globalThis.R34_GUIDED_SCENARIO?.refresh?.();},85);};
 for(const id of ['draft-name','draft-current-player-badge']){const el=$(id);if(el)new MutationObserver(onDraftChanged).observe(el,{childList:true,characterData:true,subtree:true});}
 const actions=$('r33-coach')?.querySelector('.r33-coach-actions');if(actions){const b=document.createElement('button');b.type='button';b.textContent='ПРОПУСТИТЬ';b.setAttribute('data-mt-action','skip');actions.append(b);}
 const params=new URLSearchParams(location.search);const settings=()=>{try{return r21GetSettings().tutorial||{};}catch(_){return {};}};
 const shouldStart=()=>params.get('tutorial')==='1'||(!settings().completed&&!settings().dismissedFirstRun);
 const start=()=>{if(state.started||!shouldStart())return;const mode=document.body?.dataset.r18Phase;if(mode&&mode!=='hub')return;const ok=globalThis.R34_GUIDED_SCENARIO?.start?.();if(ok){state.started=true;document.body?.classList.add('mt-first-run');setTimeout(attachCoach,50);}};
 setTimeout(start,120);
 document.addEventListener('r34:mode-change',e=>{if(e.detail?.active===false){removePostMatch();state.postError='';state.postAnswers={};state.postTab='scrolls';}});
 document.addEventListener('r34:ready',()=>setTimeout(start,35));window.addEventListener('resize',()=>setTimeout(attachCoach,130));
 globalThis.MATCH_TUTORIAL=Object.freeze({version:2,openReference,closeReference,start:()=>globalThis.R34_GUIDED_SCENARIO?.start?.(),status:()=>({started:state.started,phase:state.phase,question:state.question,referenceOpen:!$('mt-reference')?.hidden,postMatch:{visible:!!$('mt-postmatch-review'),completed:postStatus(),tab:state.postTab}})});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
