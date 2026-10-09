/* ===== ABA FRETE - Painel CD84 (v2) =====
   No painel.html: <script src="frete.js"></script> antes de </body>
   Coleções Firestore: tabela_frete (id codigo_tipo) e veiculos_frete (id = placa sem hífen). */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const BRL = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDH = ts => ts ? new Date(ts).toLocaleDateString('pt-BR') + ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
const num = v => { if (typeof v === 'number') return v; return parseFloat(String(v == null ? '' : v).trim().replace(/\./g, '').replace(',', '.')); };
const normP = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const logado = () => { if (typeof usuarioLogado === 'undefined' || !usuarioLogado) { alert('Acesso negado! Faça o login de administrador primeiro.'); return false; } return true; };
const CAMPOS = { placa: 'Placa', motorista: 'Motorista', filial: 'Filial', conferente: 'Conferente' };

let tabela = [], mapa = {}, veic = [], mveic = {}, cargas = [], cargasAnt = [];
let per = 'hoje', dIni = null, dFim = null, modo = 'placa', iniciado = false, erroTabela = '', erroVeic = '';
let campoF = 'placa', txtF = '', selF = new Set(), abertos = new Set();

/* ---------- CSS ---------- */
const st = document.createElement('style');
st.textContent = `
.fr-sub.hidden{display:none!important}
.fr-sel{padding:7px 12px;border:1px solid var(--border);border-radius:20px;background:#fff;font-weight:600;color:var(--text-main)}
.fr-bar{height:10px;border-radius:5px;background:linear-gradient(90deg,#168cff,#0f52ba);min-width:2px}
.fr-bar-bg{background:#eaf1fb;border-radius:5px;width:100%;min-width:90px}
.fr-warn{color:#9b5d00;background:#fff0b8;padding:3px 8px;border-radius:12px;font-size:.75rem;font-weight:700}
.fr-ok{color:#1d9d60;font-weight:700}
.fr-comp{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.fr-comp-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.fr-scroll{overflow-x:auto}
.fr-lista{max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 10px;background:#fbfdff}
.fr-lista label{display:flex;gap:7px;align-items:center;padding:4px 6px;border-radius:6px;font-size:.85rem;cursor:pointer}
.fr-lista label:hover{background:#eef5ff}
.fr-chip{display:inline-flex;align-items:center;gap:6px;background:#dbe9ff;color:#0f52ba;border-radius:16px;padding:4px 10px;font-size:.8rem;font-weight:700;margin:0 6px 8px 0;cursor:pointer}
.fr-rk{cursor:pointer}.fr-rk:hover{background:#f3f8ff}
.fr-det-row>td{background:#f8fbff;padding:10px 14px}
.fr-det-row table{min-width:0!important;font-size:.85rem}
.fr-dt{padding:7px 12px;border:1px solid var(--border);border-radius:20px;font-weight:600;background:#fff}
`;
document.head.appendChild(st);

/* ---------- Estrutura ---------- */
const btn = document.createElement('button');
btn.type = 'button'; btn.className = 'tab-btn'; btn.id = 'btn-tab-frete'; btn.textContent = 'Frete';
btn.onclick = () => mudarAbaPainel('frete');
document.querySelector('.tabs').appendChild(btn);

