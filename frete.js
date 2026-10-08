/* ===== ABA FRETE - Painel CD84 =====
   Incluir no painel.html, logo antes de </body>:  <script src="frete.js"></script>
   Coleção Firestore usada: "tabela_frete" (id = codigo_tipo). Campo novo em fila_patio: tipoVeiculo. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const BRL = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDH = ts => ts ? new Date(ts).toLocaleDateString('pt-BR') + ' ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
const num = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).trim().replace(/\./g, '').replace(',', '.')); return n; };
const logado = () => { if (!window.usuarioLogado && typeof usuarioLogado === 'undefined') return false; if (!usuarioLogado) { alert('Acesso negado! Faça o login de administrador primeiro.'); return false; } return true; };

let tabela = [], mapa = {}, cargas = [], cargasAnt = [];
let per = 'hoje', dataEsp = null, modo = 'placa', sub = 'resumo', iniciado = false, erroTabela = '';

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
  <button type="button" class="tab-btn" data-sub="tabela">Tabela de Frete</button>
</div>
<section class="card" id="fr-periodo-card">
  <div class="periodo-seletor">
    <button type="button" class="periodo-btn active" data-per="hoje">Hoje</button>
    <button type="button" class="periodo-btn" data-per="7dias">7 dias</button>
    <button type="button" class="periodo-btn" data-per="30dias">30 dias</button>
    <input type="date" id="fr-data" class="input-data-especifica" title="Consultar um dia específico">
  </div>
</section>

<div id="fr-resumo" class="fr-sub">
  <section class="card">
    <h2>Resumo de Frete</h2>
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
    <div class="fr-scroll"><table><thead><tr><th>Pos.</th><th>Nome</th><th>Carregamentos</th><th>Frete Total</th><th>Médio</th><th>% do total</th></tr></thead><tbody id="fr-rank"></tbody></table></div>
    <div id="fr-rank-vazio" class="empty-msg hidden">Nenhum carregamento no período.</div>
  </section>
  <section class="card">
    <h2>Comparar Veículos</h2>
    <div class="fr-comp">
      <select id="fr-cmp-a" class="fr-sel"></select><b>×</b><select id="fr-cmp-b" class="fr-sel"></select>
    </div>
    <div class="fr-comp-res" id="fr-cmp-res"></div>
  </section>
</div>

<div id="fr-detalhe" class="fr-sub hidden">
  <section class="card">
    <div class="card-header-flex">
      <h2>Carregamentos e Frete Calculado</h2>
      <label style="font-size:.85rem;font-weight:600"><input type="checkbox" id="fr-so-pend"> Só pendentes</label>
    </div>
    <p style="font-size:.8rem;color:#6f8095;margin-top:0">O frete é calculado pelo código da filial + tipo do caminhão. Com mais de uma filial, vale o maior frete.</p>
    <div class="fr-scroll"><table><thead><tr><th>Placa</th><th>Motorista</th><th>Filial (digitada)</th><th>Tipo do caminhão</th><th>Base do frete</th><th>Frete</th><th>Saída</th><th>Ações</th></tr></thead><tbody id="fr-det"></tbody></table></div>
    <div id="fr-det-vazio" class="empty-msg hidden">Nenhum carregamento no período.</div>
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
  sub = s;
  sec.querySelectorAll('[data-sub]').forEach(b => b.classList.toggle('active', b.dataset.sub === s));
  ['resumo', 'detalhe', 'tabela'].forEach(x => $('fr-' + x).classList.toggle('hidden', x !== s));
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
function calcular(c) {
  const cods = codigos(c.filial);
  if (!cods.length) return { valor: 0, motivo: 'Filial sem código' };
  if (!c.tipoVeiculo) return { valor: 0, motivo: 'Definir tipo do caminhão', cods };
  let best = null;
  cods.forEach(k => { const r = mapa[k + '_' + c.tipoVeiculo]; if (r && (!best || r.valor > best.valor)) best = r; });
  if (!best) return { valor: 0, motivo: 'Frete não cadastrado', cods };
  return { valor: best.valor, base: best.codigo, baseNome: best.nome, cods };
}
const recalcular = () => { cargas.forEach(c => c.calc = calcular(c)); cargasAnt.forEach(c => c.calc = calcular(c)); };
const nomeTipo = cod => { const t = tiposLista().find(x => x.cod === cod); return t ? cod + ' - ' + t.nome : (cod || '-'); };

/* ---------- Dados ---------- */
function intervalo() {
  const ag = new Date();
  if (per === 'especifico' && dataEsp) {
    const [a, m, d] = dataEsp.split('-').map(Number);
    return { inicio: new Date(a, m - 1, d, 0, 0, 0, 0).getTime(), fim: new Date(a, m - 1, d, 23, 59, 59, 999).getTime() };
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
  }
  carregar();
}

