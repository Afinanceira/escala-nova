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

// Renderização Escala
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const colunas = ['pixbet', 'bds', 'betvip', 'ganhei'];
        const colabsLinha = [...new Set([d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei].filter(n => n && n.trim() !== ""))];
        
        let linhaHTML = `<tr><td class="text-bold">${d.horario}</td>`;
        colunas.forEach(col => {
            const statusCheck = d[`checkin_${col}`] === 'OK' ? '#28a745' : '#1a2533';
            linhaHTML += `<td><button class="btn-nome-checkin" onclick="window.checkin('${docSnap.id}', '${col}')" style="background:${statusCheck};">${d[col] || ""}</button></td>`;
        });

        linhaHTML += `<td>
            <div class="dropdown">
                <button class="status-btn" style="background:${d.status?.startsWith("Online") ? "#28a745" : "#dc3545"}">${d.status || 'Online'}</button>
                <div class="dropdown-content">
                    <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Online')">✅ Check-in</a>
                    <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Retorno')">🔙 Retorno</a>
                    ${colabsLinha.map(n => `<a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', '${n}')">⏸️ Pausa: ${n}</a>`).join('')}
                </div>
            </div>
        </td></tr>`;
        tbody.innerHTML += linhaHTML;
    });
});

// Botão Girar
document.getElementById("btn-girar").addEventListener("click", async () => {
    const turno = document.getElementById("select-turno").value;
    const horaInicio = turno === "manha" ? 7 : (turno === "noite" ? 15 : 23);
    const inputs = [];
    for(let i=1; i<=6; i++) inputs.push(document.getElementById(`c${i}`).value);
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
        escala = { ...escala, pixbet: colabs[i % p], bds: colabs[(i+1) % p], betvip: colabs[(i+2) % p], ganhei: colabs[(i+3) % p], original_pixbet: colabs[i % p], original_bds: colabs[(i+1) % p], original_betvip: colabs[(i+2) % p], original_ganhei: colabs[(i+3) % p] };
        await setDoc(doc(db, "escala_ativa", `turno_${i}`), escala);
    }
    dadosLog.contagem += 1;
    await setDoc(logRef, dadosLog);
    alert(`Escala do turno ${turno} gerada!`);
});

// Botão Limpar Escala
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja realmente apagar toda a escala atual?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        alert("Escala limpa com sucesso!");
    }
});

// Funções de Apoio globais
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    if (valor === "Online") { await updateDoc(docRef, { status: "Online" }); } 
    else if (valor === "Retorno") { await updateDoc(docRef, { pixbet: d.original_pixbet, bds: d.original_bds, betvip: d.original_betvip, ganhei: d.original_ganhei, status: "Online" }); }
    else {
        const ativos = [...new Set([d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei].filter(n => n !== valor && n && n.trim() !== ""))];
        const p = ativos.length;
        if (p === 0) return;
        let novaEscala = { pixbet: ativos[0 % p], bds: ativos[1 % p], betvip: ativos[2 % p], ganhei: ativos[3 % p] };
        await updateDoc(docRef, { ...novaEscala, status: "Pausa: " + valor });
    }
};

// ==========================================
// AUTOMAÇÃO DE ENVIO PARA O WHATSAPP (+55 83 9673-8423)
// ==========================================
window.enviarRelatorioWhatsApp = async () => {
    const grupoDestino = prompt("Digite o nome ou identificador do Grupo de Relatórios do WhatsApp:");
    if (!grupoDestino || grupoDestino.trim() === "") {
        alert("Envio cancelado. Nenhum grupo foi informado.");
        return;
    }

    try {
        const querySnapshot = await getDocs(query(collection(db, "escala_ativa"), orderBy("ordem")));
        if (querySnapshot.empty) {
            alert("Não há escala ativa para gerar o relatório.");
            return;
        }

        let mensagem = `📊 *RELATÓRIO DE ESCALA - ${new Date().toLocaleDateString('pt-BR')}* \n\n`;
        
        querySnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            mensagem += `⏰ *${d.horario}* | Status: ${d.status || 'Online'}\n` +
                        `   • Pixbet: ${d.pixbet || '-'}\n` +
                        `   • BDS: ${d.bds || '-'}\n` +
                        `   • Betvip: ${d.betvip || '-'}\n` +
                        `   • Ganhei: ${d.ganhei || '-'}\n\n`;
        });

        const flashConteudo = flashText.value ? flashText.value.trim() : "";
        if (flashConteudo) {
            mensagem += `📌 *Flash Report:* ${flashConteudo}\n`;
        }

        mensagem += `_Enviado por AFinanceira - Destino: ${grupoDestino}_`;

        const numeroEmpresa = "558396738423";
        const urlWhatsApp = `https://api.whatsapp.com/send?phone=${numeroEmpresa}&text=${encodeURIComponent(mensagem)}`;
        
        window.open(urlWhatsApp, '_blank');
        
    } catch (error) {
        console.error("Erro ao gerar relatório para o WhatsApp:", error);
        alert("Ocorreu um erro ao montar o relatório.");
    }
};

// Vinculação de segurança via Event Listener caso o botão exista no HTML
document.addEventListener("DOMContentLoaded", () => {
    const btnEnviarWpp = document.getElementById("btn-enviar-wpp");
    if (btnEnviarWpp) {
        btnEnviarWpp.addEventListener("click", window.enviarRelatorioWhatsApp);
    }
});