const sec = document.createElement('div');
sec.id = 'tab-frete'; sec.className = 'tab-conteudo';
sec.innerHTML = `
<div class="tabs" style="margin-bottom:15px">
  <button type="button" class="tab-btn active" data-sub="resumo">Resumo</button>
  <button type="button" class="tab-btn" data-sub="detalhe">Carregamentos</button>
  <button type="button" class="tab-btn" data-sub="veiculos">Veículos Agregados</button>
  <button type="button" class="tab-btn" data-sub="tabela">Tabela de Frete</button>
</div>
<section class="card" id="fr-periodo-card">
  <div class="periodo-seletor">
    <button type="button" class="periodo-btn active" data-per="hoje">Hoje</button>
    <button type="button" class="periodo-btn" data-per="7dias">7 dias</button>
    <button type="button" class="periodo-btn" data-per="30dias">30 dias</button>
    <span style="margin-left:10px;font-size:.8rem;font-weight:700;color:#6f8095">Período:</span>
    <input type="date" id="fr-ini" class="fr-dt" title="Data inicial">
    <span>até</span>
    <input type="date" id="fr-fim" class="fr-dt" title="Data final">
    <button type="button" class="btn-action btn-call" style="margin:0" data-act="aplicar">Aplicar</button>
  </div>
</section>

<div id="fr-resumo" class="fr-sub">
  <section class="card">
    <div class="card-header-flex"><h2>Filtro</h2><button type="button" class="btn-action btn-cancel" style="margin:0" data-act="limparFiltro">Limpar filtro</button></div>
    <div class="fr-comp">
      <select id="fr-campo" class="fr-sel"><option value="placa">Placa</option><option value="motorista">Motorista</option><option value="filial">Filial (loja)</option><option value="conferente">Conferente</option></select>
      <input type="text" id="fr-txt" class="input-busca" placeholder="Pesquisar placa, motorista, filial ou conferente...">
    </div>
    <div id="fr-chips"></div>
    <div style="font-size:.78rem;color:#6f8095;margin-bottom:6px">Marque um ou mais itens da lista abaixo; os números do resumo passam a considerar só a seleção.</div>
    <div id="fr-lista" class="fr-lista"></div>
  </section>
  <section class="card">
    <h2>Resumo de Frete <small id="fr-filtro-info" style="font-size:.75rem;color:var(--travel)"></small></h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-numero" id="fr-total" style="font-size:1.7rem">-</div><div class="stat-label">Frete Total</div><div class="stat-comparativo" id="fr-comp-total"></div></div>
      <div class="stat-card"><div class="stat-numero" id="fr-qtd">-</div><div class="stat-label">Carregamentos</div></div>
      <div class="stat-card"><div class="stat-numero" id="fr-ticket" style="font-size:1.7rem">-</div><div class="stat-label">Frete Médio por Carregamento</div></div>
      <div class="stat-card"><div class="stat-numero" id="fr-maior" style="font-size:1.7rem">-</div><div class="stat-label">Maior Frete</div></div>
      <div class="stat-card"><div class="stat-numero" id="fr-pend">-</div><div class="stat-label">Sem valor (pendentes)</div></div>
    </div>
    <h3 style="color:var(--primary);font-size:1rem;margin:10px 0">Frete por Dia</h3>
    <div class="bar-chart" id="fr-grafico"></div>
  </section>
  <section class="card">
    <div class="card-header-flex">
      <h2>Ranking de Faturamento</h2>
      <select id="fr-modo" class="fr-sel">
        <option value="placa">Por veículo (placa)</option>
        <option value="motorista">Por motorista</option>
        <option value="tipo">Por tipo de caminhão</option>
        <option value="base">Por filial (base do frete)</option>
      </select>
    </div>
    <p style="font-size:.8rem;color:#6f8095;margin-top:0">Clique em uma linha para ver as lojas e o frete de cada carregamento.</p>
    <div class="fr-scroll"><table><thead><tr><th>Pos.</th><th>Nome</th><th>Carregamentos</th><th>Frete Total</th><th>Médio</th><th>% do total</th></tr></thead><tbody id="fr-rank"></tbody></table></div>
    <div id="fr-rank-vazio" class="empty-msg hidden">Nenhum carregamento no período.</div>
  </section>
  <section class="card">
    <h2>Comparar Veículos</h2>
    <div class="fr-comp"><select id="fr-cmp-a" class="fr-sel"></select><b>×</b><select id="fr-cmp-b" class="fr-sel"></select></div>
    <div class="fr-comp-res" id="fr-cmp-res"></div>
  </section>
</div>

<div id="fr-detalhe" class="fr-sub hidden">
  <section class="card">
    <div class="card-header-flex">
      <h2>Carregamentos e Frete Calculado</h2>
      <label style="font-size:.85rem;font-weight:600"><input type="checkbox" id="fr-so-pend"> Só pendentes</label>
    </div>
    <p style="font-size:.8rem;color:#6f8095;margin-top:0">O tipo vem do cadastro em "Veículos Agregados". Ao escolher o tipo de uma placa aqui, ela é cadastrada e vale para todos os carregamentos dela.</p>
    <div class="fr-scroll"><table><thead><tr><th>Placa</th><th>Motorista</th><th>Filial (digitada)</th><th>Tipo do caminhão</th><th>Base do frete</th><th>Frete</th><th>Saída</th><th>Ações</th></tr></thead><tbody id="fr-det"></tbody></table></div>
    <div id="fr-det-vazio" class="empty-msg hidden">Nenhum carregamento no período.</div>
  </section>
</div>

<div id="fr-veiculos" class="fr-sub hidden">
  <div id="fr-v-sem"></div>
  <section class="card">
    <div class="card-header-flex">
      <h2>Veículos Agregados (<span id="fr-v-qtd">0</span>)</h2>
      <button type="button" class="btn-action btn-add" style="margin:0" data-act="vIncluir">+ Incluir veículo</button>
    </div>
    <div class="fr-comp"><input type="text" id="fr-v-busca" class="input-busca" placeholder="Buscar placa, proprietário ou observação..."></div>
    <div id="fr-v-erro" class="empty-msg hidden" style="color:var(--danger)"></div>
    <div class="fr-scroll"><table><thead><tr><th>Placa</th><th>Porte / Tipo</th><th>Proprietário / Motorista</th><th>Observação</th><th>Ações</th></tr></thead><tbody id="fr-v-corpo"></tbody></table></div>
    <div id="fr-v-vazio" class="empty-msg hidden">Nenhum veículo cadastrado.</div>
  </section>
</div>

<div id="fr-tabela" class="fr-sub hidden">
  <section class="card">
    <div class="card-header-flex">
      <h2>Tabela de Frete (<span id="fr-tab-qtd">0</span>)</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn-action btn-add" style="margin:0" data-act="incluir">+ Incluir filial / frete</button>
        <button type="button" class="btn-action btn-export" style="margin:0" data-act="importar">⬆ Importar planilha</button>
      </div>
    </div>
    <div class="fr-comp">
      <input type="text" id="fr-busca" class="input-busca" placeholder="Buscar por código ou nome da loja...">
      <select id="fr-filtro-tipo" class="fr-sel"><option value="">Todos os tipos</option></select>
    </div>
    <div id="fr-tab-erro" class="empty-msg hidden" style="color:var(--danger)"></div>
    <div class="fr-scroll"><table><thead><tr><th>Cód.</th><th>Loja / Filial</th><th>Tipo de caminhão</th><th>Frete</th><th>Km</th><th>Ações</th></tr></thead><tbody id="fr-tab-corpo"></tbody></table></div>
    <div id="fr-tab-vazio" class="empty-msg hidden">Nenhum frete cadastrado. Use "Importar planilha" ou "Incluir".</div>
  </section>
</div>`;
$('tab-financeiro').after(sec);

