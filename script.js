import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "1235";

// Inicialização da Data
document.getElementById("data-display").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");
const flashText = document.getElementById("flash-text");
const inputResponsavel = document.getElementById("responsavel-relatorio");

// Sincronizar o Responsável pelo Relatório salvo no Firestore
const relatorioRef = doc(db, "config", "responsavel_relatorio");
onSnapshot(relatorioRef, (docSnap) => {
    if (docSnap.exists()) {
        inputResponsavel.value = docSnap.data().nome || "";
    }
});

// Flash Report
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (docSnap) => { if (docSnap.exists()) flashText.value = docSnap.data().conteudo || ""; });
flashText.addEventListener("input", async (e) => { await setDoc(flashRef, { conteudo: e.target.value }); });

// Renderização Escala
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const turnoAtual = d.turno || "manha";
        const colunas = turnoAtual === "madrugada" ? ['pixbet', 'bds', 'discord', 'ganhei'] : ['pixbet', 'bds', 'discord', 'ganhei', 'suporte'];
        
        let listaBruta = [d.original_pixbet, d.original_bds, d.original_discord, d.original_ganhei, d.original_suporte];
        let colabsIndividuais = [];
        listaBruta.forEach(item => {
            if (item && item.trim() !== "" && item !== "TODOS" && item !== "N/A") {
                item.split(',').forEach(nome => {
                    let nomeLimpo = nome.trim();
                    if (nomeLimpo) colabsIndividuais.push(nomeLimpo);
                });
            }
        });
        const colabsUnicos = [...new Set(colabsIndividuais)];
        
        let linhaHTML = `<tr><td class="text-bold">${d.horario}</td>`;
        colunas.forEach(col => {
            const statusCheck = d[`checkin_${col}`] === 'OK' ? '#28a745' : '#1a2533';
            let valorExibido = d[col] || "";
            let acaoClick = (col === 'discord' && valorExibido === "TODOS") || valorExibido === "N/A" || valorExibido === "" ? "" : `onclick="window.checkin('${docSnap.id}', '${col}')"`;
            let estiloCursor = (col === 'discord' && valorExibido === "TODOS") || valorExibido === "N/A" || valorExibido === "" ? "cursor: default;" : "";
            
            linhaHTML += `<td><button class="btn-nome-checkin" ${acaoClick} style="background:${statusCheck}; ${estiloCursor}">${valorExibido}</button></td>`;
        });

        let statusTexto = d.status || 'Online';
        let corStatus = statusTexto.startsWith("Online") ? "#28a745" : "#dc3545";

        linhaHTML += `<td>
            <div class="dropdown">
                <button class="status-btn" style="background:${corStatus}">${statusTexto}</button>
                <div class="dropdown-content">
                    <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Online')">✅ Normal / Retorno Total</a>
                    ${colabsUnicos.map(n => `<a href="#" onclick="event.preventDefault(); window.alternarPausa('${docSnap.id}', '${n}')">⏸️ Pausar / Retornar: ${n}</a>`).join('')}
                </div>
            </div>
        </td></tr>`;
        tbody.innerHTML += linhaHTML;
    });
});

// Botão Girar Rodízio
document.getElementById("btn-girar").addEventListener("click", async () => {
    const turno = document.getElementById("select-turno").value;
    const horaInicio = turno === "manha" ? 7 : (turno === "noite" ? 15 : 23);
    
    const inputs = [];
    for(let i=1; i<=7; i++) inputs.push(document.getElementById(`c${i}`).value);
    const colabs = inputs.filter(n => n && n.trim() !== "");
    const p = colabs.length;
    
    if (p === 0) { alert("Preencha pelo menos um colaborador!"); return; }

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const logRef = doc(db, "config", "sorteio_log");
    const logSnap = await getDoc(logRef);
    let dadosLog = logSnap.exists() && logSnap.data().data === dataHoje ? logSnap.data() : { data: dataHoje, contagem: 0 };

    if (dadosLog.contagem >= 2) {
        const senha = prompt("Sorteio limitado (2x/dia). Digite a senha:");
        if (senha !== SENHA_ADMIN) { alert("Acesso negado."); return; }
    }

    // Sorteio Justo do Relatório
    const historicoRelatorioSnap = await getDoc(relatorioRef);
    let ultimoResponsavel = historicoRelatorioSnap.exists() ? historicoRelatorioSnap.data().nome : "";

    let candidatosElegiveis = colabs.filter(n => n !== ultimoResponsavel);
    if (candidatosElegiveis.length === 0) {
        candidatosElegiveis = colabs;
    }

    let responsavelSorteado = candidatosElegiveis[Math.floor(Math.random() * candidatosElegiveis.length)];
    await setDoc(relatorioRef, { nome: responsavelSorteado, data: dataHoje });
    inputResponsavel.value = responsavelSorteado;

    const snaps = await getDocs(collection(db, "escala_ativa"));
    for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    
    for (let i = 0; i < 8; i++) {
        let hora = (horaInicio + i) % 24;
        let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
        let escala = { ordem: i, horario: horarioFormatado, status: "Online", data_registro: dataHoje, turno: turno };

        let pixbetVal, bdsVal, ganheiVal, discordVal, suporteVal = "N/A";

        if (turno === "madrugada") {
            // Lógica original rigorosa da madrugada mantida intacta
            pixbetVal = colabs[i % p];
            bdsVal = colabs[(i + 1) % p];
            discordVal = "TODOS";
            ganheiVal = colabs[(i + 2) % p];
        } else {
            let pixIndex = i % p;
            let bdsIndex = (i + 1) % p;
            if (p > 1 && pixIndex === bdsIndex) bdsIndex = (bdsIndex + 1) % p;

            let discordIndex = (i + 2) % p;
            let ganheiIndex = (i + 3) % p;

            pixbetVal = colabs[pixIndex];
            bdsVal = colabs[bdsIndex];
            ganheiVal = colabs[ganheiIndex];
            discordVal = colabs[discordIndex];

            if (p === 6) {
                let supIndex1 = (i + 4) % p;
                let supIndex2 = (i + 5) % p;
                suporteVal = `${colabs[supIndex1]}, ${colabs[supIndex2]}`;
            } else if (p > 6) {
                let supIndex = (i + 4) % p;
                suporteVal = colabs[supIndex];
            }
        }

        escala = { 
            ...escala, 
            pixbet: pixbetVal, 
            bds: bdsVal, 
            discord: discordVal, 
            ganhei: ganheiVal, 
            suporte: suporteVal,
            original_pixbet: pixbetVal, 
            original_bds: bdsVal, 
            original_discord: discordVal, 
            original_ganhei: ganheiVal,
            original_suporte: suporteVal,
            pausados: []
        };

        await setDoc(doc(db, "escala_ativa", `turno_${i}`), escala);
    }
    
    dadosLog.contagem += 1;
    await setDoc(logRef, dadosLog);
    alert(`Escala gerada e relatório atribuído a ${responsavelSorteado}!`);
});

