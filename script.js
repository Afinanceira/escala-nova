import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc, getDoc as getFirestoreDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "1234";

// Inicialização da Data
document.getElementById("data-display").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");
const flashText = document.getElementById("flash-text");

// Flash Report
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (doc) => { if (doc.exists()) flashText.value = doc.data().conteudo || ""; });
flashText.addEventListener("input", async (e) => { await setDoc(flashRef, { conteudo: e.target.value }); });

// Renderização Escala com suporte a Pausas Múltiplas
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const colunas = ['pixbet', 'bds', 'discord', 'ganhei'];
        
        const colabsOriginais = [d.original_pixbet, d.original_bds, d.original_discord, d.original_ganhei].filter(n => n && n.trim() !== "" && n !== "TODOS");
        const colabsUnicos = [...new Set(colabsOriginais)];import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc, getDoc as getFirestoreDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "1234";

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
onSnapshot(flashRef, (doc) => { if (doc.exists()) flashText.value = doc.data().conteudo || ""; });
flashText.addEventListener("input", async (e) => { await setDoc(flashRef, { conteudo: e.target.value }); });

// Renderização Escala com suporte a Pausas Múltiplas e Realocação
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const colunas = ['pixbet', 'bds', 'discord', 'ganhei'];
        
        const colabsOriginais = [d.original_pixbet, d.original_bds, d.original_discord, d.original_ganhei].filter(n => n && n.trim() !== "" && n !== "TODOS");
        const colabsUnicos = [...new Set(colabsOriginais)];
        
        let linhaHTML = `<tr><td class="text-bold">${d.horario}</td>`;
        colunas.forEach(col => {
            const statusCheck = d[`checkin_${col}`] === 'OK' ? '#28a745' : '#1a2533';
            let valorExibido = d[col] || "";
            let acaoClick = col === 'discord' && valorExibido === "TODOS" ? "" : `onclick="window.checkin('${docSnap.id}', '${col}')"`;
            let estiloCursor = col === 'discord' && valorExibido === "TODOS" ? "cursor: default;" : "";
            
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

// Botão Girar (Gerando escala + Sorteio do Relatório com regra anti-repetição consecutiva)
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
    const logSnap = await getFirestoreDoc(logRef);
    let dadosLog = logSnap.exists() && logSnap.data().data === dataHoje ? logSnap.data() : { data: dataHoje, contagem: 0 };

    if (dadosLog.contagem >= 2) {
        const senha = prompt("Sorteio limitado (2x/dia). Digite a senha:");
        if (senha !== SENHA_ADMIN) { alert("Acesso negado."); return; }
    }

    // --- SORTEIO JUSTO DO RELATÓRIO (Evitando repetição do dia anterior) ---
    const historicoRelatorioSnap = await getFirestoreDoc(relatorioRef);
    let ultimoResponsavel = historicoRelatorioSnap.exists() ? historicoRelatorioSnap.data().nome : "";

    // Filtra colaboradores disponíveis excluindo quem fez ontem (se houver mais de 1 opção)
    let candidatosElegiveis = colabs.filter(n => n !== ultimoResponsavel);
    if (candidatosElegiveis.length === 0) {
        candidatosElegiveis = colabs; // Caso extremo onde só há 1 pessoa cadastrada
    }

    // Sorteio aleatório justo entre os elegíveis
    let responsavelSorteado = candidatosElegiveis[Math.floor(Math.random() * candidatosElegiveis.length)];
    await setDoc(relatorioRef, { nome: responsavelSorteado, data: dataHoje });
    inputResponsavel.value = responsavelSorteado;
    // ---------------------------------------------------------------------

    const snaps = await getDocs(collection(db, "escala_ativa"));
    for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    
    for (let i = 0; i < 8; i++) {
        let hora = (horaInicio + i) % 24;
        let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
        let escala = { ordem: i, horario: horarioFormatado, status: "Online", data_registro: dataHoje };

        let pixIndex = i % p;
        let bdsIndex = (i + 1) % p;
        
        if (p > 1 && pixIndex === bdsIndex) {
            bdsIndex = (bdsIndex + 1) % p;
        }

        let discordIndex = (i + 2) % p;
        let ganheiIndex = (i + 3) % p;

        let pixbetVal = colabs[pixIndex];
        let bdsVal = colabs[bdsIndex];
        let ganheiVal = colabs[ganheiIndex];
        let discordVal;

        if (turno === "madrugada") {
            discordVal = "TODOS";
        } else {
            discordVal = colabs[discordIndex];
        }

        escala = { 
            ...escala, 
            pixbet: pixbetVal, 
            bds: bdsVal, 
            discord: discordVal, 
            ganhei: ganheiVal, 
            original_pixbet: pixbetVal, 
            original_bds: bdsVal, 
            original_discord: discordVal, 
            original_ganhei: ganheiVal,
            pausados: []
        };

        await setDoc(doc(db, "escala_ativa", `turno_${i}`), escala);
    }
    
    dadosLog.contagem += 1;
    await setDoc(logRef, dadosLog);
    alert(`Escala do turno ${turno} gerada e relatório atribuído a ${responsavelSorteado}!`);
});