/* ---------- Navegação ---------- */
const origMudar = window.mudarAbaPainel;
window.mudarAbaPainel = function (n) {
  origMudar(n);
  const f = n === 'frete';
  sec.classList.toggle('ativo', f);
  btn.classList.toggle('active', f);
  if (f) abrir();
};
function mudarSub(s) {
  sec.querySelectorAll('[data-sub]').forEach(b => b.classList.toggle('active', b.dataset.sub === s));
  ['resumo', 'detalhe', 'veiculos', 'tabela'].forEach(x => $('fr-' + x).classList.toggle('hidden', x !== s));
  $('fr-periodo-card').classList.toggle('hidden', s === 'tabela');
}

/* ---------- Cálculo ---------- */
function codigos(f) {
  if (!f) return [];
  const s = String(f).trim();
  const partes = /^\d+(\s+\d+)+$/.test(s) ? s.split(/\s+/) : s.split(/[\/,;+&|\n]|\s+e\s+/i);
  const out = [];
  partes.forEach(p => { const m = p.trim().match(/^(\d+)/); if (m && !out.includes(m[1])) out.push(m[1]); });
  return out;
}
function tiposLista() {
  const m = {};
  tabela.forEach(r => { m[r.tipoCod] = r.tipoNome; });
  return Object.keys(m).sort((a, b) => a - b).map(k => ({ cod: k, nome: m[k] }));
}
const nomeTipo = cod => { const t = tiposLista().find(x => x.cod === cod); return t ? cod + ' - ' + t.nome : (cod || '-'); };
const tipoDe = c => (mveic[normP(c.placa)] || {}).tipoCod || c.tipoVeiculo || '';
function calcular(c) {
  const cods = codigos(c.filial), tipo = tipoDe(c);
  const lojas = cods.map(k => { const r = tipo ? mapa[k + '_' + tipo] : null; return { cod: k, nome: r ? r.nome : (tabela.find(x => x.codigo === k) || {}).nome || null, valor: r ? r.valor : null }; });
  const base = { cods, tipo, lojas };
  if (!cods.length) return { ...base, valor: 0, motivo: 'Filial sem código' };
  if (!tipo) return { ...base, valor: 0, motivo: 'Cadastrar tipo do veículo' };
  let best = null;
  lojas.forEach(l => { if (l.valor != null && (!best || l.valor > best.valor)) best = l; });
  if (!best) return { ...base, valor: 0, motivo: 'Frete não cadastrado' };
  return { ...base, valor: best.valor, base: best.cod, baseNome: best.nome };
}
const recalcular = () => { cargas.forEach(c => c.calc = calcular(c)); cargasAnt.forEach(c => c.calc = calcular(c)); };

/* ---------- Filtro ---------- */
function valoresCampo(c, campo) {
  if (campo === 'filial') return c.calc.cods || [];
  const v = c[campo]; return v && v !== '-' ? [v] : [];
}
function passa(c) {
  const por = {};
  selF.forEach(k => { const i = k.indexOf('|'); (por[k.slice(0, i)] = por[k.slice(0, i)] || []).push(k.slice(i + 1)); });
  for (const campo in por) if (!valoresCampo(c, campo).some(x => por[campo].includes(String(x)))) return false;
  if (txtF) { const t = ((c.placa || '') + ' ' + (c.motorista || '') + ' ' + (c.filial || '') + ' ' + (c.conferente || '')).toLowerCase(); if (!t.includes(txtF)) return false; }
  return true;
}
const filtroAtivo = () => selF.size > 0 || !!txtF;

function renderFiltro() {
  $('fr-chips').innerHTML = [...selF].map(k => { const i = k.indexOf('|'); return `<span class="fr-chip" data-chip="${esc(k)}">${CAMPOS[k.slice(0, i)]}: ${esc(k.slice(i + 1))} ✕</span>`; }).join('');
  const cont = {};
  cargas.forEach(c => valoresCampo(c, campoF).forEach(v => { cont[v] = (cont[v] || 0) + 1; }));
  let itens = Object.keys(cont).sort((a, b) => campoF === 'filial' ? a - b : a.localeCompare(b));
  if (txtF) itens = itens.filter(v => (v + ' ' + (campoF === 'filial' ? (tabela.find(x => x.codigo === v) || {}).nome || '' : '')).toLowerCase().includes(txtF));
  const el = $('fr-lista'), top = el.scrollTop;
  el.innerHTML = itens.length ? itens.map(v => {
    const nome = campoF === 'filial' ? ((tabela.find(x => x.codigo === v) || {}).nome || v).replace(/MATEUS SUPERMERCADOS S\.A\.\s*/i, '') : v;
    return `<label><input type="checkbox" data-fk="${esc(campoF + '|' + v)}" ${selF.has(campoF + '|' + v) ? 'checked' : ''}> ${esc(nome)} <small style="color:#7f8c8d">(${cont[v]})</small></label>`;
  }).join('') : '<div class="empty-msg" style="grid-column:1/-1">Nada encontrado neste período.</div>';
  el.scrollTop = top;
}

