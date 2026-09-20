window.DetectiveGame = (() => {
  const sources = [
    {era:'西周', truth:'西周以分封親戚與功臣鞏固統治，貴族享有世襲的政治特權。', lie:'西周平民只要勤勉讀書，就能參加科舉考試，考取後受封為諸侯。', explanation:'西周以封建與世襲維繫統治；科舉制度始於隋代，並非西周的選才方式。'},
    {era:'秦代', truth:'秦始皇全面推行郡縣制，郡縣官員由中央直接任免，不得世襲。', lie:'秦始皇全面推行郡縣制，郡守與縣令的職位由長子世代繼承。', explanation:'秦代郡縣官員由中央直接任免，官職不得世襲；這有利於中央掌控地方。'},
    {era:'魏晉南北朝', truth:'九品官人之法後來逐漸偏重家世門第，形成「上品無寒門，下品無世族」的現象。', lie:'九品官人之法後來特別偏重提拔貧寒農民，形成「上品皆寒門」的現象。', explanation:'九品官人之法原先兼重家世、才能與德行，後來逐漸偏重門第，使世族在選官中占有優勢。'}
  ];
  let items=[], placements={}, selected=null, settled=false, drag=null;
  const el=id=>document.getElementById(id);
  const zone=value=>document.querySelector('[data-verdict="'+value+'"]');
  function choose(id) {
    if(settled)return;
    selected=id;
    document.querySelectorAll('.evidence-card').forEach(card=>card.classList.toggle('is-selected',card.dataset.evidence===id));
    el('detectiveStatus').textContent='已選取史料 '+(Number(id)+1)+'，請拖曳或選擇真相／謊言區。';
  }
  function place(id,value) {
    if(settled||!items.some(i=>i.id===id)||!['true','false'].includes(value))return;
    placements[id]=value==='true';selected=null;
    zone(value).querySelector('.verdict-cards').appendChild(document.querySelector('[data-evidence="'+id+'"]'));
    document.querySelectorAll('.evidence-card').forEach(card=>card.classList.remove('is-selected'));
    const count=Object.keys(placements).length;
    el('errorsFoundCount').textContent=count;
    el('detectiveStatus').textContent='已分類 '+count+'／3 則；全部放好前可移動更改。';
    if(count===3)finish();
  }
  function finish() {
    if(settled)return;settled=true;
    const correct=items.filter(i=>placements[i.id]===i.isTrue).length;
    document.querySelectorAll('.evidence-card').forEach(card=>{
      const item=items.find(i=>i.id===card.dataset.evidence),ok=placements[item.id]===item.isTrue;
      card.disabled=true;card.classList.add(ok?'verdict-correct':'verdict-wrong');
      const result=document.createElement('span');result.className='evidence-verdict';
      result.textContent=(ok?'判斷正確':'判斷錯誤')+' · 實際為'+(item.isTrue?'真相':'謊言');card.appendChild(result);
    });
    document.querySelectorAll('.verdict-zone').forEach(z=>{z.setAttribute('aria-disabled','true');z.tabIndex=-1;});
    if(correct===3)sounds.fanfare();else sounds.wrong();
    if(correct)addPoints(correct*20,correct);
    if(correct===3)addPoints(20,1,'火眼金睛歷史神探');
    el('detectiveStatus').textContent='答案已揭曉：'+correct+'／3 則判斷正確。';
    const results=el('detectiveResults');results.hidden=false;results.replaceChildren();
    const heading=document.createElement('h4');heading.textContent='真相揭曉 · '+correct+'／3 則正確';results.appendChild(heading);
    const score=document.createElement('p');score.textContent='本關獲得 '+(correct*20+(correct===3?20:0))+' 分（每則答對 20 分，全對另加 20 分）。';results.appendChild(score);
    items.forEach(item=>{
      const article=document.createElement('article');const title=document.createElement('h5');
      title.textContent='史料 '+(Number(item.id)+1)+'｜'+item.era+'：'+(item.isTrue?'真相':'謊言');
      const verdict=document.createElement('p');verdict.textContent='你的分類：'+(placements[item.id]?'真相':'謊言')+'。'+item.explanation;
      article.append(title,verdict);results.appendChild(article);
    });
    // Settle immediately, but keep the explanations visible until the player opens the total report.
    completeAllChallenges(false);
    if(correct<3)el('finalEvaluation').textContent='已完成五道歷史挑戰！最後一關判斷正確 '+correct+'／3 則，請對照解析複習制度差異。';
    const button=document.createElement('button');button.className='primary-btn';button.textContent='查看總成績與學習證書';
    button.onclick=()=>el('challengeCompleteModal').classList.add('show');results.appendChild(button);
  }
  function init() {
    placements={};selected=null;settled=false;
    const trueIndex=Math.floor(Math.random()*sources.length);
    items=sources.map((s,i)=>({...s,id:String(i),isTrue:i===trueIndex,text:i===trueIndex?s.truth:s.lie}));
    el('errorsFoundCount').textContent='0';el('detectiveResults').hidden=true;el('detectiveResults').replaceChildren();
    el('detectiveStatus').textContent='請分類三張史料卡片。';
    document.querySelectorAll('.verdict-zone').forEach(z=>{z.querySelector('.verdict-cards').replaceChildren();z.removeAttribute('aria-disabled');z.tabIndex=0;});
    const content=el('scrollContent');content.replaceChildren();
    const intro=document.createElement('p');intro.className='evidence-intro';intro.textContent='啟稟陛下：臣蒐得三則歷代制度的傳聞，其中一則屬實、兩則有誤，請依史實辨明真偽。';content.appendChild(intro);
    items.forEach(item=>{
      const card=document.createElement('button');card.type='button';card.className='evidence-card';card.dataset.evidence=item.id;
      const label=document.createElement('span');label.className='evidence-label';label.textContent='史料 '+(Number(item.id)+1)+' · '+item.era;
      const text=document.createElement('span');text.className='evidence-text';text.textContent=item.text;
      card.append(label,text);card.onclick=()=>choose(item.id);
      card.addEventListener('pointerdown',e=>{
        if(settled||e.button!==0)return;
        choose(item.id);drag={id:item.id,pointer:e.pointerId,x:e.clientX,y:e.clientY,card,ghost:null};card.setPointerCapture(e.pointerId);
      });content.appendChild(card);
    });
  }
  function clearDrag(){
    if(!drag)return;
    drag.ghost?.remove();drag.card.classList.remove('is-dragging');
    if(drag.card.hasPointerCapture(drag.pointer))drag.card.releasePointerCapture(drag.pointer);
    document.querySelectorAll('.verdict-zone').forEach(z=>z.classList.remove('is-over'));drag=null;
  }
  document.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;
    if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;
    if(!drag.ghost){drag.ghost=drag.card.cloneNode(true);drag.ghost.removeAttribute('data-evidence');drag.ghost.setAttribute('aria-hidden','true');drag.ghost.classList.add('evidence-ghost');drag.ghost.style.width=Math.min(drag.card.offsetWidth,300)+'px';document.body.appendChild(drag.ghost);drag.card.classList.add('is-dragging');}
    drag.ghost.style.left=e.clientX+12+'px';drag.ghost.style.top=e.clientY+12+'px';
    const hovered=document.elementFromPoint(e.clientX,e.clientY)?.closest('.verdict-zone');
    document.querySelectorAll('.verdict-zone').forEach(z=>z.classList.toggle('is-over',z===hovered));
    if(e.clientY>innerHeight-60)window.scrollBy(0,14);else if(e.clientY<60)window.scrollBy(0,-14);
  });
  document.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;
    const id=drag.id,wasDragged=!!drag.ghost;
    const dest=wasDragged?document.elementFromPoint(e.clientX,e.clientY)?.closest('.verdict-zone'):null;
    clearDrag();if(dest)place(id,dest.dataset.verdict);
  });
  document.addEventListener('pointercancel',clearDrag);
  document.querySelectorAll('.verdict-zone').forEach(z=>{
    z.onclick=e=>{if(!e.target.closest('.evidence-card')&&selected!==null)place(selected,z.dataset.verdict);};
    z.onkeydown=e=>{if(e.target===z&&['Enter',' '].includes(e.key)){e.preventDefault();if(selected!==null)place(selected,z.dataset.verdict);}};
  });
  return {init};
})();
