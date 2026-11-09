/* docas.js — aba "Docas" do painel.html (substitui a planilha "Docas e carregamentos")
   Coleções: docas_carregamentos (ativos) | docas_historico (finalizados)
             docas_resumo (totais dia_/mes_) | cubagem_veiculos (placa -> cubagem) */
(function () {
  const db = firebase.firestore(), auth = firebase.auth(), F = firebase.firestore.FieldValue;
  const CAL = {
    1: "193:20,143:21,124:22,127:23,190:24,158:25,BARCARENA:12,ALTAMIRA:13,ELDORADO:15",
    2: "194:20,603:21,35:22,142:23,129:24,125:25,134:26,BELÉM / 194:12,CASTANHAL:13,TUCUMÃ:15,CANAÃ:17",
    3: "632:20,608:21,36:22,46:23,609:24,191:25,VIGIA:12,PARAGOM...:13,BRAGANÇA:15,CAPANEMA:17",
    4: "152:20,634:21,126:22,132:23,133:24,24:25,URUARÁ:12,BELÉM / 634:15",
    5: "129:20,CANAÃ:12"
  };
  const DIAS = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta" };
  const TIPOS = ["ABASTECIMENTO", "ELETRO", "MATEUS PLUS", "TRANSFERENCIA"];
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const BRL = v => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const norm = p => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const esc = t => String(t == null ? "" : t).replace(/[<>&"']/g, "");
  const admin = () => !!auth.currentUser;
  let ativos = [], placas = [], dataSel = iso(new Date());

  // ---- UI ----
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "tab-btn"; btn.id = "btn-tab-docas"; btn.textContent = "Docas";
  document.querySelector(".tabs").appendChild(btn);
  const sec = document.createElement("div");
  sec.id = "tab-docas"; sec.className = "tab-conteudo";
  sec.innerHTML = `
  <section class="card">
    <div class="card-header-flex"><h2>Docas e Carregamentos</h2>
      <div class="periodo-seletor">
        <input type="date" id="dc-data" class="input-data-especifica">
        ${Object.keys(DIAS).map(k => `<button class="periodo-btn" data-dia="${k}">${DIAS[k]}</button>`).join("")}
        <button class="btn-action btn-add" id="dc-add" style="margin:0">+ Linha</button>
        <button class="btn-action btn-cancel" id="dc-limpar" style="margin:0">Limpar</button>
      </div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-numero" id="dc-dia">-</div><div class="stat-label">Faturamento do dia</div></div>
      <div class="stat-card"><div class="stat-numero" id="dc-mes">-</div><div class="stat-label">Faturamento do mês</div></div>
    </div>
    <table><thead><tr><th>Tipo</th><th>Filial</th><th>Doca</th><th>Valor</th><th>Veículo</th><th>Data</th><th></th></tr></thead>
    <tbody id="dc-corpo"></tbody></table>
    <div id="dc-vazio" class="empty-msg">Nenhum carregamento. Use os botões de dia ou "+ Linha".</div>
    <datalist id="dc-placas"></datalist>
  </section>
  <section class="card"><h2>Cubagem dos Veículos</h2>
    <div class="periodo-seletor">
      <input class="input-busca" style="min-width:110px" id="cb-placa" placeholder="Placa AAA-0A00">
      <input class="input-busca" style="min-width:90px" id="cb-c" placeholder="Compr.">
      <input class="input-busca" style="min-width:90px" id="cb-a" placeholder="Altura">
      <input class="input-busca" style="min-width:90px" id="cb-l" placeholder="Largura">
      <button class="btn-action btn-add" id="cb-salvar" style="margin:0">Salvar</button>
    </div>
    <table style="margin-top:12px"><thead><tr><th>Placa</th><th>Cubagem m³</th><th>Pallets</th><th></th></tr></thead><tbody id="cb-corpo"></tbody></table>
  </section>`;
  document.querySelector(".container").appendChild(sec);
  const $ = id => document.getElementById(id);
  $("dc-data").value = dataSel;
  $("dc-data").onchange = e => { dataSel = e.target.value || dataSel; };

  const abrir = () => {
    document.querySelectorAll(".tab-conteudo").forEach(e => e.classList.remove("ativo"));
    document.querySelectorAll(".tab-btn").forEach(e => e.classList.remove("active"));
    sec.classList.add("ativo"); btn.classList.add("active");
  };
  btn.onclick = abrir;
  document.addEventListener("click", e => {
    const b = e.target.closest(".tab-btn");
    if (b && b !== btn) { sec.classList.remove("ativo"); btn.classList.remove("active"); }
  });

  // ---- Dados ----
  db.collection("docas_carregamentos").onSnapshot(s => {
    ativos = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    desenhar();
  });
  const mes = iso(new Date()).slice(0, 7);
  let rDia = 0, rMes = 0;
  const totais = () => {
    const a = ativos.reduce((s, x) => s + (+x.valor || 0), 0);
    $("dc-dia").textContent = BRL(rDia + a); $("dc-mes").textContent = BRL(rMes + a);
  };
  db.doc("docas_resumo/dia_" + iso(new Date())).onSnapshot(d => { rDia = d.exists ? d.data().total || 0 : 0; totais(); });
  db.doc("docas_resumo/mes_" + mes).onSnapshot(d => { rMes = d.exists ? d.data().total || 0 : 0; totais(); });
  db.collection("cubagem_veiculos").onSnapshot(s => {
    placas = s.docs.map(d => d.data()).sort((a, b) => a.placa.localeCompare(b.placa));
    $("dc-placas").innerHTML = placas.map(p => `<option value="${esc(p.placa)}">`).join("");
    $("cb-corpo").innerHTML = placas.map(p => `<tr><td><strong>${esc(p.placa)}</strong></td><td>${p.cubagem}</td><td>${p.pallets || "-"}</td>
      <td><button class="btn-action btn-cancel" data-delcb="${norm(p.placa)}">Excluir</button></td></tr>`).join("");
  });

  function desenhar() {
    totais();
    $("dc-vazio").style.display = ativos.length ? "none" : "block";
    $("dc-corpo").innerHTML = ativos.map(x => `<tr data-id="${x.id}">
      <td><select data-f="tipo">${TIPOS.map(t => `<option${t === x.tipo ? " selected" : ""}>${t}</option>`).join("")}</select></td>
      <td><input data-f="filial" value="${esc(x.filial)}" style="width:130px"></td>
      <td><input data-f="doca" value="${esc(x.doca)}" style="width:90px"></td>
      <td><input data-f="valor" value="${x.valor ? String(x.valor).replace(".", ",") : ""}" style="width:110px" placeholder="0,00"></td>
      <td><input data-f="veiculo" list="dc-placas" value="${esc(x.veiculo)}" style="width:100px"></td>
      <td>${esc((x.data || "").split("-").reverse().join("/"))}</td>
      <td><button class="btn-action btn-done" data-fin="${x.id}">Finalizar</button><button class="btn-action btn-cancel" data-del="${x.id}">✕</button></td></tr>`).join("");
  }

  // ---- Ações ----
  const bloq = () => { if (!admin()) { alert("Acesso negado! Faça o login de administrador primeiro."); return true; } };
  $("dc-corpo").addEventListener("change", e => {
    const f = e.target.dataset.f; if (!f || bloq()) return;
    let v = e.target.value.trim();
    if (f === "valor") v = parseFloat(v.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    if (f === "veiculo") v = v.toUpperCase();
    db.collection("docas_carregamentos").doc(e.target.closest("tr").dataset.id).update({ [f]: v }).catch(x => alert(x.message));
  });
  document.addEventListener("click", async e => {
    const t = e.target;
    if (t.dataset.fin) {
      if (bloq()) return;
      const x = ativos.find(a => a.id === t.dataset.fin); if (!x) return;
      const b = db.batch(), v = +x.valor || 0, d = x.data || iso(new Date());
      b.set(db.collection("docas_historico").doc(x.id), { ...x, finalizadoEm: Date.now() });
      b.delete(db.collection("docas_carregamentos").doc(x.id));
      if (v) {
        b.set(db.doc("docas_resumo/dia_" + d), { total: F.increment(v) }, { merge: true });
        b.set(db.doc("docas_resumo/mes_" + d.slice(0, 7)), { total: F.increment(v) }, { merge: true });
      }
      b.commit().catch(x => alert(x.message));
    }
    if (t.dataset.del && !bloq() && confirm("Excluir esta linha sem arquivar?"))
      db.collection("docas_carregamentos").doc(t.dataset.del).delete();
    if (t.dataset.delcb && !bloq()) db.collection("cubagem_veiculos").doc(t.dataset.delcb).delete();
    if (t.dataset.dia) {
      if (bloq()) return;
      if (ativos.length && !confirm("Substituir a lista atual pela de " + DIAS[t.dataset.dia] + "?")) return;
      const b = db.batch();
      ativos.forEach(a => b.delete(db.collection("docas_carregamentos").doc(a.id)));
      CAL[t.dataset.dia].split(",").forEach((it, i) => {
        const [n, doca] = it.split(":"), loja = /^\d+$/.test(n);
        b.set(db.collection("docas_carregamentos").doc(), {
          tipo: loja ? "ABASTECIMENTO" : "ELETRO", filial: loja ? "LOJA " + n : n, doca: "DOCA " + doca,
          valor: 0, veiculo: "", data: dataSel, ordem: i + 1
        });
      });
      b.commit().catch(x => alert(x.message));
    }
  });
  $("dc-add").onclick = () => {
    if (bloq()) return;
    db.collection("docas_carregamentos").add({ tipo: "ABASTECIMENTO", filial: "", doca: "", valor: 0, veiculo: "", data: dataSel, ordem: Date.now() });
  };
  $("dc-limpar").onclick = () => {
    if (bloq() || !confirm("Apagar TODAS as linhas ativas (sem arquivar)?")) return;
    const b = db.batch(); ativos.forEach(a => b.delete(db.collection("docas_carregamentos").doc(a.id))); b.commit();
  };
  $("cb-salvar").onclick = () => {
    if (bloq()) return;
    const p = $("cb-placa").value.trim().toUpperCase(), n = id => parseFloat($(id).value.replace(",", "."));
    const c = n("cb-c"), a = n("cb-a"), l = n("cb-l");
    if (!/^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/.test(p) || !(c && a && l)) { alert("Informe placa válida e as 3 medidas."); return; }
    const pl = norm(p), placa = pl.slice(0, 3) + "-" + pl.slice(3);
    db.collection("cubagem_veiculos").doc(pl).set({ placa, cubagem: +(c * a * l).toFixed(3), pallets: Math.floor(c / 1.2) * 2 })
      .then(() => ["cb-placa", "cb-c", "cb-a", "cb-l"].forEach(i => $(i).value = ""));
  };
})();