/* ---------- Dados ---------- */
function intervalo() {
  const ag = new Date();
  if (per === 'intervalo' && dIni) {
    const [a, m, d] = dIni.split('-').map(Number), [a2, m2, d2] = (dFim || dIni).split('-').map(Number);
    return { inicio: new Date(a, m - 1, d, 0, 0, 0, 0).getTime(), fim: new Date(a2, m2 - 1, d2, 23, 59, 59, 999).getTime() };
  }
  if (per === 'hoje') return { inicio: new Date(ag.getFullYear(), ag.getMonth(), ag.getDate()).getTime(), fim: ag.getTime() };
  return { inicio: ag.getTime() - (per === '7dias' ? 7 : 30) * 86400000, fim: ag.getTime() };
}
function buscar(i, f) {
  return db.collection('fila_patio').where('timestampSaida', '>=', i).where('timestampSaida', '<=', f).get()
    .then(s => { const l = []; s.forEach(d => { const x = d.data(); if (x.status !== 'Cancelado') l.push({ id: d.id, ...x }); }); return l; });
}
function carregar() {
  const iv = intervalo(), dur = iv.fim - iv.inicio;
  Promise.all([buscar(iv.inicio, iv.fim), buscar(iv.inicio - dur, iv.inicio)]).then(([a, b]) => {
    cargas = a; cargasAnt = b; recalcular(); renderTudo();
  }).catch(e => alert('Erro ao carregar frete: ' + e.message));
}
function abrir() {
  if (!iniciado) {
    iniciado = true;
    db.collection('tabela_frete').onSnapshot(snap => {
      tabela = []; mapa = {}; erroTabela = '';
      snap.forEach(d => { const r = { id: d.id, ...d.data() }; tabela.push(r); mapa[r.codigo + '_' + r.tipoCod] = r; });
      recalcular(); renderTabela(); renderTudo();
    }, err => { erroTabela = 'Sem permissão para ler "tabela_frete". Ajuste as regras do Firestore. (' + err.message + ')'; renderTabela(); });
    db.collection('veiculos_frete').onSnapshot(snap => {
      veic = []; mveic = {}; erroVeic = '';
      snap.forEach(d => { const r = { id: d.id, ...d.data() }; veic.push(r); mveic[d.id] = r; });
      recalcular(); renderTudo();
    }, err => { erroVeic = 'Sem permissão para ler "veiculos_frete". Ajuste as regras do Firestore. (' + err.message + ')'; renderVeiculos(); });
  }
  carregar();
}

/* ---------- Render: resumo ---------- */
function renderTudo() { renderResumo(); renderDetalhe(); renderVeiculos(); }
const soma = l => l.reduce((s, c) => s + c.calc.valor, 0);

function barras(idEl, dados) {
  const el = $(idEl); el.innerHTML = '';
  const ch = Object.keys(dados).sort((a, b) => { const [da, ma] = a.split('/').map(Number), [db_, mb] = b.split('/').map(Number); return (ma - mb) || (da - db_); });
  if (!ch.length) { el.innerHTML = '<div class="empty-msg" style="width:100%">Nenhum dado no período.</div>'; return; }
  const max = Math.max(1, ...ch.map(c => dados[c]));
  ch.forEach(k => {
    const v = dados[k], col = document.createElement('div');
    col.className = 'bar-coluna'; col.style.minWidth = '56px';
    col.innerHTML = `<div class="bar-valor">${v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : v.toFixed(0)}</div><div class="bar-visual" style="height:${v / max * 100}%"></div><div class="bar-label">${k}</div>`;
    el.appendChild(col);
  });
}
function agrupar(lista, fn) {
  const g = {};
  lista.forEach(c => { const k = fn(c); if (!k || k === '-') return; (g[k] = g[k] || { n: 0, t: 0 }); g[k].n++; g[k].t += c.calc.valor; });
  return Object.entries(g).sort((a, b) => b[1].t - a[1].t);
}
const FNS = {
  placa: c => c.placa, motorista: c => c.motorista && c.motorista !== '-' ? c.motorista : null,
  tipo: c => c.calc.tipo ? nomeTipo(c.calc.tipo) : null, base: c => c.calc.baseNome || null
};

