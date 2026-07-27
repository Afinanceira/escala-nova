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

// Funções de Apoio
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
// AUTOMAÇÃO DE ENVIO DO FLASH REPORT PARA O WHATSAPP
// ==========================================
window.enviarRelatorioWhatsApp = async () => {
    try {
        const flashConteudo = flashText.value ? flashText.value.trim() : "";
        
        if (!flashConteudo) {
            alert("A caixa do Flash Report está vazia. Escreva o relatório antes de enviar.");
            return;
        }

        // Copia estritamente o conteúdo digitado na caixa de texto do Flash Report
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(flashConteudo);
        } else {
            const textareaTemp = document.createElement("textarea");
            textareaTemp.value = flashConteudo;
            document.body.appendChild(textareaTemp);
            textareaTemp.select();
            document.execCommand("copy");
            document.body.removeChild(textareaTemp);
        }

        // Abre o WhatsApp Web para você escolher o grupo livremente
        window.open("https://web.whatsapp.com/", "_blank");
        
        alert("✅ Flash Report copiado com sucesso!\n\nO WhatsApp Web foi aberto. Basta abrir o grupo desejado e apertar Ctrl+V para colar e enviar.");
        
    } catch (error) {
        console.error("Erro ao copiar Flash Report para o WhatsApp:", error);
        alert("Ocorreu um erro ao copiar o texto.");
    }
};

// Vinculação de segurança via Event Listener
document.addEventListener("DOMContentLoaded", () => {
    const btnEnviarWpp = document.getElementById("btn-enviar-wpp");
    if (btnEnviarWpp) {
        btnEnviarWpp.addEventListener("click", window.enviarRelatorioWhatsApp);
    }
});
