import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "1235";

// Inicialização da Data
document.getElementById("data-display").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");
const theadTr = document.querySelector(".grade-table thead tr") || document.querySelector("thead tr");
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

// Renderização da Escala com colunas fixas e cabeçalho dinâmico para o Suporte
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
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

        // Permite selecionar MÚLTIPLAS pessoas para pausa simultaneamente no menu de status
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

// Botão Girar Rodízio com balanceamento estrito, evitando excesso de suporte contínuo e exclusão rigorosa das 4 casas
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
    
    // Controle para limitar o suporte consecutivo e garantir revezamento justo
    let historicoSuportePorColab = {};
    colabs.forEach(c => historicoSuportePorColab[c] = 0);

    for (let i = 0; i < 8; i++) {
        let hora = (horaInicio + i) % 24;
        let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
        let escala = { ordem: i, horario: horarioFormatado, status: "Online", data_registro: dataHoje, turno: turno };

        let pixbetVal, bdsVal, ganheiVal, discordVal, suporteVal = "N/A";

        if (turno === "madrugada") {
            // Madrugada: 3 casas + Discord fixo (TODOS), sem suporte
            pixbetVal = colabs[i % p];
            bdsVal = colabs[(i + 1) % p];
            discordVal = "TODOS";
            ganheiVal = colabs[(i + 2) % p];
        } else {
            // Turnos normais: Rodízio pelas 4 casas principais de forma justa
            let pixIndex = i % p;
            let bdsIndex = (i + 1) % p;
            if (p > 1 && pixIndex === bdsIndex) bdsIndex = (bdsIndex + 1) % p;

            let discordIndex = (i + 2) % p;
            let ganheiIndex = (i + 3) % p;

            pixbetVal = colabs[pixIndex];
            bdsVal = colabs[bdsIndex];
            ganheiVal = colabs[ganheiIndex];
            discordVal = colabs[discordIndex];

            // Regra de Suporte: Apenas quem NÃO está nas 4 casas principais pode ir para o suporte
            if (p >= 5) {
                let alocadosNasQuatro = [pixbetVal, bdsVal, discordVal, ganheiVal];
                let disponiveisParaSuporte = colabs.filter(n => !alocadosNasQuatro.includes(n));

                if (disponiveisParaSuporte.length > 0) {
                    // Ordena os disponíveis priorizando quem menos ficou no suporte para evitar estresse/fadiga de 3h seguidas
                    disponiveisParaSuporte.sort((a, b) => (historicoSuportePorColab[a] || 0) - (historicoSuportePorColab[b] || 0));

                    let qtdSuporteNecessaria = p === 6 ? 1 : (p >= 7 ? Math.min(2, disponiveisParaSuporte.length) : 1);
                    let suporteSelecionados = disponiveisParaSuporte.slice(0, qtdSuporteNecessaria);

                    suporteSelecionados.forEach(c => {
                        historicoSuportePorColab[c] = (historicoSuportePorColab[c] || 0) + 1;
                    });

                    suporteVal = suporteSelecionados.join(", ");
                } else {
                    suporteVal = "N/A";
                }
            } else {
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

// Gerenciamento de Pausas Individuais ou Múltiplas (suporta mais de 3 pessoas em pausa simultânea) com redistribuição dinâmica
window.alternarPausa = async (id, colaborador) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    
    let pausadosAtuais = d.pausados || [];
    
    // Permite adicionar ou remover pausas de forma totalmente individual
    if (pausadosAtuais.includes(colaborador)) {
        pausadosAtuais = pausadosAtuais.filter(n => n !== colaborador);
    } else {
        pausadosAtuais.push(colaborador);
    }

    // Coleta todos os colaboradores originais do turno
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

    // Separa quem está ativo de quem foi para a pausa (mesmo que sejam 1, 2, 3 ou mais pessoas)
    const ativos = unicosOriginais.filter(n => !pausadosAtuais.includes(n));
    const qtdAtivos = ativos.length;
    const temSuporteOriginal = d.original_suporte && d.original_suporte !== "N/A";

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
            novaEscala = { pixbet: "Pausa", bds: "Pausa", ganhei: "Pausa", discord: "Pausa", suporte: temSuporteOriginal ? "Pausa" : "N/A" };
        } else if (qtdAtivos === 1) {
            novaEscala = { pixbet: ativos[0], bds: ativos[0], ganhei: ativos[0], discord: ativos[0], suporte: temSuporteOriginal ? ativos[0] : "N/A" };
        } else {
            // Redistribuição dinâmica baseada estritamente nos ativos restantes
            let pIdx = 0;
            let bIdx = 1 % qtdAtivos;
            if (pIdx === bIdx && qtdAtivos > 1) bIdx = 1;
            let gIdx = 2 % qtdAtivos;
            let dIdx = 3 % qtdAtivos;
            
            let alocadosNasQuatro = [ativos[pIdx], ativos[bIdx], ativos[gIdx], ativos[dIdx]];
            let disponiveisParaSuporte = ativos.filter(n => !alocadosNasQuatro.includes(n));

            novaEscala = {
                pixbet: ativos[pIdx],
                bds: ativos[bIdx],
                ganhei: ativos[gIdx],
                discord: ativos[dIdx],
                suporte: (temSuporteOriginal && qtdAtivos >= 5 && disponiveisParaSuporte.length > 0) ? disponiveisParaSuporte.join(", ") : "N/A"
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