function detalheGrupo(lista) {
  const l = [...lista].sort((a, b) => (b.timestampSaida || 0) - (a.timestampSaida || 0));
  return `<div class="fr-scroll"><table><thead><tr><th>Saída</th><th>Placa</th><th>Filial digitada</th><th>Lojas e frete</th><th>Frete considerado</th></tr></thead><tbody>${l.map(c => {
    const multi = (c.calc.lojas || []).length > 1;
    const lojas = (c.calc.lojas || []).map(x => `<div>${x.nome ? esc(x.nome) : 'Loja ' + esc(x.cod)} — ${x.valor != null ? '<strong>' + BRL(x.valor) + '</strong>' : '<span class="fr-warn">sem frete</span>'}${multi && c.calc.base === x.cod ? ' <span class="fr-ok">← base</span>' : ''}</div>`).join('') || '-';
    return `<tr><td>${fmtDH(c.timestampSaida)}</td><td><strong>${esc(c.placa)}</strong></td><td>${esc(c.filial || '-')}</td><td>${lojas}</td><td>${c.calc.valor ? '<strong class="fr-ok">' + BRL(c.calc.valor) + '</strong>' : '<span class="fr-warn">' + esc(c.calc.motivo) + '</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderResumo() {
  renderFiltro();
  const F = cargas.filter(passa), AF = cargasAnt.filter(passa);
  const total = soma(F), ant = soma(AF), n = F.length, pend = F.filter(c => !c.calc.valor).length;
  $('fr-filtro-info').textContent = filtroAtivo() ? '(filtro ativo)' : '';
  $('fr-total').textContent = BRL(total);
  $('fr-qtd').textContent = n;
  $('fr-ticket').textContent = n - pend > 0 ? BRL(total / (n - pend)) : '-';
  $('fr-maior').textContent = n ? BRL(Math.max(0, ...F.map(c => c.calc.valor))) : '-';
  $('fr-pend').textContent = pend;
  $('fr-pend').style.color = pend ? 'var(--travel)' : 'var(--success)';
  if (ant > 0) {
    const v = (total - ant) / ant * 100;
    $('fr-comp-total').innerHTML = `<span style="color:${v >= 0 ? 'var(--success)' : 'var(--danger)'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)}% vs período anterior (${BRL(ant)})</span>`;
  } else $('fr-comp-total').innerHTML = '';

  const porDia = {};
  F.forEach(c => { if (!c.timestampSaida) return; const k = new Date(c.timestampSaida).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); porDia[k] = (porDia[k] || 0) + c.calc.valor; });
  barras('fr-grafico', porDia);

  const rk = agrupar(F, FNS[modo]), corpo = $('fr-rank'); corpo.innerHTML = '';
  $('fr-rank-vazio').classList.toggle('hidden', rk.length > 0);
  rk.forEach(([k, d], i) => {
    const p = total ? d.t / total * 100 : 0, chave = modo + '|' + k, aberto = abertos.has(chave), tr = document.createElement('tr');
    tr.className = 'fr-rk'; tr.dataset.rk = chave;
    tr.innerHTML = `<td>${i + 1}º</td><td><strong>${aberto ? '▾' : '▸'} ${esc(k)}</strong></td><td>${d.n}</td><td><strong>${BRL(d.t)}</strong></td><td>${BRL(d.t / d.n)}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="fr-bar-bg"><div class="fr-bar" style="width:${p}%"></div></div>${p.toFixed(1)}%</div></td>`;
    corpo.appendChild(tr);
    if (aberto) {
      const t2 = document.createElement('tr'); t2.className = 'fr-det-row';
      t2.innerHTML = `<td colspan="6">${detalheGrupo(F.filter(c => FNS[modo](c) === k))}</td>`;
      corpo.appendChild(t2);
    }
  });

  const placas = agrupar(F, c => c.placa).map(x => x[0]);
  const a = $('fr-cmp-a'), b = $('fr-cmp-b'), va = a.value, vb = b.value;
  const opts = '<option value="">Selecione a placa</option>' + placas.map(p => `<option>${esc(p)}</option>`).join('');
  a.innerHTML = opts; b.innerHTML = opts;
  if (placas.includes(va)) a.value = va; if (placas.includes(vb)) b.value = vb;
  renderComparador(F);
}
function renderComparador(F) {
  F = F || cargas.filter(passa);
  const pa = $('fr-cmp-a').value, pb = $('fr-cmp-b').value, el = $('fr-cmp-res');
  if (!pa || !pb) { el.innerHTML = '<div class="empty-msg">Escolha duas placas para comparar.</div>'; return; }
  const dado = p => { const l = F.filter(c => c.placa === p); const t = soma(l); return { n: l.length, t, m: l.length ? t / l.length : 0 }; };
  const A = dado(pa), B = dado(pb), dif = A.t - B.t, lider = dif >= 0 ? pa : pb;
  const card = (p, d, w) => `<div class="stat-card" style="${w ? 'border-color:var(--success)' : ''}"><div style="font-weight:800;color:var(--primary);font-size:1.1rem">${esc(p)} ${w ? '🏆' : ''}</div><div class="stat-numero" style="font-size:1.6rem">${BRL(d.t)}</div><div class="stat-label">${d.n} carregamento(s) · médio ${BRL(d.m)}</div></div>`;
  el.innerHTML = card(pa, A, dif > 0) + card(pb, B, dif < 0) +
    `<div class="stat-card"><div class="stat-label">Diferença</div><div class="stat-numero" style="font-size:1.6rem">${BRL(Math.abs(dif))}</div><div class="stat-label">${dif === 0 ? 'Empate' : esc(lider) + ' na frente'}</div></div>`;
}

