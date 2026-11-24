/* Efeitos: cascata + brilho ao trocar de aba, entrada de linhas e contagem animada. Só adiciona classes/estilos; não toca em dados, formulários ou listeners existentes. */
(function () {
  "use strict";
  const CFG = { maxItens: 18, maxIndice: 12, contagemMs: 650 };               // limite de itens animados, índice máx. do atraso, duração da contagem
  const reduz = matchMedia("(prefers-reduced-motion: reduce)");
  const PANES = ".tab-conteudo,.dc-pane,.cv-pane,.fr-sub,#fr-proximas";        // painéis que aparecem/desaparecem
  const ALVOS = ".card,.stat-card,.cal-day,.fila-item,tbody>tr";               // o que entra em cascata
  const NUM = ".stat-numero,#dc-dia,#mb-a,#mb-d,#mb-v";                        // números com contagem animada (#dc-mes já tem a sua)

  const visivel = (cls, el) => el.matches(".tab-conteudo") ? /(^|\s)ativo(\s|$)/.test(cls)
    : el.matches(".dc-pane,.cv-pane") ? /(^|\s)on(\s|$)/.test(cls) : !/(^|\s)hidden(\s|$)/.test(cls);

  // ---- cascata: translateY + opacity com atraso por índice (nunca em quem está em edição) ----
  function cascata(els) {
    let i = 0;
    els.filter(e => e.offsetParent !== null && !e.contains(document.activeElement)).slice(0, CFG.maxItens).forEach(e => {
      e.style.setProperty("--i", Math.min(i++, CFG.maxIndice));
      e.classList.remove("fx-in"); void e.offsetWidth; e.classList.add("fx-in");
    });
  }
  // ---- troca de aba/sub-aba: brilho de vidro + cascata ----
  function revelar(pane) {
    if (reduz.matches) return;
    pane.classList.remove("fx-shine"); void pane.offsetWidth; pane.classList.add("fx-shine");
    cascata([...pane.querySelectorAll(ALVOS)]);
  }
  // ---- primeira carga de uma tabela vazia: linhas entram em cascata (atualizações seguintes não animam) ----
  function tabela(tb) {
    const n = tb.rows.length, antes = tb.__fxN || 0; tb.__fxN = n;
    if (!antes && n && !reduz.matches && tb.offsetParent !== null) cascata([...tb.rows]);
  }
  // limpeza ao fim das animações (devolve o elemento ao estado normal)
  document.addEventListener("animationend", e => {
    const t = e.target;
    if (e.animationName === "fxIn") { t.classList.remove("fx-in"); t.style.removeProperty("--i"); }
    else if (e.animationName === "fxShine") t.classList.remove("fx-shine");
  }, true);

  // ---- contagem animada: do valor mostrado até o novo, mantendo prefixo/sufixo/casas decimais ----
  function ler(txt) {
    const m = /^(\D*?)(-?\d[\d.]*(?:,\d+)?)(\D*)$/.exec(txt.trim()); if (!m) return null;
    const num = m[2], ponto = !num.includes(",") && /^-?\d+\.\d{1,2}$/.test(num);   // "12.5" = decimal com ponto; "1.234" = milhar
    const d = ponto ? num.split(".")[1].length : (num.split(",")[1] || "").length;
    return { p: m[1], s: m[3], d, ponto, v: ponto ? parseFloat(num) : parseFloat(num.replace(/\./g, "").replace(",", ".")) };
  }
  function contar(node) {
    const el = node.nodeType === 1 ? node : node.parentElement; if (!el || !el.closest) return;
    const alvo = el.closest(NUM); if (!alvo) return;
    const st = alvo.__fx || (alvo.__fx = { w: null, cur: null, raf: 0 }), txt = alvo.textContent;
    if (txt === st.w) return;                                   // foi a nossa própria escrita
    const novo = ler(txt); if (!novo || reduz.matches) { st.cur = novo ? novo.v : null; return; }
    const de = st.cur != null ? st.cur : 0; if (de === novo.v) return;
    cancelAnimationFrame(st.raf);
    const t0 = performance.now(), fim = txt;
    const passo = t => {
      const p = Math.min(1, (t - t0) / CFG.contagemMs), v = de + (novo.v - de) * (1 - Math.pow(1 - p, 3));
      st.cur = v;
      st.w = p < 1 ? novo.p + (novo.ponto ? v.toFixed(novo.d) : v.toLocaleString("pt-BR", { minimumFractionDigits: novo.d, maximumFractionDigits: novo.d })) + novo.s : fim;
      alvo.textContent = st.w;
      if (p < 1) st.raf = requestAnimationFrame(passo); else st.cur = novo.v;
    };
    st.raf = requestAnimationFrame(passo);
  }

  // ---- um único observador, filtrado: só reage a painéis que ficaram visíveis, tbody e números ----
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
