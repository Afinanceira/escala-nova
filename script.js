import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "253017";

// Inicialização da Data
const dataDisplay = document.getElementById("data-display");
if (dataDisplay) {
    dataDisplay.innerText = new Date().toLocaleDateString('pt-BR');
}

const tbody = document.getElementById("escala-body");
const theadTr = document.querySelector(".grade-table thead tr") || document.querySelector("thead tr");
const flashText = document.getElementById("flash-text");
const inputResponsavel = document.getElementById("responsavel-relatorio");

// Sincronizar o Responsável pelo Relatório salvo no Firestore
onSnapshot(doc(db, "config", "responsavel_relatorio"), (docSnap) => {
    if (docSnap.exists() && inputResponsavel) {
        inputResponsavel.value = docSnap.data().nome || "";
    }
});

// Flash Report
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (docSnap) => { 
    if (docSnap.exists() && flashText) { 
        flashText.value = docSnap.data().conteudo || ""; 
    } 
});

if (flashText) {
    flashText.addEventListener("input", async (e) => { 
        await setDoc(flashRef, { conteudo: e.target.value }); 
    });
}

// Renderização da Escala com colunas fixas e cabeçalho dinâmico para o Suporte
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    if (!tbody) return;
    tbody.innerHTML = "";
    
    let temSuporteNaEscala = false;
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.suporte && d.suporte !== "N/A" && d.turno !== "madrugada") {
            temSuporteNaEscala = true;
        }
    });

    if (theadTr) {
        theadTr.innerHTML = `
            <th>HORÁRIO</th>
            <th>PIXBET</th>
            <th>BDS</th>
            <th>DISCORD</th>
            <th>GANHEI</th>
            ${temSuporteNaEscala ? '<th>SUPORTE</th>' : ''}
            <th>STATUS</th>
        `;
    }

    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const turnoAtual = d.turno || "manha";
        const isMadrugada = turnoAtual === "madrugada";
        const exibeSuporteLinha = !isMadrugada && d.suporte && d.suporte !== "N/A";
        
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
        
        const renderBotao = (colName, val) => {
            const statusCheck = d[`checkin_${colName}`] === 'OK' ? '#28a745' : '#1a2533';
            let valorExibido = val || "";
            let acaoClick = (colName === 'discord' && valorExibido === "TODOS") || valorExibido === "N/A" || valorExibido === "" ? "" : `onclick="window.checkin('${docSnap.id}', '${colName}')"`;
            let estiloCursor = (colName === 'discord' && valorExibido === "TODOS") || valorExibido === "N/A" || valorExibido === "" ? "cursor: default;" : "";
            return `<td><button class="btn-nome-checkin" ${acaoClick} style="background:${statusCheck}; ${estiloCursor}">${valorExibido}</button></td>`;
        };

        linhaHTML += renderBotao('pixbet', d.pixbet);
        linhaHTML += renderBotao('bds', d.bds);
        linhaHTML += renderBotao('discord', d.discord);
        linhaHTML += renderBotao('ganhei', d.ganhei);
        
        if (exibeSuporteLinha) {
            linhaHTML += renderBotao('suporte', d.suporte);
        }

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
const btnGirar = document.getElementById("btn-girar");
if (btnGirar) {
    btnGirar.addEventListener("click", async () => {
        const selectTurno = document.getElementById("select-turno");
        const turno = selectTurno ? selectTurno.value : "manha";
        const horaInicio = turno === "manha" ? 7 : (turno === "noite" ? 15 : 23);
        
        const inputs = [];
        for(let i=1; i<=7; i++) {
            const inputEl = document.getElementById(`c${i}`);
            if (inputEl && inputEl.value) inputs.push(inputEl.value);
        }
        const colabs = inputs.filter(n => n && n.trim() !== "");
        const p = colabs.length;
        
        if (p === 0) { alert("Preencha pelo menos um colaborador nos campos c1 a c7!"); return; }

        const dataHoje = new Date().toLocaleDateString('pt-BR');
        const logRef = doc(db, "config", "sorteio_log");
        const logSnap = await getDoc(logRef);
        let dadosLog = logSnap.exists() && logSnap.data().data === dataHoje ? logSnap.data() : { data: dataHoje, contagem: 0 };

        if (dadosLog.contagem >= 2) {
            const senha = prompt("Sorteio limitado (2x/dia). Digite a senha:");
            if (senha !== SENHA_ADMIN) { alert("Acesso negado."); return; }
        }

        const historicoRelatorioSnap = await getDoc(relatorioRef);
        let ultimoResponsavel = historicoRelatorioSnap.exists() ? historicoRelatorioSnap.data().nome : "";

        let candidatosElegiveis = colabs.filter(n => n !== ultimoResponsavel);
        if (candidatosElegiveis.length === 0) {
            candidatosElegiveis = colabs;
        }

        let responsavelSorteado = candidatosElegiveis[Math.floor(Math.random() * candidatosElegiveis.length)];
        await setDoc(relatorioRef, { nome: responsavelSorteado, data: dataHoje });
        if (inputResponsavel) inputResponsavel.value = responsavelSorteado;

        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        
        let totalVezesSuporte = {};
        colabs.forEach(c => totalVezesSuporte[c] = 0);
        let suporteHoraAnterior = [];

        for (let i = 0; i < 8; i++) {
            let hora = (horaInicio + i) % 24;
            let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
            let escala = { ordem: i, horario: horarioFormatado, status: "Online", data_registro: dataHoje, turno: turno };

            let pixbetVal, bdsVal, ganheiVal, discordVal, suporteVal = "N/A";

            if (turno === "madrugada") {
                pixbetVal = colabs[i % p];
                bdsVal = colabs[(i + 1) % p];
                discordVal = "TODOS";
                ganheiVal = colabs[(i + 2) % p];
            } else {
                if (p >= 5) {
                    let qtdSuporteNecessaria = p - 4;
                    
                    let candidatosOrdenados = [...colabs].sort((a, b) => {
                        let aFezAntes = suporteHoraAnterior.includes(a) ? 1 : 0;
                        let bFezAntes = suporteHoraAnterior.includes(b) ? 1 : 0;
                        if (aFezAntes !== bFezAntes) return aFezAntes - bFezAntes;
                        return totalVezesSuporte[a] - totalVezesSuporte[b];
                    });

                    let suporteSelecionados = candidatosOrdenados.slice(0, qtdSuporteNecessaria);
                    suporteVal = suporteSelecionados.join(", ");
                    suporteHoraAnterior = suporteSelecionados;
                    suporteSelecionados.forEach(c => totalVezesSuporte[c]++);

                    let disponiveisCasas = colabs.filter(n => !suporteSelecionados.includes(n));
                    let offset = i % disponiveisCasas.length;
                    pixbetVal = disponiveisCasas[offset % disponiveisCasas.length];
                    bdsVal = disponiveisCasas[(offset + 1) % disponiveisCasas.length];
                    discordVal = disponiveisCasas[(offset + 2) % disponiveisCasas.length];
                    ganheiVal = disponiveisCasas[(offset + 3) % disponiveisCasas.length];
                } else {
                    let offset = i % p;
                    pixbetVal = colabs[offset % p];
                    bdsVal = colabs[(offset + 1) % p];
                    discordVal = colabs[(offset + 2) % p];
                    ganheiVal = colabs[(offset + 3) % p];
                    suporteVal = "N/A";
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
}

// Botão Limpar Escala
const btnLimpar = document.getElementById("btn-limpar");
if (btnLimpar) {
    btnLimpar.addEventListener("click", async () => {
        if (confirm("Deseja realmente apagar toda a escala atual?")) {
            const snaps = await getDocs(collection(db, "escala_ativa"));
            for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
            alert("Escala limpa com sucesso!");
        }
    });
}

// Funções Globais
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const d = snap.data();
    if ((col === 'discord' && d.discord === "TODOS") || d[col] === "N/A" || !d[col]) return;
    const campoCheck = `checkin_${col}`;
    const atual = d[campoCheck] === 'OK' ? 'Pendente' : 'OK';
    await updateDoc(docRef, { [campoCheck]: atual });
};

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const d = snap.data();
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

// Gerenciamento de Pausas
window.alternarPausa = async (id, colaborador) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const d = snap.data();
    
    let pausadosAtuais = d.pausados || [];
    
    if (pausadosAtuais.includes(colaborador)) {
        pausadosAtuais = pausadosAtuais.filter(n => n !== colaborador);
    } else {
        pausadosAtuais.push(colaborador);
    }

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
    const unicosOriginais = [...new Set(colabsIndividuais)];

    const ativos = unicosOriginais.filter(n => !pausadosAtuais.includes(n));
    const qtdAtivos = ativos.length;

    let novaEscala = {};
    if (d.turno === "madrugada") {
        if (qtdAtivos === 0) {
            novaEscala = { pixbet: "Pausa", bds: "Pausa", ganhei: "Pausa", discord: "TODOS", suporte: "N/A" };
        } else if (qtdAtivos === 1) {
            novaEscala = { pixbet: ativos[0], bds: ativos[0], ganhei: ativos[0], discord: "TODOS", suporte: "N/A" };
        } else {
            novaEscala = {
                pixbet: ativos[0 % qtdAtivos],
                bds: ativos[1 % qtdAtivos],
                ganhei: ativos[2 % qtdAtivos],
                discord: "TODOS",
                suporte: "N/A"
            };
        }
    } else {
        if (qtdAtivos === 1) {
            novaEscala = {
                pixbet: ativos[0],
                bds: ativos[0],
                discord: ativos[0],
                ganhei: ativos[0],
                suporte: "N/A"
            };
        } else if (qtdAtivos === 2) {
            novaEscala = {
                pixbet: ativos[0],
                bds: ativos[1],
                discord: ativos[0],
                ganhei: ativos[1],
                suporte: "N/A"
            };
        } else if (qtdAtivos === 3) {
            novaEscala = {
                pixbet: ativos[0],
                bds: ativos[1],
                discord: ativos[2],
                ganhei: ativos[0],
                suporte: "N/A"
            };
        } else if (qtdAtivos === 4) {
            novaEscala = {
                pixbet: ativos[0],
                bds: ativos[1],
                discord: ativos[2],
                ganhei: ativos[3],
                suporte: "N/A"
            };
        } else {
            let suporteAtivos = ativos.slice(4);
            let casaAtivos = ativos.slice(0, 4);

            novaEscala = {
                pixbet: casaAtivos[0],
                bds: casaAtivos[1],
                discord: casaAtivos[2],
                ganhei: casaAtivos[3],
                suporte: suporteAtivos.join(", ")
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