// Botão Limpar Escala
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja realmente apagar toda a escala atual?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        alert("Escala limpa com sucesso!");
    }
});

// Funções Globais
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if ((col === 'discord' && d.discord === "TODOS") || d[col] === "N/A" || !d[col]) return;
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if (valor === "Online") { 
        await updateDoc(docRef, { 
            pixbet: d.original_pixbet, 
            bds: d.original_bds, 
            discord: d.original_discord, 
            ganhei: d.original_ganhei, 
            suporte: d.original_suporte,
            pausados: [],
            status: "Online" 
        }); 
    }
};

// Gerenciamento de Pausas Individuais com Redistribuição Correta para Múltiplas Pausas
window.alternarPausa = async (id, colaborador) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    
    let pausadosAtuais = d.pausados || [];
    
    if (pausadosAtuais.includes(colaborador)) {
        pausadosAtuais = pausadosAtuais.filter(n => n !== colaborador);
    } else {
        pausadosAtuais.push(colaborador);
    }

    let listaBruta = [d.original_pixbet, d.original_bds, d.original_ganhei];
    if (d.turno === "madrugada") {
        listaBruta.push(d.original_ganhei);
    } else {
        if (d.original_suporte && d.original_suporte !== "N/A") {
            d.original_suporte.split(',').forEach(s => listaBruta.push(s.trim()));
        }
        if (d.original_discord && d.original_discord !== "TODOS") {
            listaBruta.push(d.original_discord);
        }
    }
    const unicosOriginais = [...new Set(listaBruta.filter(n => n && n.trim() !== "" && n !== "TODOS" && n !== "N/A"))];

    const ativos = unicosOriginais.filter(n => !pausadosAtuais.includes(n));
    const qtdAtivos = ativos.length;

    let novaEscala = {};
    if (d.turno === "madrugada") {
        if (qtdAtivos === 0) {
            novaEscala = { pixbet: "Pausa", bds: "Pausa", ganhei: "Pausa" };
        } else if (qtdAtivos === 1) {
            novaEscala = { pixbet: ativos[0], bds: ativos[0], ganhei: ativos[0] };
        } else {
            novaEscala = {
                pixbet: ativos[0 % qtdAtivos],
                bds: ativos[1 % qtdAtivos],
                ganhei: ativos[2 % qtdAtivos]
            };
        }
        novaEscala.discord = "TODOS";
    } else {
        if (qtdAtivos === 0) {
            novaEscala = { pixbet: "Pausa", bds: "Pausa", ganhei: "Pausa", suporte: "Pausa", discord: "Pausa" };
        } else if (qtdAtivos === 1) {
            novaEscala = { pixbet: ativos[0], bds: ativos[0], ganhei: ativos[0], suporte: ativos[0], discord: ativos[0] };
        } else {
            let pIdx = 0;
            let bIdx = 1 % qtdAtivos;
            if (pIdx === bIdx && qtdAtivos > 1) bIdx = 1;
            let gIdx = 2 % qtdAtivos;
            let dIdx = 3 % qtdAtivos;
            let sIdx = 4 % qtdAtivos;
            
            novaEscala = {
                pixbet: ativos[pIdx],
                bds: ativos[bIdx],
                ganhei: ativos[gIdx],
                discord: ativos[dIdx],
                suporte: qtdAtivos >= 5 ? ativos[sIdx] : "N/A"
            };
        }
    }

    let statusTexto = pausadosAtuais.length > 0 ? "Pausa: " + pausadosAtuais.join(", ") : "Online";

    await updateDoc(docRef, {
        ...novaEscala,
        pausados: pausadosAtuais,
        status: statusTexto
    });
};