/* ---------- Render ---------- */
function renderTudo() { renderResumo(); renderDetalhe(); }
const soma = l => l.reduce((s, c) => s + c.calc.valor, 0);

function barras(idEl, dados) {
  const el = $(idEl); el.innerHTML = '';
  let ch = Object.keys(dados).sort((a, b) => { const [da, ma] = a.split('/').map(Number), [db_, mb] = b.split('/').map(Number); return (ma - mb) || (da - db_); });
  if (!ch.length) { el.innerHTML = '<div class="empty-msg" style="width:100%">Nenhum dado no período.</div>'; return; }
  const max = Math.max(1, ...ch.map(c => dados[c]));
  ch.forEach(k => {
    const v = dados[k], col = document.createElement('div');
    col.className = 'bar-coluna'; col.style.minWidth = '56px';
    col.innerHTML = `<div class="bar-valor">${v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : v.toFixed(0)}</div><div class="bar-visual" style="height:${v / max * 100}%"></div><div class="bar-label">${k}</div>`;
    el.appendChild(col);
  });
}

function agrupar(fn) {
  const g = {};
  cargas.forEach(c => { const k = fn(c); if (!k || k === '-') return; (g[k] = g[k] || { n: 0, t: 0 }); g[k].n++; g[k].t += c.calc.valor; });
  return Object.entries(g).sort((a, b) => b[1].t - a[1].t);
}

