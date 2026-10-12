(function(){
  const tip=document.createElement('div');
  tip.className='ws-tooltip';
  tip.setAttribute('role','status');
  document.body.appendChild(tip);
  let timer;
  function show(text,x,y){
    clearTimeout(timer); tip.innerHTML=text; tip.classList.add('show');
    const pad=12, r=tip.getBoundingClientRect();
    let left=x+14, top=y-r.height-12;
    if(left+r.width>innerWidth-pad) left=innerWidth-r.width-pad;
    if(left<pad) left=pad;
    if(top<pad) top=y+16;
    tip.style.left=left+'px'; tip.style.top=top+'px';
  }
  function hide(){timer=setTimeout(()=>tip.classList.remove('show'),80)}
  window.WashSenseInteractive={showTooltip:show,hideTooltip:hide};
  document.addEventListener('mouseover',e=>{const el=e.target.closest('[data-tip]');if(!el)return;const r=el.getBoundingClientRect();show(el.dataset.tip,r.left+r.width/2,r.top)});
  document.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]'))hide()});
})();
