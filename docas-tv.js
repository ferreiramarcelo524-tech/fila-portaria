/* docas-tv.js — substitui o sync() da planilha no painel de exibição (TV) */
(function () {
  const db = firebase.firestore();
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const BRL = v => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const diaAtual = iso(new Date());
  let ativos = [], rDia = 0, rMes = 0;

  function pintar() {
    const a = ativos.reduce((s, x) => s + (+x.valor || 0), 0), dia = rDia + a, mes = rMes + a;
    updateRing("bDia", "pDia", "vDia", (dia / 809524) * 100, BRL(dia));
    updateRing("bMes", "pMes", "vMes", (mes / 17000000) * 100, BRL(mes));
    document.getElementById("meta-celebration").style.display = dia >= 1000000 ? "block" : "none";
    document.getElementById("corpoPedidos").innerHTML = ativos.filter(x => x.doca).map(x => {
      const s = String(x.tipo || "---").toUpperCase();
      const cls = s.includes("ABAST") ? "abastecimento" : s.includes("ELETRO") ? "eletro" : s.includes("MATEUS") ? "mateus-plus" : s.includes("TRANSF") ? "transferencia" : "default-setor";
      return `<tr><td><span class="badge ${cls}">${limpa(s)}</span></td><td>${limpa(x.filial) || "-"}</td>
        <td class="doca-col">${limpa(x.doca)}</td><td class="valor-col">${x.valor ? BRL(x.valor) : "sem pedido"}</td>
        <td>${limpa(x.veiculo) || "---"}</td></tr>`;
    }).join("") || "<tr><td colspan='5'>SEM CARREGAMENTOS</td></tr>";
  }

  db.collection("docas_carregamentos").onSnapshot(s => {
    ativos = s.docs.map(d => d.data()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    pintar();
  });
  db.doc("docas_resumo/dia_" + diaAtual).onSnapshot(d => { rDia = d.exists ? d.data().total || 0 : 0; pintar(); });
  db.doc("docas_resumo/mes_" + diaAtual.slice(0, 7)).onSnapshot(d => { rMes = d.exists ? d.data().total || 0 : 0; pintar(); });
  db.collection("cubagem_veiculos").onSnapshot(s => {
    s.forEach(d => { const x = d.data(); cubMap[normPlaca(x.placa)] = String(x.cubagem).replace(".", ",") + "m³"; });
    renderFila();
  });
  setInterval(() => { if (iso(new Date()) !== diaAtual) location.reload(); }, 60000);
})();
