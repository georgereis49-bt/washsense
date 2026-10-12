const $ = (s) => document.querySelector(s);
const toast = $('#toast');
let toastTimer;
function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2400)}
const params = new URLSearchParams(location.search);
const view = params.get('view') || 'reservatorios';
const id = params.get('id') || 'detergente';
const machineId = params.get('machine') || 'M01';
const sidebar = $('#sidebar');
$('#menuBtn')?.addEventListener('click',()=>sidebar.classList.toggle('open'));
$('#backBtn')?.addEventListener('click',()=>history.length>1?history.back():location.href='dashboard.html');
$('#backLink')?.addEventListener('click',()=>location.href='dashboard.html');
$('#refreshBtn')?.addEventListener('click',e=>{e.currentTarget.style.transform='rotate(360deg)';setTimeout(()=>e.currentTarget.style.transform='',350);showToast('Dados atualizados — última leitura agora');});
$('#periodBtn')?.addEventListener('click',e=>{const opts=['Hoje','Últimos 7 dias','Últimos 30 dias','Últimos 90 dias'];const label=e.currentTarget.childNodes[0];const current=label.textContent.trim();const next=opts[(opts.indexOf(current)+1)%opts.length];label.textContent=next+' ';showToast('Período alterado para '+next);});

document.querySelectorAll('.nav a[data-view]').forEach(a=>{if(a.dataset.view===view)a.classList.add('active');});

const reservoirs={
  detergente:{name:'Detergente',level:'72%',liters:'14,4 L',capacity:'20 L',forecast:'9 dias',status:'Normal',avg:'0,62 L/ciclo',daily:'2,1 L/dia',cost:'R$ 8,40/dia',color:'cyan',decision:'Estoque confortável. Acompanhe a tendência e programe a próxima reposição sem urgência.'},
  amaciante:{name:'Amaciante',level:'43%',liters:'8,6 L',capacity:'20 L',forecast:'5 dias',status:'Atenção',avg:'0,48 L/ciclo',daily:'1,72 L/dia',cost:'R$ 7,10/dia',color:'purple',decision:'O nível está abaixo do ideal. Planeje reposição antes do fim da previsão para evitar interrupção.'},
  alvejante:{name:'Alvejante',level:'88%',liters:'17,6 L',capacity:'20 L',forecast:'14 dias',status:'Normal',avg:'0,51 L/ciclo',daily:'1,25 L/dia',cost:'R$ 5,90/dia',color:'green',decision:'Nível alto e consumo estável. Não há necessidade de compra imediata.'},
  neutralizante:{name:'Neutralizante',level:'56%',liters:'11,2 L',capacity:'20 L',forecast:'7 dias',status:'Normal',avg:'0,37 L/ciclo',daily:'1,60 L/dia',cost:'R$ 6,30/dia',color:'orange',decision:'Estoque dentro da faixa operacional. Vale revisar a tendência nos próximos dias.'}
};

