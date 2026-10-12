// Existing operational controller, now scoped to its SPA module.
export default function mount(document, location, window) {
const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);
const toast=$('#toast');let toastTimer;
function showToast(m){clearTimeout(toastTimer);toast.textContent=m;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
const sidebar=$('#sidebar');$('#menuBtn')?.addEventListener('click',()=>sidebar.classList.toggle('open'));
let products=[
 {name:'Detergente',brand:'Diversey',cost:18.90,min:30,capacity:20},
 {name:'Amaciante',brand:'Ecolab',cost:16.50,min:30,capacity:20},
 {name:'Alvejante',brand:'Diversey',cost:12.80,min:25,capacity:20},
 {name:'Neutralizante',brand:'Girando Sol',cost:14.20,min:30,capacity:20}
];
function markDirty(){ $('#saveState').textContent='Alterações não salvas';$('#saveState').classList.remove('saved') }
function renderProducts(){const body=$('#productsBody');body.innerHTML='';products.forEach((p,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><strong>${p.name}</strong></td><td><input data-i="${i}" data-k="brand" value="${p.brand}"></td><td><input data-i="${i}" data-k="cost" type="number" step="0.01" min="0" value="${p.cost.toFixed(2)}"></td><td><div class="input-suffix"><input data-i="${i}" data-k="min" type="number" min="1" max="99" value="${p.min}"><span>%</span></div></td><td><div class="input-suffix"><input data-i="${i}" data-k="capacity" type="number" min="1" value="${p.capacity}"><span>L</span></div></td><td><button class="remove-product" data-i="${i}" title="Remover">×</button></td>`;body.appendChild(tr)});$$('#productsBody input').forEach(inp=>inp.addEventListener('input',()=>{products[inp.dataset.i][inp.dataset.k]=inp.dataset.k==='brand'?inp.value:Number(inp.value);markDirty()}));$$('.remove-product').forEach(b=>b.addEventListener('click',()=>{products.splice(Number(b.dataset.i),1);renderProducts();markDirty()}));renderAssignments()}
function renderAssignments(){const grid=$('#assignmentGrid');if(!grid)return;const machines=['M01 — Lavadora 01','M02 — Lavadora 02','M03 — Lavadora 03','M04 — Lavadora 04','M05 — Lavadora 05','M06 — Lavadora 06'];grid.innerHTML=machines.map((m,i)=>`<div class="assignment"><div class="assignment-head"><strong>${m}</strong><span>${i<4?'Lavadora':'Secadora'}</span></div><select><option>Selecionar produto principal</option>${products.map(p=>`<option>${p.name} — ${p.brand}</option>`).join('')}</select></div>`).join('')}
$$('.settings-tab').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.tab;$$('.settings-tab').forEach(x=>x.classList.toggle('active',x===btn));$$('.settings-section').forEach(x=>x.classList.toggle('active',x.id==='tab-'+tab));if(tab==='produtos')renderProducts()}));
function updateTotal(){const w=Math.max(0,Number($('#washers').value)||0),d=Math.max(0,Number($('#dryers').value)||0);$('#totalEquip').textContent=w+d;markDirty()}
$('#washers')?.addEventListener('input',updateTotal);$('#dryers')?.addEventListener('input',updateTotal);
$('#addProduct')?.addEventListener('click',()=>{$('#productModal').classList.add('show');$('#productModal').setAttribute('aria-hidden','false');$('#newName').focus()});
function closeModal(){$('#productModal').classList.remove('show');$('#productModal').setAttribute('aria-hidden','true')}
$('#closeModal')?.addEventListener('click',closeModal);$('#cancelModal')?.addEventListener('click',closeModal);
$('#confirmProduct')?.addEventListener('click',()=>{const name=$('#newName').value.trim(),brand=$('#newBrand').value.trim(),cost=Number($('#newCost').value),min=Number($('#newMin').value),capacity=Number($('#newCapacity').value);if(!name||!brand||!Number.isFinite(cost)||cost<0||min<1||min>99||capacity<=0){showToast('Preencha os dados do produto corretamente.');return}products.push({name,brand,cost,min,capacity});renderProducts();closeModal();['newName','newBrand','newCost'].forEach(id=>$('#'+id).value='');markDirty();showToast('Produto adicionado.');});
$('#cancelBtn')?.addEventListener('click',()=>{location.reload()});
function save(){updateTotal();$('#saveState').textContent='Rascunho aplicado';$('#saveState').classList.add('saved');showToast('Rascunho mantido nesta sessão. Configuração demonstrativa.');}
$('#saveBtn')?.addEventListener('click',save);$('#saveTop')?.addEventListener('click',save);
renderProducts();


(function openHashTab(){
  const hash=(location.hash||'').replace('#','');
  if(!hash) return;
  const tab=document.querySelector(`.settings-tab[data-tab="${hash}"]`);
  if(tab) tab.click();
})();

}