/* ---------- Render: carregamentos ---------- */
function opcoesTipo(sel) {
  return '<option value="">— definir —</option>' + tiposLista().map(t => `<option value="${t.cod}" ${t.cod === sel ? 'selected' : ''}>${t.cod} - ${esc(t.nome)}</option>`).join('');
}
function renderDetalhe() {
  const corpo = $('fr-det'); corpo.innerHTML = '';
  const so = $('fr-so-pend').checked;
  const l = [...cargas].filter(c => !so || !c.calc.valor).sort((a, b) => (b.timestampSaida || 0) - (a.timestampSaida || 0));
  $('fr-det-vazio').classList.toggle('hidden', l.length > 0);
  l.forEach(c => {
    const cad = !!mveic[normP(c.placa)];
    const multi = c.calc.cods.length > 1 ? ` <small style="color:#7f8c8d">(${c.calc.cods.length} lojas: ${c.calc.cods.join(', ')})</small>` : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong style="color:var(--primary)">${esc(c.placa)}</strong></td><td>${esc(c.motorista)}</td><td>${esc(c.filial || '-')}${multi}</td>
      <td><select class="fr-sel" data-tipo-placa="${esc(c.placa)}">${opcoesTipo(c.calc.tipo)}</select><br><small style="color:#7f8c8d">${cad ? 'do cadastro' : 'sem cadastro'}</small></td>
      <td>${c.calc.baseNome ? esc(c.calc.baseNome) : '-'}</td>
      <td>${c.calc.valor ? `<span class="fr-ok">${BRL(c.calc.valor)}</span>` : `<span class="fr-warn">${esc(c.calc.motivo)}</span>`}</td>
      <td>${fmtDH(c.timestampSaida)}</td><td><button class="btn-action btn-edit" data-act="filial" data-id="${esc(c.id)}">Filial</button></td>`;
    corpo.appendChild(tr);
  });
}

/* ---------- Render: veículos ---------- */
function setTipo(placa, tipo) {
  if (!logado()) { renderTudo(); return; }
  const p = String(placa).toUpperCase();
  if (!tipo) { renderTudo(); return; }
  db.collection('veiculos_frete').doc(normP(p)).set({ placa: p, tipoCod: tipo }, { merge: true }).catch(e => { alert('Erro ao salvar: ' + e.message); renderTudo(); });
}
function renderVeiculos() {
  const q = $('fr-v-busca').value.trim().toLowerCase();
  const sem = [...new Set(cargas.map(c => c.placa).filter(p => p && !mveic[normP(p)]))].sort();
  $('fr-v-sem').innerHTML = sem.length ? `<section class="card"><h2 style="color:var(--travel)">Placas com carregamento sem cadastro (${sem.length})</h2><p style="font-size:.8rem;color:#6f8095;margin-top:0">Escolha o tipo para cadastrar (usa o período selecionado na aba Resumo/Carregamentos).</p><div class="fr-comp-res">${sem.map(p => `<div class="stat-card" style="padding:12px"><strong style="color:var(--primary)">${esc(p)}</strong><br><select class="fr-sel" style="margin-top:6px" data-tipo-placa="${esc(p)}">${opcoesTipo('')}</select></div>`).join('')}</div></section>` : '';
  $('fr-v-erro').textContent = erroVeic; $('fr-v-erro').classList.toggle('hidden', !erroVeic);
  const l = veic.filter(v => !q || ((v.placa || '') + ' ' + (v.proprietario || '') + ' ' + (v.obs || '')).toLowerCase().includes(q)).sort((a, b) => (a.placa || '').localeCompare(b.placa || ''));
  $('fr-v-qtd').textContent = veic.length;
  $('fr-v-vazio').classList.toggle('hidden', l.length > 0 || !!erroVeic);
  const corpo = $('fr-v-corpo'); corpo.innerHTML = '';
  l.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong style="color:var(--primary)">${esc(v.placa)}</strong></td><td><select class="fr-sel" data-tipo-placa="${esc(v.placa)}">${opcoesTipo(v.tipoCod)}</select></td><td>${esc(v.proprietario || '-')}</td><td>${esc(v.obs || '-')}</td>
      <td><button class="btn-action btn-edit" data-act="vEditar" data-id="${esc(v.id)}">Editar</button><button class="btn-action btn-cancel" data-act="vExcluir" data-id="${esc(v.id)}">Excluir</button></td>`;
    corpo.appendChild(tr);
  });
}
function vIncluir() {
  if (!logado()) return;
  const p = (prompt('Placa do veículo (AAA-0A00):') || '').trim().toUpperCase();
  if (!p) return;
  if (!/^[A-Z]{3}-[0-9][A-Z0-9][0-9]{2}$/.test(p)) { alert('Formato de placa inválido. Exemplo: AAA-0A00'); return; }
  if (mveic[normP(p)] && !confirm('Esta placa já está cadastrada. Substituir os dados?')) return;
  const tipos = tiposLista();
  const t = (prompt('Porte / tipo (digite o código):\n' + tipos.map(x => x.cod + ' = ' + x.nome).join('\n')) || '').trim();
  if (!tipos.some(x => x.cod === t)) { alert('Tipo inválido.'); return; }
  const prop = (prompt('Proprietário / motorista (opcional):') || '').trim();
  const obs = (prompt('Observação (opcional):') || '').trim();
  db.collection('veiculos_frete').doc(normP(p)).set({ placa: p, tipoCod: t, proprietario: prop, obs }, { merge: true }).catch(e => alert('Erro ao salvar: ' + e.message));
}
function vEditar(id) {
  if (!logado()) return;
  const v = mveic[id]; if (!v) return;
  const prop = prompt('Proprietário / motorista:', v.proprietario || ''); if (prop === null) return;
  const obs = prompt('Observação:', v.obs || ''); if (obs === null) return;
  db.collection('veiculos_frete').doc(id).update({ proprietario: prop.trim(), obs: obs.trim() }).catch(e => alert('Erro: ' + e.message));
}
function vExcluir(id) {
  if (!logado()) return;
  const v = mveic[id]; if (!v) return;
  if (confirm('Excluir o veículo ' + v.placa + ' do cadastro?')) db.collection('veiculos_frete').doc(id).delete().catch(e => alert('Erro: ' + e.message));
}

