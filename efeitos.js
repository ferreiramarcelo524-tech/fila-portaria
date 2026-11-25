/* Efeitos: blocos que se encaixam coluna a coluna + números contando do zero + montagem de abertura + nível de animação.
   Só adiciona classes/estilos; não toca em dados, formulários ou listeners existentes. Sem desfoque (leve e fluido). */
(function () {
  "use strict";
  const CFG = { col: 110, row: 65, atrasoMax: 700, max: 26, linhas: 10, passoLinha: 35, dist: 120, contagemMs: 900 };
  const root = document.documentElement, reduz = matchMedia("(prefers-reduced-motion: reduce)");
  const PANES = ".tab-conteudo,.dc-pane,.cv-pane,.fr-sub,#fr-proximas";            // painéis que aparecem/desaparecem
  const BLOCOS = ".card,.stat-card,.cal-day,.fila-item", INTERNOS = ".stat-card,.cal-day";
  const NUM = ".stat-numero,#mb-a,#mb-d,#mb-v";                                    // números com contagem (#dc-dia e #dc-mes têm controle próprio)
  const nivel = () => reduz.matches ? "off" : (root.getAttribute("data-anim") || "full");
  const mobile = () => root.classList.contains("mobile"), lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const visivel = (cls, el) => el.matches(".tab-conteudo") ? /(^|\s)ativo(\s|$)/.test(cls)
    : el.matches(".dc-pane,.cv-pane") ? /(^|\s)on(\s|$)/.test(cls) : !/(^|\s)hidden(\s|$)/.test(cls);
  const limpar = e => { e.classList.remove("fx-dock", "fx-snap", "fx-row"); e.style.removeProperty("--fx-x"); e.style.removeProperty("--fx-y"); e.style.removeProperty("--d"); };
  const livre = e => e.offsetParent !== null && !e.contains(document.activeElement);   // visível e sem campo em edição

  // ---- encaixe: agrupa por coluna (esq.→dir.) e, dentro dela, de cima para baixo; cada bloco vem do seu lado ----
  function dock(lista, base, k, mob) {
    const info = lista.map(e => ({ e, r: e.getBoundingClientRect() })), cols = [];
    info.slice().sort((a, b) => a.r.left - b.r.left).forEach(o => { const c = cols.find(c => Math.abs(c.left - o.r.left) < 70); c ? c.itens.push(o) : cols.push({ left: o.r.left, itens: [o] }); });
    const plano = [], lvl = nivel();
    cols.sort((a, b) => a.left - b.left).forEach((c, ci) => c.itens.sort((a, b) => a.r.top - b.r.top).forEach((o, ri) => plano.push({ o, ci, ri })));
    plano.slice(0, CFG.max).forEach(({ o, ci, ri }, n) => {
      const cx = (o.r.left + o.r.width / 2) / innerWidth - .5, cy = (o.r.top + o.r.height / 2) / innerHeight - .5;
      let x = mob ? (n % 2 ? 1 : -1) * 36 : lim(cx * 2 * CFG.dist, -CFG.dist, CFG.dist), y = mob ? 26 : lim(cy * 180, -90, 90);
      if (!mob && Math.abs(x) < 30 && Math.abs(y) < 30) y = 44;
      o.e.__fxD = Math.min(base + (mob ? 0 : ci * CFG.col) + ri * CFG.row, base + CFG.atrasoMax);
      limpar(o.e); o.e.style.setProperty("--fx-x", Math.round(x * k) + "px"); o.e.style.setProperty("--fx-y", Math.round(y * k) + "px"); o.e.style.setProperty("--d", o.e.__fxD + "ms");
      o.alvo = true;
    });
    void root.offsetWidth;                                                         // 1 única releitura de layout para reiniciar as animações
    plano.slice(0, CFG.max).forEach(({ o }) => { o.e.classList.add("fx-dock"); if (lvl === "full") o.e.classList.add("fx-snap"); });
  }
  function linhas(raiz, base) {                                                    // primeiras linhas de cada tabela entram em cascata curta
    raiz.querySelectorAll("tbody").forEach(tb => {
      if (tb.offsetParent === null) return;
      [...tb.rows].slice(0, CFG.linhas).filter(livre).forEach((tr, i) => { limpar(tr); tr.style.setProperty("--d", (base + i * CFG.passoLinha) + "ms"); tr.classList.add("fx-row"); });
    });
  }
  function montar(pane, base) {
    const lvl = nivel(); if (lvl === "off") return; base = base || 0;
    const blocos = [...pane.querySelectorAll(BLOCOS)].filter(e => livre(e) && !e.querySelector(INTERNOS));
    dock(blocos, base, lvl === "reduced" ? .4 : 1, mobile());
    linhas(pane, base + 240);
    pane.querySelectorAll(NUM).forEach(el => { const b = el.closest(".stat-card,.card,.cal-day"); contagemEntrada(el, ((b && b.__fxD) || base) + 380); });
  }
  function abertura() {                                                            // montagem inicial: topo desce, menu sobe, depois os blocos
    const lvl = nivel(); if (lvl === "off") return; const k = lvl === "reduced" ? .4 : 1;
    [["header", 0, -70], [".banner-aniversario", 0, -50], ["#mb-app", 0, -50], ["#mb-strip", 90, -40], [".container > .tabs", 160, 80]].forEach(([s, d, y]) => {
      const e = document.querySelector(s); if (!e || e.offsetParent === null) return;
      limpar(e); e.style.setProperty("--fx-x", "0px"); e.style.setProperty("--fx-y", Math.round(y * k) + "px"); e.style.setProperty("--d", d + "ms"); e.classList.add("fx-dock");
    });
    const a = document.querySelector(".tab-conteudo.ativo"); if (a) montar(a, 220);
  }
  function tabela(tb) {                                                            // 1ª carga de tabela vazia (as atualizações seguintes não animam)
    const n = tb.rows.length, antes = tb.__fxN || 0; tb.__fxN = n;
    if (!antes && n && nivel() !== "off" && tb.offsetParent !== null) linhas({ querySelectorAll: () => [tb] }, 120);
  }
  document.addEventListener("animationend", e => {                                 // devolve o elemento ao estado normal
    const t = e.target, n = e.animationName;
    if (n === "fxSnap" || n === "fxRow" || (n === "fxDock" && !t.classList.contains("fx-snap"))) limpar(t);
  }, true);

  // ---- contagem: do zero até o valor ao abrir a tela; do mostrado até o novo quando o valor muda ----
  function ler(txt) {
    const m = /^(\D*?)(-?\d[\d.]*(?:,\d+)?)(\D*)$/.exec(txt.trim()); if (!m) return null;
    const num = m[2], ponto = !num.includes(",") && /^-?\d+\.\d{1,2}$/.test(num);   // "12.5" = decimal; "1.234" = milhar
    const d = ponto ? num.split(".")[1].length : (num.split(",")[1] || "").length;
    return { p: m[1], s: m[3], d, ponto, v: ponto ? parseFloat(num) : parseFloat(num.replace(/\./g, "").replace(",", ".")) };
  }
  const fmt = (n, v) => n.p + (n.ponto ? v.toFixed(n.d) : v.toLocaleString("pt-BR", { minimumFractionDigits: n.d, maximumFractionDigits: n.d })) + n.s;
  const estado = el => el.__fx || (el.__fx = { w: null, cur: null, raf: 0, final: null, t: 0 });
  function animar(alvo, de, novo, fim) {
    const st = estado(alvo), t0 = performance.now(), dur = nivel() === "reduced" ? 550 : CFG.contagemMs; cancelAnimationFrame(st.raf); st.final = fim;
    const passo = t => {
      const p = Math.min(1, (t - t0) / dur), v = de + (novo.v - de) * (1 - Math.pow(1 - p, 3));
      st.cur = v; st.w = p < 1 ? fmt(novo, v) : fim; alvo.textContent = st.w;
      if (p < 1) st.raf = requestAnimationFrame(passo); else { st.raf = 0; st.cur = novo.v; }
    };
    st.raf = requestAnimationFrame(passo);
  }
  function contagemEntrada(el, atraso) {                                           // mostra zero já e começa a contar quando o bloco assenta
    if (!livre(el) || nivel() === "off") return;
    const st = estado(el), fim = st.raf && st.final ? st.final : el.textContent, n = ler(fim); if (!n) return;
    clearTimeout(st.t); cancelAnimationFrame(st.raf); st.final = fim; st.cur = 0; st.w = fmt(n, 0); el.textContent = st.w;
    st.t = setTimeout(() => animar(el, 0, n, fim), atraso);
  }
  function contar(node) {
    const el = node.nodeType === 1 ? node : node.parentElement; if (!el || !el.closest) return;
    const alvo = el.closest(NUM); if (!alvo) return;
    const st = estado(alvo), txt = alvo.textContent;
    if (txt === st.w) return;                                                      // foi a nossa própria escrita
    clearTimeout(st.t); const novo = ler(txt); if (!novo || nivel() === "off") { st.cur = novo ? novo.v : null; return; }
    const de = st.cur != null ? st.cur : 0; if (de !== novo.v) animar(alvo, de, novo, txt);
  }

  // ---- um único observador, filtrado: só painéis que ficaram visíveis, tbody e números ----
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === "attributes") {
        const el = m.target;
        if (el.matches && el.matches(PANES) && !visivel(m.oldValue || "", el) && visivel(el.className, el)) montar(el);
      } else if (m.type === "childList" && m.target.tagName === "TBODY") tabela(m.target);
      if (m.type !== "attributes") contar(m.target);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true, childList: true, characterData: true });

  // ---- botão de nível: Completas / Reduzidas / Desligadas (salvo neste aparelho) ----
  const NIVEIS = [["full", "Completas", "🎞"], ["reduced", "Reduzidas", "🎞·"], ["off", "Desligadas", "🎞✕"]];
  const ua = document.querySelector(".user-area"), bt = document.createElement("button"), mbBar = document.getElementById("mb-app"); let mb = null;
  bt.type = "button"; bt.className = "btn-login"; bt.id = "btn-anim"; if (ua) ua.insertBefore(bt, ua.firstChild);
  if (mbBar) { mb = document.createElement("button"); mb.type = "button"; mb.className = "mb-b sec"; mb.id = "mb-anim"; mbBar.insertBefore(mb, document.getElementById("mb-tema") || document.getElementById("mb-ver")); }
  const rot = () => { const n = NIVEIS.find(x => x[0] === (root.getAttribute("data-anim") || "full")) || NIVEIS[0]; bt.textContent = "🎞 " + n[1]; bt.title = "Animações: clique para alternar"; if (mb) { mb.textContent = n[2]; mb.title = "Animações: " + n[1]; } };
  const troca = () => { const i = NIVEIS.findIndex(x => x[0] === (root.getAttribute("data-anim") || "full")), n = NIVEIS[(i + 1) % 3][0]; root.setAttribute("data-anim", n); try { localStorage.setItem("cd84_anim", n); } catch (e) {} rot(); };
  bt.onclick = troca; if (mb) mb.onclick = troca; rot();

  // montagem de abertura (se a escolha de versão estiver aberta, espera ela fechar)
  const vs = document.getElementById("vs-back");
  if (vs && vs.classList.contains("on")) { const o = new MutationObserver(() => { if (!vs.classList.contains("on")) { o.disconnect(); requestAnimationFrame(abertura); } }); o.observe(vs, { attributes: true, attributeFilter: ["class"] }); }
  else abertura();
})();