const machineReservoirs={
  M01:{detergente:{level:72,liters:'14,4 L',forecast:'9 dias'},amaciante:{level:43,liters:'8,6 L',forecast:'5 dias'},alvejante:{level:88,liters:'17,6 L',forecast:'14 dias'},neutralizante:{level:56,liters:'11,2 L',forecast:'7 dias'}},
  M02:{detergente:{level:64,liters:'12,8 L',forecast:'7 dias'},amaciante:{level:58,liters:'11,6 L',forecast:'8 dias'},alvejante:{level:76,liters:'15,2 L',forecast:'11 dias'},neutralizante:{level:49,liters:'9,8 L',forecast:'6 dias'}},
  M03:{detergente:{level:81,liters:'16,2 L',forecast:'11 dias'},amaciante:{level:67,liters:'13,4 L',forecast:'10 dias'},alvejante:{level:91,liters:'18,2 L',forecast:'16 dias'},neutralizante:{level:62,liters:'12,4 L',forecast:'9 dias'}},
  M04:{detergente:{level:53,liters:'10,6 L',forecast:'6 dias'},amaciante:{level:72,liters:'14,4 L',forecast:'12 dias'},alvejante:{level:69,liters:'13,8 L',forecast:'9 dias'},neutralizante:{level:44,liters:'8,8 L',forecast:'5 dias'}},
  M05:{detergente:{level:38,liters:'7,6 L',forecast:'4 dias'},amaciante:{level:29,liters:'5,8 L',forecast:'3 dias'},alvejante:{level:61,liters:'12,2 L',forecast:'8 dias'},neutralizante:{level:46,liters:'9,2 L',forecast:'6 dias'}}
};
function machineSelector(selectedId=machineId){return `<div class="machine-selector"><label>Máquina</label><select id="machineSelect">${Object.entries(machines).map(([key,m])=>`<option value="${key}" ${key===selectedId?'selected':''}>${key} — ${m.name}</option>`).join('')}</select></div>`}
function reservoirSelector(selectedId=id){const names={detergente:'Detergente',amaciante:'Amaciante',alvejante:'Alvejante',neutralizante:'Neutralizante'};return `<div class="machine-selector reservoir-selector"><label>Reservatório</label><select id="reservoirSelect">${Object.entries(names).map(([key,name])=>`<option value="${key}" ${key===selectedId?'selected':''}>${name}</option>`).join('')}</select></div>`}
function selectionRow(machineId,id){return `<div class="selection-row">${machineSelector(machineId)}${reservoirSelector(id)}</div>`}
function reservoirCardsForMachine(machineId){const data=machineReservoirs[machineId]||machineReservoirs.M01;const names={detergente:'Detergente',amaciante:'Amaciante',alvejante:'Alvejante',neutralizante:'Neutralizante'};return `<div class="machine-reservoir-grid">${Object.entries(data).map(([key,r])=>{const status=r.level<=30?'Crítico':r.level<=45?'Atenção':'Normal';return `<article class="machine-reservoir-card" data-reservoir="${key}"><div class="mr-head"><div><strong>${names[key]}</strong><small>Reservatório individual</small></div><b>${r.level}%</b></div><div class="mr-bar"><i style="width:${r.level}%"></i></div><div class="mr-foot"><span>${r.liters}</span><span class="mr-status ${status==='Crítico'?'danger':status==='Atenção'?'warning':''}">● ${status}</span></div><small>Autonomia: <b>${r.forecast}</b></small></article>`}).join('')}</div>`}

const machines={
  M01:{name:'Lavadora 01',type:'Lavadora',program:'Pesado',state:'Lavando',progress:68,remaining:'18 min',power:'6,8 kW',current:'18,4 A',energy:'42,6 kWh',cycles:'31',availability:'96%',decision:'Ciclo dentro do padrão. Nenhuma intervenção necessária.',tone:'good'},
  M02:{name:'Lavadora 02',type:'Lavadora',program:'Normal',state:'Enxaguando',progress:42,remaining:'12 min',power:'5,9 kW',current:'15,7 A',energy:'37,2 kWh',cycles:'28',availability:'94%',decision:'Operação normal. O consumo por ciclo está próximo da referência.',tone:'good'},
  M03:{name:'Lavadora 03',type:'Lavadora',program:'Rápido',state:'Centrifugando',progress:84,remaining:'4 min',power:'7,4 kW',current:'20,1 A',energy:'46,8 kWh',cycles:'35',availability:'98%',decision:'Alto aproveitamento da máquina hoje. Ciclos rápidos estão reduzindo o tempo médio.',tone:'good'},
  M04:{name:'Lavadora 04',type:'Lavadora',program:'—',state:'Disponível',progress:0,remaining:'—',power:'0 kW',current:'0 A',energy:'21,4 kWh',cycles:'17',availability:'100%',decision:'Máquina disponível e pronta para o próximo ciclo.',tone:'good'},
  M05:{name:'Secadora 01',type:'Secadora',program:'Preventiva',state:'Manutenção',progress:0,remaining:'Indisponível',power:'0 kW',current:'0 A',energy:'58,1 kWh',cycles:'26',availability:'81%',decision:'A máquina está indisponível. Verifique a manutenção preventiva antes de liberar para operação.',tone:'danger'}
};