// Botão Limpar Escala
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja realmente apagar toda a escala atual?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        alert("Escala limpa com sucesso!");
    }
});

// Função de Checkin Individual
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if (col === 'discord' && d.discord === "TODOS") return;
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

// Gerenciamento de Status Global (Online)
window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if (valor === "Online") { 
        await updateDoc(docRef, { 
            pixbet: d.original_pixbet, 
            bds: d.original_bds, 
            discord: d.original_discord, 
            ganhei: d.original_ganhei, 
            pausados: [],
            status: "Online" 
        }); 
    }
};

// Gerenciamento de Pausas Múltiplas com Realocação, Proteção Pixbet/BDS e Manutenção do Discord
window.alternarPausa = async (id, colaborador) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    
    let pausadosAtuais = d.pausados || [];
    
    if (pausadosAtuais.includes(colaborador)) {
        pausadosAtuais = pausadosAtuais.filter(n => n !== colaborador);
    } else {
        pausadosAtuais.push(colaborador);
    }

    const todosOriginais = [d.original_pixbet, d.original_bds, d.original_ganhei];
    const unicosOriginais = [...new Set(todosOriginais.filter(n => n && n.trim() !== ""))];

    const ativos = unicosOriginais.filter(n => !pausadosAtuais.includes(n));
    const qtdAtivos = ativos.length;

    let novaEscala = {};
    if (qtdAtivos === 0) {
        novaEscala = { pixbet: "Pausa", bds: "Pausa", ganhei: "Pausa" };
    } else if (qtdAtivos === 1) {
        novaEscala = { pixbet: ativos[0], bds: ativos[0], ganhei: ativos[0] };
    } else {
        let pIdx = 0;
        let bIdx = 1 % qtdAtivos;
        let gIdx = 2 % qtdAtivos;

        novaEscala = {
            pixbet: ativos[pIdx],
            bds: ativos[bIdx],
            ganhei: ativos[gIdx]
        };
    }

    novaEscala.discord = d.original_discord;

    let statusTexto = pausadosAtuais.length > 0 ? "Pausa: " + pausadosAtuais.join(", ") : "Online";

    await updateDoc(docRef, {
        ...novaEscala,
        pausados: pausadosAtuais,
        status: statusTexto
    });
};
        
        let linhaHTML = `<tr><td class="text-bold">${d.horario}</td>`;
        colunas.forEach(col => {
            const statusCheck = d[`checkin_${col}`] === 'OK' ? '#28a745' : '#1a2533';
            let valorExibido = d[col] || "";
            let acaoClick = col === 'discord' && valorExibido === "TODOS" ? "" : `onclick="window.checkin('${docSnap.id}', '${col}')"`;
            let estiloCursor = col === 'discord' && valorExibido === "TODOS" ? "cursor: default;" : "";
            
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

// Botão Girar (Com regra do "TODOS" na madrugada)
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
    const logSnap = await getFirestoreDoc(logRef);
    let dadosLog = logSnap.exists() && logSnap.data().data === dataHoje ? logSnap.data() : { data: dataHoje, contagem: 0 };

    if (dadosLog.contagem >= 2) {
        const senha = prompt("Sorteio limitado (2x/dia). Digite a senha:");
        if (senha !== SENHA_ADMIN) { alert("Acesso negado."); return; }
    }

    const snaps = await getDocs(collection(db, "escala_ativa"));
    for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    
    for (let i = 0; i < 8; i++) {
        let hora = (horaInicio + i) % 24;
        let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
        let escala = { ordem: i, horario: horarioFormatado, status: "Online", data_registro: dataHoje };

        let pixbetVal = colabs[i % p];
        let bdsVal = colabs[(i+1) % p];
        let ganheiVal = colabs[(i+3) % p];
        let discordVal;

        if (turno === "madrugada") {
            discordVal = "TODOS";
        } else {
            discordVal = colabs[(i+2) % p];
        }

        escala = { 
            ...escala, 
            pixbet: pixbetVal, 
            bds: bdsVal, 
            discord: discordVal, 
            ganhei: ganheiVal, 
            original_pixbet: pixbetVal, 
            original_bds: bdsVal, 
            original_discord: discordVal, 
            original_ganhei: ganheiVal,
            pausados: []
        };

        await setDoc(doc(db, "escala_ativa", `turno_${i}`), escala);
    }
    
    dadosLog.contagem += 1;
    await setDoc(logRef, dadosLog);
    alert(`Escala do turno ${turno} gerada com sucesso!`);
});

