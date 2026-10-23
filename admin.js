const sb=supabase.createClient(CFG.url,CFG.key);
const $=s=>document.querySelector(s),app=$("#app");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let D={drugs:[],procs:[]},ver=1,REQ=true;
const msg=t=>{$("#st").textContent=t};
const save=()=>msg("Alterações não publicadas");
const render=()=>adminList();
function loginView(){app.innerHTML=`<div class="card"><h3>Entrar</h3><label>E-mail</label><input id="em" type="email" autocomplete="username"><label>Senha</label><input id="pw" type="password" autocomplete="current-password"><p id="er" class="mute"></p><button class="btn" id="go">Entrar</button></div>`;
$("#go").onclick=async()=>{const{error}=await sb.auth.signInWithPassword({email:$("#em").value.trim(),password:$("#pw").value});if(error){$("#er").textContent="E-mail ou senha incorretos.";return}gate()}}
async function gate(){const{data:a}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(a.currentLevel=="aal2")return load();
const{data:f}=await sb.auth.mfa.listFactors();const t=(f.totp||[]).find(x=>x.status=="verified");t?codeView(t.id):enroll()}
function codeView(id){app.innerHTML=`<div class="card"><h3>Verificação em duas etapas</h3><label>Código do app autenticador</label><input id="cd" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><button class="btn" id="ok" style="margin-top:10px">Confirmar</button></div>`;$("#ok").onclick=()=>verify(id)}
async function enroll(){const{data,error}=await sb.auth.mfa.enroll({factorType:"totp"});if(error){alert("Não foi possível ativar a verificação: "+error.message);return}
app.innerHTML=`<div class="card"><h3>Ativar verificação em duas etapas</h3><p>Escaneie o QR code no app autenticador e digite o código.</p><img src="${data.totp.qr_code}" width="180" height="180" alt="QR code"><p class="mute">${esc(data.totp.secret)}</p><input id="cd" inputmode="numeric" maxlength="6"><button class="btn" id="ok" style="margin-top:10px">Confirmar</button></div>`;$("#ok").onclick=()=>verify(data.id)}
async function verify(id){const{data:c,error:e1}=await sb.auth.mfa.challenge({factorId:id});if(e1){alert("Erro ao validar: "+e1.message);return}
const{error}=await sb.auth.mfa.verify({factorId:id,challengeId:c.id,code:$("#cd").value.trim()});if(error){alert("Código incorreto.");return}load()}
async function load(){const{data,error}=await sb.from("content").select("data,version").eq("id",1).single();
if(error){app.innerHTML='<div class="card">Não foi possível carregar os dados.</div>';return}
D=data.data||{};D.drugs=D.drugs||[];D.procs=D.procs||[];ver=data.version;const{data:cf}=await sb.from("app_config").select("value").eq("key","require_approval").single();REQ=!cf||cf.value;msg("Versão "+ver+" · aprovação dupla "+(REQ?"ligada":"desligada"));
{const s=await(await fetch("data/drugs.json")).json();let n=0;s.drugs.forEach(x=>{if(!D.drugs.some(d=>d.n==x.n&&d.pop==x.pop)){D.drugs.push(x);n++}});if(n){save();msg(n+" medicamentos novos do arquivo: revise e envie")}}
adminList()}
async function submit(){if(D.drugs.some(d=>!d.n||!(d.c>=0))){alert("Há medicamento sem nome ou com concentração inválida.");return}
const note=prompt("Descreva a alteração (obrigatório):");if(!note)return;
const{data,error}=await sb.rpc("submit_change",{p_data:D,p_note:note,p_base:ver});
if(error){alert("Não foi possível enviar: "+error.message);return}
if(data=="published"){ver++;msg("Publicado. Versão "+ver)}else msg("Enviado para aprovação de outro administrador")}
function diff(a,b){const k=d=>d.pop+"|"+d.n,A=Object.fromEntries((a.drugs||[]).map(d=>[k(d),d])),B=Object.fromEntries((b.drugs||[]).map(d=>[k(d),d])),o=[];
for(const x in B){if(!A[x])o.push("Novo: "+B[x].n+" ("+(B[x].pop=="a"?"adulto":"pediátrico")+")");else if(JSON.stringify(A[x])!=JSON.stringify(B[x])){const c=Object.keys(B[x]).filter(f=>JSON.stringify(A[x][f])!=JSON.stringify(B[x][f])).map(f=>f+": "+JSON.stringify(A[x][f])+" → "+JSON.stringify(B[x][f]));o.push("Alterado: "+B[x].n+" ("+(B[x].pop=="a"?"adulto":"pediátrico")+") "+c.join("; "))}}
for(const x in A)if(!B[x])o.push("Removido: "+A[x].n+" ("+(A[x].pop=="a"?"adulto":"pediátrico")+")");
if(JSON.stringify(a.procs)!=JSON.stringify(b.procs))o.push("Procedimentos alterados");return o}
async function reviews(){const[{data:c},{data:P}]=await Promise.all([sb.from("content").select("data,version").eq("id",1).single(),sb.from("proposals").select("*").eq("status","pending").order("id")]);
const me=(await sb.auth.getUser()).data.user.id,L=P||[];
app.innerHTML=`<button class="btn sec" id="bk">← Voltar</button><h2>Aprovações pendentes</h2>`+(L.length?L.map(p=>`<div class="card"><b>${esc(p.note)}</b><br><span class="mute">${new Date(p.created_at).toLocaleString("pt-BR")} · ${p.proposed_by==me?"enviada por você":"outro administrador"} · base v${p.base_version}</span><ul>${diff(c.data,p.data).map(x=>`<li>${esc(x)}</li>`).join("")||"<li>Sem diferenças</li>"}</ul><div class="row"><button class="btn" data-ok="${p.id}">Aprovar</button><button class="btn sec" data-no="${p.id}">Recusar</button></div></div>`).join(""):'<p class="mute">Nenhuma proposta pendente.</p>');
$("#bk").onclick=adminList;
const act=async(id,ok)=>{const{error}=await sb.rpc("review_change",{p_id:id,p_ok:ok});if(error){alert(error.message);return}ok?load():reviews()};
document.querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>confirm("Aprovar e publicar esta alteração? Edições locais não enviadas serão descartadas.")&&act(+b.dataset.ok,true));
document.querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>act(+b.dataset.no,false))}
async function users(){const{data}=await sb.from("user_profiles").select("email,plan,premium_until").order("created_at",{ascending:false}).limit(200);const L=data||[];
app.innerHTML=`<button class="btn sec" id="bk">← Voltar</button><h2>Usuários (${L.length})</h2><input id="qs" placeholder="Filtrar por e-mail"><div id="ul"></div>`;
const draw=()=>{const q=$("#qs").value.toLowerCase();$("#ul").innerHTML=L.filter(u=>(u.email||"").toLowerCase().includes(q)).map(u=>`<div class="card"><b>${esc(u.email)}</b><br><span class="mute">${u.premium_until&&new Date(u.premium_until)>new Date()?"Premium até "+new Date(u.premium_until).toLocaleDateString("pt-BR"):"Gratuito"}</span><div class="row" style="margin-top:6px"><button class="chip" data-d="30" data-e="${esc(u.email)}">+30 dias</button><button class="chip" data-d="365" data-e="${esc(u.email)}">+1 ano</button><button class="chip" data-d="0" data-e="${esc(u.email)}">Revogar</button></div></div>`).join("");
document.querySelectorAll("#ul [data-e]").forEach(b=>b.onclick=async()=>{const{error}=await sb.rpc("admin_set_premium",{p_email:b.dataset.e,p_days:+b.dataset.d});if(error){alert(error.message);return}users()})};
$("#bk").onclick=adminList;$("#qs").oninput=draw;draw()}
async function history(){const{data}=await sb.from("content_history").select("version,note,changed_at,data").order("id",{ascending:false}).limit(20);const L=data||[];
app.innerHTML=`<button class="btn sec" id="bk">← Voltar</button><h2>Histórico</h2>`+L.map((h,i)=>`<div class="card row"><div style="flex:3"><b>Versão ${h.version}</b><br><span class="mute">${new Date(h.changed_at).toLocaleString("pt-BR")} · ${esc(h.note)}</span></div><button class="chip" data-h="${i}">Restaurar</button></div>`).join("");
$("#bk").onclick=adminList;document.querySelectorAll("[data-h]").forEach(b=>b.onclick=()=>{if(confirm("Restaurar esta versão? Depois é preciso publicar.")){D=L[+b.dataset.h].data;save();adminList()}})}
function adminList(){app.innerHTML=`<div class="row"><button class="btn" id="nd">+ Medicamento</button><button class="btn" id="np">+ Procedimento</button></div>
<div class="row" style="margin-top:8px"><button class="btn" id="pub">Enviar alterações</button><button class="btn sec" id="rev">Aprovações</button><button class="btn sec" id="hist">Histórico</button><button class="btn sec" id="usr">Usuários</button><button class="btn sec" id="lo">Sair</button></div>
<h2>Medicamentos (${D.drugs.length})</h2>${D.drugs.map((d,i)=>`<div class="card row"><div style="flex:3"><b>${esc(d.n)}</b> <span class="tag">${d.pop=="a"?"Adulto":"Pediátrico"}</span></div><button class="chip" data-e="${i}">Editar</button><button class="chip" data-x="${i}">Excluir</button></div>`).join("")}
<h2>Procedimentos</h2>${D.procs.map((p,i)=>`<div class="card row"><div style="flex:3"><b>${esc(p.t)} · ${esc(p.s)}</b></div><button class="chip" data-pe="${i}">Editar</button><button class="chip" data-px="${i}">Excluir</button></div>`).join("")}`;
const q=s=>document.querySelectorAll(s);
$("#nd").onclick=()=>fd(-1);$("#np").onclick=()=>fp(-1);$("#lo").onclick=()=>sb.auth.signOut().then(()=>location.reload());
$("#pub").onclick=submit;$("#rev").onclick=reviews;$("#hist").onclick=history;$("#usr").onclick=users;

q("[data-e]").forEach(b=>b.onclick=()=>fd(+b.dataset.e));q("[data-pe]").forEach(b=>b.onclick=()=>fp(+b.dataset.pe));
q("[data-x]").forEach(b=>b.onclick=()=>{if(confirm("Excluir este medicamento?")){D.drugs.splice(+b.dataset.x,1);save();render()}});
q("[data-px]").forEach(b=>b.onclick=()=>{if(confirm("Excluir este procedimento?")){D.procs.splice(+b.dataset.px,1);save();render()}})}