/* ---------- Render: tabela de frete ---------- */
function renderTabela() {
  const q = $('fr-busca').value.trim().toLowerCase(), ft = $('fr-filtro-tipo');
  const tipos = tiposLista(), atual = ft.value;
  ft.innerHTML = '<option value="">Todos os tipos</option>' + tipos.map(t => `<option value="${t.cod}">${t.cod} - ${esc(t.nome)}</option>`).join('');
  ft.value = atual;
  const l = tabela.filter(r => (!ft.value || r.tipoCod === ft.value) && (!q || (r.codigo + ' ' + r.nome).toLowerCase().includes(q)))
    .sort((a, b) => (a.codigo - b.codigo) || (a.tipoCod - b.tipoCod));
  $('fr-tab-qtd').textContent = tabela.length;
  $('fr-tab-erro').textContent = erroTabela; $('fr-tab-erro').classList.toggle('hidden', !erroTabela);
  $('fr-tab-vazio').classList.toggle('hidden', l.length > 0 || !!erroTabela);
  const corpo = $('fr-tab-corpo'); corpo.innerHTML = '';
  l.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${esc(r.codigo)}</strong></td><td>${esc(r.nome)}</td><td>${esc(r.tipoCod)} - ${esc(r.tipoNome)}</td><td><strong>${BRL(r.valor)}</strong></td><td>${r.distancia || '-'}</td>
      <td><button class="btn-action btn-edit" data-act="editar" data-id="${esc(r.id)}">Editar</button><button class="btn-action btn-cancel" data-act="excluir" data-id="${esc(r.id)}">Excluir</button></td>`;
    corpo.appendChild(tr);
  });
}

/* ---------- Edição da tabela de frete ---------- */
function incluir() {
  if (!logado()) return;
  const cod = (prompt('Código da filial (ex: 46):') || '').trim();
  if (!/^\d+$/.test(cod)) return;
  const ex = tabela.find(r => r.codigo === cod);
  const nome = (prompt('Nome completo da loja (ex: 46 - MATEUS SUPERMERCADOS S.A. SUPER MAGUARI):', ex ? ex.nome : cod + ' - ') || '').trim();
  if (!nome) return;
  const tipos = tiposLista();
  const t = (prompt('Tipo do caminhão (digite o código):\n' + tipos.map(x => x.cod + ' = ' + x.nome).join('\n') + '\n\nOu digite um código novo.') || '').trim();
  if (!/^\d+$/.test(t)) return;
  let tn = (tipos.find(x => x.cod === t) || {}).nome;
  if (!tn) { tn = (prompt('Código novo. Nome do tipo (ex: TRUCK BAU CARGA SECA):') || '').trim(); if (!tn) return; }
  const valor = num(prompt('Valor do frete (R$), ex: 4.450,00:'));
  if (isNaN(valor)) { alert('Valor inválido.'); return; }
  const dist = parseFloat(prompt('Distância em km (opcional):') || '') || 0;
  const id = cod + '_' + t;
  if (mapa[id] && !confirm('Já existe frete para esta filial e tipo (' + BRL(mapa[id].valor) + '). Substituir?')) return;
  db.collection('tabela_frete').doc(id).set({ codigo: cod, nome, tipoCod: t, tipoNome: tn, valor, distancia: dist }, { merge: true }).catch(e => alert('Erro ao salvar: ' + e.message));
}
function editar(id) {
  if (!logado()) return;
  const r = tabela.find(x => x.id === id); if (!r) return;
  const nome = prompt('Nome da loja:', r.nome); if (nome === null) return;
  const v = prompt('Valor do frete (R$):', String(r.valor).replace('.', ',')); if (v === null) return;
  const valor = num(v); if (isNaN(valor)) { alert('Valor inválido.'); return; }
  const d = prompt('Distância (km):', r.distancia || 0); if (d === null) return;
  db.collection('tabela_frete').doc(r.id).update({ nome: nome.trim(), valor, distancia: parseFloat(d) || 0 }).catch(e => alert('Erro: ' + e.message));
}
function excluir(id) {
  if (!logado()) return;
  const r = tabela.find(x => x.id === id); if (!r) return;
  if (confirm('Excluir o frete da filial ' + r.codigo + ' (' + r.tipoNome + ')?')) db.collection('tabela_frete').doc(id).delete().catch(e => alert('Erro: ' + e.message));
}
function carregarXLSX() {
  return new Promise((ok, no) => {
    if (window.XLSX) return ok();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = ok; s.onerror = () => no(new Error('Não foi possível carregar o leitor de planilha.'));
    document.head.appendChild(s);
  });
}
function importar() {
  if (!logado()) return;
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = async () => {
    try {
      await carregarXLSX();
      const wb = XLSX.read(await inp.files[0].arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
      const h = (rows[0] || []).map(x => String(x || '').toUpperCase());
      const ix = (k, d) => { const i = h.findIndex(x => x.includes(k)); return i >= 0 ? i : d; };
      const iF = ix('FILIAL', 0), iT = ix('TIPO', 1), iV = ix('VALOR', 4), iD = ix('DISTANCIA', 5);
      const docs = {}; let ign = 0;
      rows.slice(1).forEach(r => {
        const f = String(r[iF] == null ? '' : r[iF]).trim().match(/^(\d+)\s*-\s*\S/), t = String(r[iT] == null ? '' : r[iT]).trim().match(/^(\d+)\s*-\s*(.+)$/), v = num(r[iV]);
        if (!f || !t || isNaN(v)) { ign++; return; }
        const d = num(r[iD]);
        docs[f[1] + '_' + t[1]] = { codigo: f[1], nome: String(r[iF]).trim(), tipoCod: t[1], tipoNome: t[2].trim(), valor: v, distancia: isFinite(d) ? d : 0 };
      });
      const ids = Object.keys(docs), novos = ids.filter(i => !mapa[i]).length, alt = ids.filter(i => mapa[i] && mapa[i].valor !== docs[i].valor).length;
      if (!ids.length) { alert('Nenhum frete válido encontrado na planilha.'); return; }
      if (!confirm(`Importar ${ids.length} linhas?\n\nNovas: ${novos}\nValor alterado: ${alt}\nLinhas ignoradas: ${ign}\n\nO que não estiver na planilha continua como está.`)) return;
      for (let i = 0; i < ids.length; i += 400) {
        const b = db.batch();
        ids.slice(i, i + 400).forEach(id => b.set(db.collection('tabela_frete').doc(id), docs[id], { merge: true }));
        await b.commit();
      }
      alert('Importação concluída: ' + ids.length + ' fretes.');
    } catch (e) { alert('Erro na importação: ' + e.message); }
  };
  inp.click();
}

/* ---------- Eventos ---------- */
sec.addEventListener('click', e => {
  const s = e.target.closest('[data-sub]'); if (s) { mudarSub(s.dataset.sub); return; }
  const p = e.target.closest('[data-per]');
  if (p) {
    per = p.dataset.per; dIni = dFim = null; $('fr-ini').value = ''; $('fr-fim').value = '';
    sec.querySelectorAll('[data-per]').forEach(b => b.classList.toggle('active', b === p));
    carregar(); return;
  }
  const ch = e.target.closest('[data-chip]'); if (ch) { selF.delete(ch.dataset.chip); renderResumo(); return; }
  const rk = e.target.closest('[data-rk]');
  if (rk) { const k = rk.dataset.rk; abertos.has(k) ? abertos.delete(k) : abertos.add(k); renderResumo(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const id = a.dataset.id, ac = a.dataset.act;
  if (ac === 'incluir') incluir();
  else if (ac === 'importar') importar();
  else if (ac === 'editar') editar(id);
  else if (ac === 'excluir') excluir(id);
  else if (ac === 'vIncluir') vIncluir();
  else if (ac === 'vEditar') vEditar(id);
  else if (ac === 'vExcluir') vExcluir(id);
  else if (ac === 'limparFiltro') { selF.clear(); txtF = ''; $('fr-txt').value = ''; renderResumo(); }
  else if (ac === 'aplicar') {
    let i = $('fr-ini').value, f = $('fr-fim').value;
    if (!i && !f) { alert('Informe a data inicial (e a final, se quiser um período).'); return; }
    if (!i) i = f; if (!f) f = i;
    if (f < i) [i, f] = [f, i];
    dIni = i; dFim = f; per = 'intervalo';
    sec.querySelectorAll('[data-per]').forEach(b => b.classList.remove('active'));
    carregar();
  }
  else if (ac === 'filial') {
    if (!logado()) return;
    const c = cargas.find(x => x.id === id); if (!c) return;
    const nv = prompt('Filial destino (use o número inicial; para várias lojas separe por "/", ex: 46 / 52):', c.filial || '');
    if (nv === null) return;
    db.collection('fila_patio').doc(id).update({ filial: nv.trim() }).then(() => { c.filial = nv.trim(); c.calc = calcular(c); renderTudo(); }).catch(er => alert('Erro: ' + er.message));
  }
});
sec.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.fk) { t.checked ? selF.add(t.dataset.fk) : selF.delete(t.dataset.fk); renderResumo(); }
  else if (t.dataset.tipoPlaca !== undefined) setTipo(t.dataset.tipoPlaca, t.value);
  else if (t.id === 'fr-campo') { campoF = t.value; renderFiltro(); }
  else if (t.id === 'fr-modo') { modo = t.value; renderResumo(); }
  else if (t.id === 'fr-cmp-a' || t.id === 'fr-cmp-b') renderComparador();
  else if (t.id === 'fr-so-pend') renderDetalhe();
  else if (t.id === 'fr-filtro-tipo') renderTabela();
});
$('fr-txt').addEventListener('input', e => { txtF = e.target.value.trim().toLowerCase(); renderResumo(); });
$('fr-busca').addEventListener('input', renderTabela);
$('fr-v-busca').addEventListener('input', renderVeiculos);
})();