function lineChart(points, stroke='#08aee8', fill='#10b9ef', labelsList=[]){
  const w=760,h=220,p=12; const max=Math.max(...points),min=Math.min(...points); const range=Math.max(1,max-min);
  const coords=points.map((v,i)=>{const x=p+(points.length===1?0:i*(w-p*2)/(points.length-1));const y=20+(max-v)/range*155;return [x,y]});
  const line=coords.map((c,i)=>(i?'L':'M')+c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  const area=line+' L '+(w-p)+','+(h-25)+' L '+p+','+(h-25)+' Z';
  const gid='g'+Math.random().toString(36).slice(2,9);
  const zones=coords.map((c,i)=>{const left=i?((coords[i-1][0]+c[0])/2):0;const right=i<coords.length-1?((c[0]+coords[i+1][0])/2):w;const lab=labelsList[i]||`Período ${i+1}`;return `<g class="detail-hover-zone" data-tip="<strong>${lab}</strong><br><span>${points[i]}</span><line class="hover-guide" x1="${c[0]}" x2="${c[0]}" y1="16" y2="190"/></g>`}).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Gráfico de tendência"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${fill}" stop-opacity=".18"/><stop offset="1" stop-color="${fill}" stop-opacity="0"/></linearGradient></defs><g stroke="#e8eef3" stroke-dasharray="4 5"><line x1="0" x2="760" y1="55" y2="55"/><line x1="0" x2="760" y1="100" y2="100"/><line x1="0" x2="760" y1="145" y2="145"/></g><path d="${area}" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="square" stroke-linejoin="round"/>${zones}</svg>`;
}
function barChart(values, cls='', labelsList=[]){const max=Math.max(...values,1);return `<div class="mini-bars">${values.map((v,i)=>{const lab=labelsList[i]||`Período ${i+1}`;const pct=Math.max(8,v/max*100);return `<button class="mini-bar ${cls}" data-tip="<strong>${lab}</strong><br><span>${v}</span>" style="--bar-height:${pct}%" aria-label="${lab}: ${v}"><i></i></button>`}).join('')}</div>`}
function labels(labels){return `<div class="mini-bar-labels">${labels.map(x=>`<span>${x}</span>`).join('')}</div>`}
function kpis(items){return `<section class="detail-kpis">${items.map(x=>`<article class="detail-kpi"><span class="label">${x.label}</span><strong>${x.value}</strong><small class="${x.good===false?'bad':''}">${x.note||''}</small></article>`).join('')}</section>`}
function panel(title,subtitle,body,wide=false,tag=''){return `<section class="detail-panel ${wide?'wide':''}"><div class="detail-panel-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${tag?`<span class="panel-tag ${tag.includes('Atenção')?'warning':''} ${tag.includes('Crítico')?'danger':''}">${tag}</span>`:''}</div>${body}</section>`}
function decision(text,action='Ver recomendação'){return `<div class="decision-banner"><div class="decision-icon">✦</div><div><strong>Decisão sugerida</strong><p>${text}</p></div><button class="decision-action" data-action="${action}">${action} →</button></div>`}
function metricRows(rows){return `<div class="metric-list">${rows.map(r=>`<div class="metric-row"><span>${r[0]}</span><strong class="${r[2]||''}">${r[1]}</strong></div>`).join('')}</div>`}
function table(headers,rows){return `<div class="table-wrap"><table class="decision-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function actionList(items){return `<div class="action-list">${items.map((x,i)=>`<div class="action-item"><span class="action-number">${i+1}</span><div><strong>${x[0]}</strong><p>${x[1]}</p></div><button data-action="${x[2]||'Abrir'}">Abrir</button></div>`).join('')}</div>`}

function renderReservatorios(){
  const rBase=reservoirs[id]||reservoirs.amaciante; const mr=(machineReservoirs[machineId]||machineReservoirs.M01)[id]||{}; const r={...rBase,...mr,level:((mr.level??parseInt(rBase.level))+'%'),liters:mr.liters||rBase.liters,forecast:mr.forecast||rBase.forecast}; const selectedMachine=machines[machineId]||machines.M01;
  $('#breadcrumbParent').textContent='Reservatórios';$('#breadcrumbCurrent').textContent=selectedMachine.name+' · '+r.name;$('#eyebrow').textContent='ANÁLISE DE ESTOQUE';$('#pageTitle').textContent=r.name;$('#pageSubtitle').textContent='Reservatório individual da máquina '+machineId+' — nível, consumo, autonomia e reposições.';
  $('#detailRoot').innerHTML=selectionRow(machineId,id)+decision(r.decision,r.status==='Atenção'?'Planejar reposição':'Ver histórico')+
  kpis([{label:'Nível atual',value:r.level,note:r.liters+' de '+r.capacity},{label:'Autonomia estimada',value:r.forecast,note:'mantendo o consumo atual',good:r.forecast!=='5 dias'},{label:'Consumo médio',value:r.avg,note:r.daily},{label:'Custo estimado',value:r.cost,note:'baseado no consumo diário'}])+`<div class="detail-grid">`+
  panel('Evolução do nível','Últimos 7 dias — leitura estimada do reservatório',`<div class="chart-box">${lineChart(r.name==='Amaciante'?[71,66,62,58,54,49,43]:r.name==='Alvejante'?[94,93,92,91,90,89,88]:r.name==='Detergente'?[88,84,81,78,76,74,72]:[67,64,61,59,58,57,56],r.color==='purple'?'#8b5cf6':r.color==='green'?'#20b979':'#08aee8',r.color==='purple'?'#8b5cf6':'#10b9ef',['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}${labels(['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}</div><div class="chart-legend"><span class="legend-item"><i class="legend-dot"></i>Nível do reservatório</span></div>`,false,r.status)+
  panel('Indicadores para compra','Use estes números para programar reposição',metricRows([['Ponto de reposição','30%'],['Nível atual',r.level],['Dias até 30%',r.forecast],['Consumo diário',r.daily],['Próxima compra sugerida',r.status==='Atenção'?'Agora':'Em 4–7 dias']]))+
  panel('Histórico de consumo','Litros consumidos por dia',`${barChart(r.name==='Amaciante'?[24,28,26,31,27,29,32] : r.name==='Detergente'?[31,29,30,34,28,30,32]:[18,19,17,20,16,18,19],r.color==='purple'?'purple':r.color==='green'?'green':'',['S','T','Q','Q','S','S','D'])} ${labels(['S','T','Q','Q','S','S','D'])}`)+
  panel('Reposições e eventos','Últimos registros relacionados ao reservatório',table(['Data','Evento','Volume','Impacto'],[['26/09','Reposição','10 L','Nível +50%'],['20/09','Consumo acima da média','—','-8%'],['13/09','Reposição','15 L','Nível +75%'],['06/09','Sensor calibrado','—','Leitura estável']]),true)+
  panel('Ações recomendadas','Próximos passos operacionais',actionList([[r.status==='Atenção'?'Programar compra':'Revisar previsão de compra',r.status==='Atenção'?'Evite que o estoque chegue ao nível crítico.':'Compare autonomia com o calendário de produção.','Planejar'],['Ver consumo por máquina','Identifique quais equipamentos mais impactam este produto.','Abrir consumo'],['Conferir sensor','Verifique a última leitura e a qualidade do sinal.','Diagnóstico']]),true);
}

function renderMaquinas(){
  const m=machines[id]||machines.M01;
  $('#breadcrumbParent').textContent='Máquinas';$('#breadcrumbCurrent').textContent=m.name;$('#eyebrow').textContent='MONITORAMENTO DA MÁQUINA';$('#pageTitle').textContent=m.name;$('#pageSubtitle').textContent='Desempenho elétrico, ciclos, disponibilidade e manutenção.';
  $('#detailRoot').innerHTML=machineSelector()+decision(m.decision,m.tone==='danger'?'Abrir manutenção':'Ver histórico de ciclos')+
  `<section class="detail-panel wide"><div class="machine-hero"><div class="machine-hero-image"><img src="${m.type==='Secadora'?'https://for-sale.used-secondhand.co.uk/media/used/secondhand/images/96132/2x-electrolux-professional-30kg-electric-tumble-dryer-tyne-and-wear/1200/electrolux-td6-30-electric-dryer-for-sale-921.jpeg':'https://condolav.com.br/wp-content/uploads/2024/02/3-4.webp'}" alt="${m.type} industrial padrão"></div><div><h2>${m.name}</h2><p>${m.type} · Programa atual: ${m.program}</p><div class="progress-large"><i style="width:${m.progress}%"></i></div><div class="machine-cycle-head"><span>${m.state}</span><b>${m.progress?m.progress+'%':'Sem ciclo ativo'}</b></div></div><span class="machine-state">● ${m.state}</span></div></section>`+
  kpis([{label:'Potência atual',value:m.power,note:'leitura em tempo real'},{label:'Corrente',value:m.current,note:'fase monitorada'},{label:'Energia hoje',value:m.energy,note:'acumulado do dia'},{label:'Disponibilidade',value:m.availability,note:m.tone==='danger'?'abaixo da meta':'dentro da meta',good:m.tone!=='danger'}])+`<div class="detail-grid">`+
  panel('Reservatórios desta máquina','Cada máquina possui seus próprios reservatórios de produto. Selecione um item para analisar nível, consumo e autonomia.',reservoirCardsForMachine(id),true)+
  panel('Consumo de energia','Últimos 7 dias',`${barChart([58,62,55,70,64,68,72],'',['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}${labels(['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}<div class="chart-legend"><span class="legend-item"><i class="legend-dot"></i>kWh por dia</span></div>`)+
  panel('Indicadores operacionais','Métricas que ajudam a detectar perda de eficiência',metricRows([['Ciclos realizados',m.cycles],['Tempo médio de ciclo','38 min'],['Disponibilidade',m.availability],['Energia/ciclo','1,37 kWh'],['Desvio vs. média','+2,8%','warning']]))+
  panel('Histórico de corrente','Perfil simplificado das últimas horas',`<div class="chart-box">${lineChart([14,15,15,16,18,17,19,18,20,19,18,20])}${labels(['08h','10h','12h','14h','16h','18h'])}</div>`)+
  panel('Ciclos recentes','Identifique duração fora do padrão',table(['Início','Programa','Duração','Energia','Resultado'],[['18:21','Pesado','41 min','6,2 kWh','Normal'],['17:34','Pesado','39 min','5,9 kWh','Normal'],['16:48','Normal','32 min','4,8 kWh','Normal'],['15:59','Rápido','24 min','3,7 kWh','Normal']]))+
  panel('Manutenção e ações','Histórico e próximos passos',actionList([[m.tone==='danger'?'Abrir ordem de manutenção':'Programar manutenção preventiva','Registre a intervenção e preserve o histórico do equipamento.','Manutenção'],['Comparar consumo','Compare esta máquina com as demais do mesmo tipo.','Comparar'],['Ver eventos','Analise paradas, ciclos interrompidos e mudanças de estado.','Eventos']]),true);
}

function renderConsumo(){
  $('#breadcrumbParent').textContent='Consumo';$('#breadcrumbCurrent').textContent='Análise de consumo';$('#eyebrow').textContent='INTELIGÊNCIA DE CONSUMO';$('#pageTitle').textContent='Consumo e eficiência';$('#pageSubtitle').textContent='Veja onde os litros estão sendo consumidos, compare períodos e encontre desvios.';
  $('#detailRoot').innerHTML=decision('O consumo total está 6,4% abaixo da média recente. O próximo passo é entender quais produtos e máquinas explicam essa variação.','Abrir análise')+
  kpis([{label:'Consumo hoje',value:'128 L',note:'↓ 6,4% vs. média',good:true},{label:'Consumo 7 dias',value:'842 L',note:'119 L/dia em média'},{label:'Consumo por ciclo',value:'0,46 L',note:'↓ 3,1% vs. período anterior',good:true},{label:'Custo estimado',value:'R$ 2.940',note:'últimos 30 dias'}])+`<div class="detail-grid">`+
  panel('Tendência de consumo','Litros consumidos por dia',`<div class="chart-box">${lineChart([102,117,111,134,126,124,128])}${labels(['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}</div><div class="chart-legend"><span class="legend-item"><i class="legend-dot"></i>Consumo total</span></div>`)+
  panel('Distribuição por produto','Participação no consumo do período',metricRows([['Detergente','42%'],['Amaciante','28%'],['Alvejante','17%'],['Neutralizante','13%']]))+
  panel('Consumo por máquina','Quais equipamentos mais impactam o total',table(['Máquina','Ciclos','Consumo','L/ciclo','Desvio'],[['M01','31','128 L','0,41','-4,2%'],['M02','28','116 L','0,41','-3,8%'],['M03','35','139 L','0,40','-5,1%'],['M04','17','62 L','0,36','-8,0%'],['M05','26','—','—','Manutenção']]),true)+
  panel('Detecção de desvios','Pontos que merecem investigação',actionList([['Investigar queda de 8% no M04','Compare quantidade de ciclos, programa e consumo por ciclo.','Investigar'],['Revisar amaciante','O produto está com menor autonomia e pode exigir reposição.','Abrir'],['Comparar com produção','Relacione consumo com volume de roupas processadas.','Comparar']]),true);
}

function renderAlertas(){
  $('#breadcrumbParent').textContent='Alertas';$('#breadcrumbCurrent').textContent='Central de alertas';$('#eyebrow').textContent='GESTÃO DE EXCEÇÕES';$('#pageTitle').textContent='Alertas e ocorrências';$('#pageSubtitle').textContent='Priorize o que pode afetar estoque, produção ou disponibilidade.';
  $('#detailRoot').innerHTML=decision('Existem 2 ocorrências abertas. Uma está ligada ao estoque de amaciante e outra à indisponibilidade da Secadora 01.','Priorizar alertas')+
  kpis([{label:'Alertas ativos',value:'02',note:'1 crítico · 1 atenção',good:false},{label:'Resolvidos hoje',value:'07',note:'+2 vs. ontem',good:true},{label:'Tempo médio',value:'26 min',note:'até resolução',good:true},{label:'Impacto estimado',value:'Baixo',note:'sem parada geral'}])+`<div class="detail-grid">`+
  panel('Fila de prioridade','Ordenada pelo impacto potencial',table(['Prioridade','Ocorrência','Impacto','Aberto há','Ação'],[['Crítico','Amaciante abaixo do ideal','Risco de ruptura','18 min','Planejar'],['Atenção','M05 em manutenção','1 máquina parada','32 min','Manutenção'],['Informativo','M04 disponível','Nenhum','1 h','—'],['Informativo','Leitura estabilizada','Nenhum','2 h','—']]))+
  panel('Evolução de ocorrências','Quantidade de alertas por dia',`<div class="chart-box">${lineChart([8,6,9,5,7,4,2],'#f0a019','#f0a019',['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}${labels(['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}</div>`)+
  panel('Amaciante abaixo do ideal','Reservatório em 43%',metricRows([['Nível atual','8,6 L'],['Autonomia','5 dias'],['Ponto de reposição','30%'],['Última leitura','18:42'],['Severidade','Atenção','warning']]))+
  panel('M05 em manutenção','Secadora 01 indisponível',metricRows([['Estado','Manutenção'],['Início','15:42'],['Disponibilidade hoje','81%'],['Última manutenção','12/09'],['Próxima revisão','03/10']]))+
  panel('Ações recomendadas','Reduza o risco de interrupção',actionList([['Planejar reposição de amaciante','Evite que o estoque alcance a faixa crítica.','Reservatório'],['Atualizar manutenção da M05','Registre diagnóstico, previsão de retorno e responsável.','Manutenção'],['Criar regra de alerta','Defina limiar e antecedência para compras futuras.','Configurar']]),true);
}

function renderRelatorios(){
  $('#breadcrumbParent').textContent='Relatórios';$('#breadcrumbCurrent').textContent='Indicadores gerenciais';$('#eyebrow').textContent='VISÃO GERENCIAL';$('#pageTitle').textContent='Relatórios e indicadores';$('#pageSubtitle').textContent='Transforme leituras em decisões sobre operação, estoque, energia e manutenção.';
  $('#detailRoot').innerHTML=decision('Os indicadores mostram uma operação estável, com oportunidade de reduzir consumo e antecipar reposições. Use os relatórios para acompanhar tendências antes que virem problemas.','Gerar relatório')+
  kpis([{label:'Eficiência operacional',value:'92%',note:'+3 p.p. vs. média',good:true},{label:'Ciclos hoje',value:'127',note:'+9% vs. média',good:true},{label:'Energia hoje',value:'318 kWh',note:'-4,1% vs. média',good:true},{label:'Custo estimado',value:'R$ 4.280',note:'últimos 30 dias'}])+`<div class="detail-grid">`+
  panel('Produção e ciclos','Evolução dos ciclos realizados',`<div class="chart-box">${lineChart([103,111,118,121,115,123,127],'#20b979','#20b979',['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}${labels(['Seg','Ter','Qua','Qui','Sex','Sáb','Hoje'])}</div>`)+
  panel('Indicadores de decisão','Resumo para gestão',metricRows([['Disponibilidade de máquinas','94%'],['Reservatórios abaixo de 50%','1','warning'],['Consumo vs. média','-6,4%','good'],['Alertas críticos','1','warning'],['Manutenções abertas','1','warning']]))+
  panel('Relatórios disponíveis','Escolha o recorte que deseja analisar',actionList([['Relatório de consumo','Produtos, máquinas, litros/ciclo e desvios.','Consumo'],['Relatório de manutenção','Disponibilidade, paradas e intervenções.','Manutenção'],['Relatório de energia','kWh, potência e custo estimado por máquina.','Energia'],['Relatório de estoque','Níveis, autonomia e histórico de reposição.','Estoque']]),true)+
  panel('Indicadores dos últimos 30 dias','Base consolidada para acompanhamento',table(['Indicador','Atual','Período anterior','Variação'],[['Consumo','3.620 L','3.860 L','-6,2%'],['Ciclos','3.480','3.210','+8,4%'],['Energia','9.420 kWh','9.870 kWh','-4,6%'],['Disponibilidade','94%','91%','+3 p.p.'],['Alertas críticos','4','7','-42,9%']]),true);
}

function render(){
  if(view==='reservatorios')renderReservatorios();
  else if(view==='maquinas')renderMaquinas();
  else if(view==='consumo')renderConsumo();
  else if(view==='alertas')renderAlertas();
  else if(view==='relatorios')renderRelatorios();
  else location.href='dashboard.html';
}
render();

document.querySelector('#machineSelect')?.addEventListener('change',e=>{if(view==='reservatorios'){location.href='details.html?view=reservatorios&id='+id+'&machine='+e.target.value;}else{location.href='details.html?view=maquinas&id='+e.target.value;}});
document.querySelector('#reservoirSelect')?.addEventListener('change',e=>{location.href='details.html?view=reservatorios&id='+e.target.value+'&machine='+machineId;});
document.querySelectorAll('[data-reservoir]').forEach(card=>card.addEventListener('click',()=>{location.href='details.html?view=reservatorios&id='+card.dataset.reservoir+'&machine='+id;}));

document.addEventListener('click',e=>{const action=e.target.closest('[data-action]');if(!action)return; const label=action.dataset.action; if(label==='Gerar relatório'){location.href='report.html?type=gerencial';return;} if(label==='Consumo'){location.href='report.html?type=consumo';return;} if(label==='Energia'){location.href='report.html?type=energia';return;} if(label==='Estoque'){location.href='report.html?type=estoque';return;} if(label==='Manutenção'){location.href='report.html?type=manutencao';return;} showToast(label+' selecionado — módulo demonstrativo.');});