function fd(i){const d=i<0?{n:"",g:"",pop:"p",r:"IV",u:"mg",c:1,k:[0,0],mx:0,dil:"",o:""}:D.drugs[i];const bk=!!d.k;
app.innerHTML=`<div class="card"><h3>${i<0?"Novo":"Editar"} medicamento</h3>
<label>Nome</label><input id="n" value="${esc(d.n)}"><label>Grupo</label><input id="g" value="${esc(d.g)}">
<label>Lista</label><select id="pop"><option value="p" ${d.pop=="p"?"selected":""}>Pediátrico</option><option value="a" ${d.pop=="a"?"selected":""}>Adulto</option></select>
<label>Tipo de dose</label><select id="t"><option value="k" ${bk?"selected":""}>Por peso (por kg)</option><option value="f" ${bk?"":"selected"}>Dose fixa</option></select>
<div class="row"><div><label>Dose mínima</label><input id="lo" type="number" step="any" value="${(d.k||d.f)[0]}"></div><div><label>Dose máxima (faixa)</label><input id="hi" type="number" step="any" value="${(d.k||d.f)[1]}"></div></div>
<div class="row"><div><label>Unidade</label><input id="u" value="${esc(d.u)}"></div><div><label>Concentração (unidade/mL; 0 = sem volume)</label><input id="c" type="number" step="any" value="${d.c}"></div><div><label>Teto por dose (0 = sem)</label><input id="mx" type="number" step="any" value="${d.mx||0}"></div></div>
<label>Via</label><input id="r" value="${esc(d.r)}"><label>Diluição</label><textarea id="dil" rows="2">${esc(d.dil)}</textarea><label>Observações</label><textarea id="o" rows="2">${esc(d.o)}</textarea>
<div class="row" style="margin-top:12px"><button class="btn" id="sv">Salvar</button><button class="btn sec" id="cx">Cancelar</button></div></div>`;
$("#cx").onclick=render;$("#sv").onclick=()=>{const v=id=>$("#"+id).value,r=[+v("lo"),+v("hi")];if(!v("n")||!(+v("c")>=0)){alert("Informe nome e concentração (0 = sem volume).");return}
const n={n:v("n"),g:v("g"),pop:v("pop"),r:v("r"),u:v("u"),c:+v("c"),dil:v("dil"),o:v("o")};if(v("t")=="k"){n.k=r;n.mx=+v("mx")}else n.f=r;
if(i<0)D.drugs.push(n);else D.drugs[i]=n;save();render()}}
function fp(i){const p=i<0?{t:"RCP",s:"Adulto",st:[]}:D.procs[i];
app.innerHTML=`<div class="card"><h3>${i<0?"Novo":"Editar"} procedimento</h3><label>Categoria (ex.: RCP, IOT)</label><input id="t" value="${esc(p.t)}"><label>Subcategoria (ex.: Neonatal)</label><input id="s" value="${esc(p.s)}"><label>Passos (um por linha)</label><textarea id="st" rows="10">${esc(p.st.join("\n"))}</textarea>
<div class="row" style="margin-top:12px"><button class="btn" id="sv">Salvar</button><button class="btn sec" id="cx">Cancelar</button></div></div>`;
$("#cx").onclick=render;$("#sv").onclick=()=>{const n={t:$("#t").value.trim(),s:$("#s").value.trim(),st:$("#st").value.split("\n").map(x=>x.trim()).filter(Boolean)};if(!n.t||!n.s||!n.st.length){alert("Preencha categoria, subcategoria e ao menos um passo.");return}
if(i<0)D.procs.push(n);else D.procs[i]=n;save();render()}}

let _t;const idle=()=>{clearTimeout(_t);_t=setTimeout(()=>sb.auth.signOut().then(()=>location.reload()),9e5)};["click","keydown","touchstart"].forEach(e=>addEventListener(e,idle));idle();
sb.auth.getSession().then(({data})=>data.session?gate():loginView());