// Botão Limpar Escala
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja realmente apagar toda a escala atual?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        alert("Escala limpa com sucesso!");
    }
});

// Função de Checkin Individual
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if (col === 'discord' && d.discord === "TODOS") return;
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

// Gerenciamento de Status Global (Online)
window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if (valor === "Online") { 
        await updateDoc(docRef, { 
            pixbet: d.original_pixbet, 
            bds: d.original_bds, 
            discord: d.original_discord, 
            ganhei: d.original_ganhei, 
            pausados: [],
            status: "Online" 
        }); 
    }
};

// Gerenciamento de Pausas Múltiplas com Tratamento para a Madrugada
window.alternarPausa = async (id, colaborador) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    
    let pausadosAtuais = d.pausados || [];
    
    if (pausadosAtuais.includes(colaborador)) {
        pausadosAtuais = pausadosAtuais.filter(n => n !== colaborador);
    } else {
        pausadosAtuais.push(colaborador);
    }

    const todosOriginais = [d.original_pixbet, d.original_bds, d.original_ganhei];
    const unicosOriginais = [...new Set(todosOriginais.filter(n => n && n.trim() !== ""))];

    const ativos = unicosOriginais.filter(n => !pausadosAtuais.includes(n));
    const qtdAtivos = ativos.length;

    let novaEscala = {};
    if (qtdAtivos === 0) {
        novaEscala = { pixbet: "Pausa", bds: "Pausa", ganhei: "Pausa" };
    } else {
        novaEscala = {
            pixbet: ativos[0 % qtdAtivos],
            bds: ativos[1 % qtdAtivos],
            ganhei: ativos[2 % qtdAtivos]
        };
    }

    // Mantém "TODOS" na madrugada ou o valor original do discord nos demais turnos
    novaEscala.discord = d.original_discord;

    let statusTexto = pausadosAtuais.length > 0 ? "Pausa: " + pausadosAtuais.join(", ") : "Online";

    await updateDoc(docRef, {
        ...novaEscala,
        pausados: pausadosAtuais,
        status: statusTexto
    });
};
