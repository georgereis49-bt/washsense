const toast=document.getElementById('toast');
let toastTimer;
function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2400)}
const sidebar=document.getElementById('sidebar');
document.getElementById('menuBtn')?.addEventListener('click',()=>sidebar.classList.toggle('open'));
document.getElementById('refreshBtn')?.addEventListener('click',e=>{e.currentTarget.style.transform='rotate(360deg)';setTimeout(()=>e.currentTarget.style.transform='',350);showToast('Dados atualizados — última leitura agora');});
document.getElementById('bellBtn')?.addEventListener('click',()=>showToast('Você tem 2 alertas que precisam de atenção.'));

const consumptionSets={
 'Hoje':{values:[102,117,111,134,126,124,128],labels:['08h','10h','12h','14h','16h','18h','Agora'],total:'128 L',delta:'↓ 6,4%',subtitle:'Litros consumidos ao longo de hoje'},
 'Últimos 7 dias':{values:[102,117,111,134,126,124,128],labels:['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'],total:'842 L',delta:'↓ 6,4%',subtitle:'Litros consumidos nos últimos 7 dias'},
 'Últimos 30 dias':{values:[118,126,121,132,129,124,128,135,130,127,122,136,131,125,129,133,127,124,138,132,129,126,121,130,128,134,125,127,123,128],labels:Array.from({length:30},(_,i)=>i===29?'Hoje':String(i+1)),total:'3.860 L',delta:'↓ 4,1%',subtitle:'Litros consumidos nos últimos 30 dias'}
};
let currentPeriod='Últimos 7 dias';
function renderConsumptionChart(period=currentPeriod){
 const set=consumptionSets[period]||consumptionSets['Últimos 7 dias'];
 const host=document.querySelector('#consumo .chart-area'); if(!host)return;
 const old=host.querySelector('.ws-bar-chart');if(old)old.remove();
 const x=host.querySelector('.x-labels');if(x)x.innerHTML=set.labels.map(v=>`<span>${v}</span>`).join('');
 const max=Math.max(...set.values,160), avg=set.values.reduce((a,b)=>a+b,0)/set.values.length;
 const chart=document.createElement('div');chart.className='ws-bar-chart';
 chart.innerHTML=set.values.map((v,i)=>{const h=Math.max(5,v/max*100),lab=set.labels[i];return `<button class="ws-consumption-bar ${i===set.values.length-1?'is-today':''}" style="--bar-height:${h}%" data-tip="<strong>${lab}</strong><br><span>${v} L consumidos</span>" aria-label="${lab}: ${v} litros"><i></i></button>`}).join('');
 host.insertBefore(chart,x||null);
 const line=document.createElement('div');line.className='ws-average-line';line.style.bottom=(avg/max*100)+'%';line.innerHTML=`<span>Média ${avg.toFixed(0)} L</span>`;chart.appendChild(line);
 document.querySelector('#consumo .chart-total strong')?.replaceChildren(document.createTextNode(set.total));
 document.querySelector('#consumo .chart-total span')?.replaceChildren(document.createTextNode(set.delta));
 const sub=document.querySelector('#consumo .panel-title p');if(sub)sub.textContent=set.subtitle;
 chart.querySelectorAll('.ws-consumption-bar').forEach(b=>b.addEventListener('click',()=>showToast(b.dataset.tip.replace(/<[^>]*>/g,' '))));
}
const periodBtn=document.getElementById('periodBtn');
periodBtn?.addEventListener('click',e=>{const options=['Hoje','Últimos 7 dias','Últimos 30 dias'];const current=e.currentTarget.firstChild.textContent.trim();currentPeriod=options[(options.indexOf(current)+1)%options.length];e.currentTarget.firstChild.textContent=currentPeriod+' ';renderConsumptionChart(currentPeriod);showToast('Período alterado para '+currentPeriod)});

document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');if(innerWidth<760)sidebar.classList.remove('open')}));
document.querySelectorAll('[data-detail]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button')&&e.currentTarget.tagName!=='BUTTON')return;const detail=e.currentTarget.dataset.detail,id=e.currentTarget.dataset.id;let url='details.html?view='+encodeURIComponent(detail);if(id)url+='&id='+encodeURIComponent(id);location.href=url}));

document.querySelectorAll('.tank').forEach(t=>{const name=t.querySelector('.tank-top strong')?.textContent||'Reservatório',pct=t.querySelector('.tank-top b')?.textContent||'',liters=t.querySelector('.tank-top small')?.textContent||'',forecast=t.querySelector('.tank-bottom b')?.textContent||'';t.dataset.tip=`<strong>${name}</strong><br><span>${pct} · ${liters}</span><br><span>Autonomia: ${forecast}</span>`});
document.querySelectorAll('.machine .progress').forEach(b=>{const card=b.closest('.machine');const name=card?.querySelector('strong')?.textContent||'Máquina';const val=card?.querySelector('.machine-foot span')?.textContent||'';b.dataset.tip=`<strong>${name}</strong><br><span>${val==='Pronta'?'Pronta para operação':'Progresso do ciclo: '+val}</span>`});
const eff=document.querySelector('.eff-bar');if(eff)eff.dataset.tip='<strong>Eficiência operacional</strong><br><span>92% no período atual</span>';
renderConsumptionChart();


(function renderEnergyDashboard(){
  const costEl=document.getElementById('dashEnergyCost');
  if(!costEl) return;
  const kwh=1248;
  try{
    const cfg=JSON.parse(localStorage.getItem('washsenseEnergyConfig')||'null');
    if(!cfg){ return; }
    const base=Number(cfg.base||0);
    const cost=kwh*base;
    costEl.textContent=cost.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const meta=document.getElementById('dashEnergyMeta');
    if(meta) meta.textContent=`${cfg.agent||cfg.distributor} · ${cfg.subgroup||'Grupo '+cfg.group}`;
    const unit=document.getElementById('dashEnergyUnit');
    if(unit) unit.textContent=base.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:4,maximumFractionDigits:4})+'/kWh';
    const valid=document.getElementById('dashEnergyValidity');
    if(valid) valid.textContent=cfg.start ? `Vigência desde ${new Date(cfg.start+'T00:00:00').toLocaleDateString('pt-BR')}` : 'Tarifa vigente';
  }catch(e){}
})();