function renderResumo() {
  const total = soma(cargas), ant = soma(cargasAnt), n = cargas.length;
  const pend = cargas.filter(c => !c.calc.valor).length;
  $('fr-total').textContent = BRL(total);
  $('fr-qtd').textContent = n;
  $('fr-ticket').textContent = n ? BRL(total / (n - pend || 1)) : '-';
  $('fr-maior').textContent = n ? BRL(Math.max(0, ...cargas.map(c => c.calc.valor))) : '-';
  $('fr-pend').textContent = pend;
  $('fr-pend').style.color = pend ? 'var(--travel)' : 'var(--success)';
  if (ant > 0) {
    const v = (total - ant) / ant * 100;
    $('fr-comp-total').innerHTML = `<span style="color:${v >= 0 ? 'var(--success)' : 'var(--danger)'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)}% vs período anterior (${BRL(ant)})</span>`;
  } else $('fr-comp-total').innerHTML = '';

  const porDia = {};
  cargas.forEach(c => { if (!c.timestampSaida) return; const k = new Date(c.timestampSaida).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); porDia[k] = (porDia[k] || 0) + c.calc.valor; });
  barras('fr-grafico', porDia);

  const fns = {
    placa: c => c.placa, motorista: c => c.motorista && c.motorista !== '-' ? c.motorista : null,
    tipo: c => c.tipoVeiculo ? nomeTipo(c.tipoVeiculo) : null, base: c => c.calc.baseNome || null
  };
  const rk = agrupar(fns[modo]), corpo = $('fr-rank'); corpo.innerHTML = '';
  $('fr-rank-vazio').classList.toggle('hidden', rk.length > 0);
  rk.forEach(([k, d], i) => {
    const p = total ? d.t / total * 100 : 0, tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}º</td><td><strong>${esc(k)}</strong></td><td>${d.n}</td><td><strong>${BRL(d.t)}</strong></td><td>${BRL(d.t / d.n)}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="fr-bar-bg"><div class="fr-bar" style="width:${p}%"></div></div>${p.toFixed(1)}%</div></td>`;
    corpo.appendChild(tr);
  });

  // comparador de placas
  const placas = agrupar(c => c.placa).map(x => x[0]);
  const a = $('fr-cmp-a'), b = $('fr-cmp-b'), va = a.value, vb = b.value;
  const opts = '<option value="">Selecione a placa</option>' + placas.map(p => `<option>${esc(p)}</option>`).join('');
  a.innerHTML = opts; b.innerHTML = opts;
  if (placas.includes(va)) a.value = va; if (placas.includes(vb)) b.value = vb;
  renderComparador();
}

function renderComparador() {
  const pa = $('fr-cmp-a').value, pb = $('fr-cmp-b').value, el = $('fr-cmp-res');
  if (!pa || !pb) { el.innerHTML = '<div class="empty-msg">Escolha duas placas para comparar.</div>'; return; }
  const dado = p => { const l = cargas.filter(c => c.placa === p); const t = soma(l); return { n: l.length, t, m: l.length ? t / l.length : 0 }; };
  const A = dado(pa), B = dado(pb), dif = A.t - B.t, lider = dif >= 0 ? pa : pb;
  const card = (p, d, w) => `<div class="stat-card" style="${w ? 'border-color:var(--success)' : ''}"><div style="font-weight:800;color:var(--primary);font-size:1.1rem">${esc(p)} ${w ? '🏆' : ''}</div><div class="stat-numero" style="font-size:1.6rem">${BRL(d.t)}</div><div class="stat-label">${d.n} carregamento(s) · médio ${BRL(d.m)}</div></div>`;
  el.innerHTML = card(pa, A, dif > 0) + card(pb, B, dif < 0) +
    `<div class="stat-card"><div class="stat-label">Diferença</div><div class="stat-numero" style="font-size:1.6rem">${BRL(Math.abs(dif))}</div><div class="stat-label">${dif === 0 ? 'Empate' : esc(lider) + ' na frente'}</div></div>`;
}

function renderDetalhe() {
  const corpo = $('fr-det'); corpo.innerHTML = '';
  const so = $('fr-so-pend').checked;
  const l = [...cargas].filter(c => !so || !c.calc.valor).sort((a, b) => (b.timestampSaida || 0) - (a.timestampSaida || 0));
  $('fr-det-vazio').classList.toggle('hidden', l.length > 0);
  const tipos = tiposLista();
  l.forEach(c => {
    const tr = document.createElement('tr');
    const sel = `<select class="fr-sel" data-tipo-id="${esc(c.id)}"><option value="">— definir —</option>${tipos.map(t => `<option value="${t.cod}" ${t.cod === c.tipoVeiculo ? 'selected' : ''}>${t.cod} - ${esc(t.nome)}</option>`).join('')}</select>`;
    const multi = c.calc.cods && c.calc.cods.length > 1 ? ` <small style="color:#7f8c8d">(${c.calc.cods.length} lojas: ${c.calc.cods.join(', ')})</small>` : '';
    tr.innerHTML = `<td><strong style="color:var(--primary)">${esc(c.placa)}</strong></td><td>${esc(c.motorista)}</td><td>${esc(c.filial || '-')}${multi}</td><td>${sel}</td>
      <td>${c.calc.baseNome ? esc(c.calc.baseNome) : '-'}</td>
      <td>${c.calc.valor ? `<span class="fr-ok">${BRL(c.calc.valor)}</span>` : `<span class="fr-warn">${esc(c.calc.motivo)}</span>`}</td>
      <td>${fmtDH(c.timestampSaida)}</td><td><button class="btn-action btn-edit" data-act="filial" data-id="${esc(c.id)}">Filial</button></td>`;
    corpo.appendChild(tr);
  });
}

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

/* ---------- Edição da tabela ---------- */
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
  db.collection('tabela_frete').doc(id).set({ codigo: cod, nome, tipoCod: t, tipoNome: tn, valor, distancia: dist }, { merge: true })
    .catch(e => alert('Erro ao salvar: ' + e.message));
}
function editar(id) {
  if (!logado()) return;
  const r = mapa[id.replace(/^/, '')] || tabela.find(x => x.id === id); if (!r) return;
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
    per = p.dataset.per; dataEsp = null; $('fr-data').value = '';
    sec.querySelectorAll('[data-per]').forEach(b => b.classList.toggle('active', b === p));
    carregar(); return;
  }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const id = a.dataset.id;
  if (a.dataset.act === 'incluir') incluir();
  else if (a.dataset.act === 'importar') importar();
  else if (a.dataset.act === 'editar') editar(id);
  else if (a.dataset.act === 'excluir') excluir(id);
  else if (a.dataset.act === 'filial') {
    if (!logado()) return;
    const c = cargas.find(x => x.id === id); if (!c) return;
    const nv = prompt('Filial destino (use o número inicial; para várias lojas separe por "/", ex: 46 / 52):', c.filial || '');
    if (nv === null) return;
    db.collection('fila_patio').doc(id).update({ filial: nv.trim() }).then(() => { c.filial = nv.trim(); c.calc = calcular(c); renderTudo(); }).catch(er => alert('Erro: ' + er.message));
  }
});
sec.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fr-data') { if (!t.value) return; dataEsp = t.value; per = 'especifico'; sec.querySelectorAll('[data-per]').forEach(b => b.classList.remove('active')); carregar(); }
  else if (t.id === 'fr-modo') { modo = t.value; renderResumo(); }
  else if (t.id === 'fr-cmp-a' || t.id === 'fr-cmp-b') renderComparador();
  else if (t.id === 'fr-so-pend') renderDetalhe();
  else if (t.id === 'fr-filtro-tipo') renderTabela();
  else if (t.dataset.tipoId) {
    if (!logado()) { renderDetalhe(); return; }
    const c = cargas.find(x => x.id === t.dataset.tipoId); if (!c) return;
    const v = t.value;
    db.collection('fila_patio').doc(c.id).update({ tipoVeiculo: v }).then(() => { c.tipoVeiculo = v; c.calc = calcular(c); renderTudo(); }).catch(er => { alert('Erro: ' + er.message); renderDetalhe(); });
  }
});
$('fr-busca').addEventListener('input', renderTabela);
})();
