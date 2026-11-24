/* Efeitos (vídeo "Glassy Dashboard"): véu fosco -> cartões de vidro -> conteúdo em foco + contagem a partir do zero.
   Só adiciona classes/estilos; não toca em dados, formulários ou listeners existentes. */
(function () {
  "use strict";
  const CFG = { maxItens: 30, maxIndice: 14, contagemMs: 900 };                  // itens animados, índice máx. do atraso, duração da contagem
  const reduz = matchMedia("(prefers-reduced-motion: reduce)");
  const PANES = ".tab-conteudo,.dc-pane,.cv-pane,.fr-sub,#fr-proximas";           // painéis que aparecem/desaparecem
  const ALVOS = ".card,.stat-card,.cal-day,.fila-item,tbody>tr";                  // o que entra em cascata
  const CASCOS = ".card,.stat-card,.cal-day,.fila-item";                          // dentro destes: casco primeiro, conteúdo depois
  const FILHOS_PROPRIOS = ".stat-card,.cal-day,tbody>tr";                         // filhos que já animam sozinhos
  const NUM = ".stat-numero,#dc-dia,#mb-a,#mb-d,#mb-v";                           // números com contagem (#dc-mes já tem a sua)

  const visivel = (cls, el) => el.matches(".tab-conteudo") ? /(^|\s)ativo(\s|$)/.test(cls)
    : el.matches(".dc-pane,.cv-pane") ? /(^|\s)on(\s|$)/.test(cls) : !/(^|\s)hidden(\s|$)/.test(cls);
  const anim = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };

  // ---- cascata em duas fases (nunca em quem contém o campo em foco) ----
  function cascata(els) {
    let i = 0;
    els.filter(e => e.offsetParent !== null && !e.contains(document.activeElement)).slice(0, CFG.maxItens).forEach(e => {
      const idx = Math.min(i++, CFG.maxIndice); e.style.setProperty("--i", idx);
      if (e.matches(CASCOS)) {
        anim(e, "fx-shell");
        [...e.children].filter(c => !c.querySelector(FILHOS_PROPRIOS)).slice(0, 8).forEach(c => { c.style.setProperty("--i", idx); anim(c, "fx-focus"); });
      } else anim(e, "fx-focus");                                                  // linhas de tabela
    });
  }
  function revelar(pane) {
    if (reduz.matches) return;
    anim(pane, "fx-veil");
    cascata([...pane.querySelectorAll(ALVOS)]);
    pane.querySelectorAll(NUM).forEach(contagemEntrada);
  }
  function tabela(tb) {                                                            // 1ª carga de tabela vazia (as atualizações seguintes não animam)
    const n = tb.rows.length, antes = tb.__fxN || 0; tb.__fxN = n;
    if (!antes && n && !reduz.matches && tb.offsetParent !== null) cascata([...tb.rows]);
  }
  document.addEventListener("animationend", e => {                                 // devolve o elemento ao estado normal
    const t = e.target, n = e.animationName;
    if (n === "fxShell" || n === "fxFocus") { t.classList.remove(n === "fxShell" ? "fx-shell" : "fx-focus"); t.style.removeProperty("--i"); }
    else if (n === "fxVeil") t.classList.remove("fx-veil");
  }, true);

  // ---- contagem animada: mantém prefixo/sufixo/casas decimais ----
  function ler(txt) {
    const m = /^(\D*?)(-?\d[\d.]*(?:,\d+)?)(\D*)$/.exec(txt.trim()); if (!m) return null;
    const num = m[2], ponto = !num.includes(",") && /^-?\d+\.\d{1,2}$/.test(num);   // "12.5" = decimal; "1.234" = milhar
    const d = ponto ? num.split(".")[1].length : (num.split(",")[1] || "").length;
    return { p: m[1], s: m[3], d, ponto, v: ponto ? parseFloat(num) : parseFloat(num.replace(/\./g, "").replace(",", ".")) };
  }
  const estado = el => el.__fx || (el.__fx = { w: null, cur: null, raf: 0, final: null });
  function animar(alvo, de, novo, fim) {
    const st = estado(alvo), t0 = performance.now(); cancelAnimationFrame(st.raf); st.final = fim;
    const passo = t => {
      const p = Math.min(1, (t - t0) / CFG.contagemMs), v = de + (novo.v - de) * (1 - Math.pow(1 - p, 3));
      st.cur = v;
      st.w = p < 1 ? novo.p + (novo.ponto ? v.toFixed(novo.d) : v.toLocaleString("pt-BR", { minimumFractionDigits: novo.d, maximumFractionDigits: novo.d })) + novo.s : fim;
      alvo.textContent = st.w;
      if (p < 1) st.raf = requestAnimationFrame(passo); else { st.raf = 0; st.cur = novo.v; }
    };
    st.raf = requestAnimationFrame(passo);
  }
  function contagemEntrada(el) {                                                   // ao abrir uma tela: do zero até o valor
    if (el.offsetParent === null || reduz.matches) return;
    const st = estado(el), fim = st.raf && st.final ? st.final : el.textContent, n = ler(fim);
    if (n) animar(el, 0, n, fim);
  }
  function contar(node) {                                                          // quando o valor muda: do mostrado até o novo
    const el = node.nodeType === 1 ? node : node.parentElement; if (!el || !el.closest) return;
    const alvo = el.closest(NUM); if (!alvo) return;
    const st = estado(alvo), txt = alvo.textContent;
    if (txt === st.w) return;                                                      // foi a nossa própria escrita
    const novo = ler(txt); if (!novo || reduz.matches) { st.cur = novo ? novo.v : null; return; }
    const de = st.cur != null ? st.cur : 0; if (de !== novo.v) animar(alvo, de, novo, txt);
  }

  // ---- um único observador, filtrado: só painéis que ficaram visíveis, tbody e números ----
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === "attributes") {
        const el = m.target;
        if (el.matches && el.matches(PANES) && !visivel(m.oldValue || "", el) && visivel(el.className, el)) revelar(el);
      } else if (m.type === "childList" && m.target.tagName === "TBODY") tabela(m.target);
      if (m.type !== "attributes") contar(m.target);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true, childList: true, characterData: true });

  setTimeout(() => { const a = document.querySelector(".tab-conteudo.ativo"); if (a) revelar(a); }, 250);   // aba inicial
})();
