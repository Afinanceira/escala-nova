import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc, getDoc as getFirestoreDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "1234";

document.getElementById("data-atual").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");
const flashText = document.getElementById("flash-text");

// Flash Report
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (doc) => { if (doc.exists()) flashText.value = doc.data().conteudo || ""; });
flashText.addEventListener("input", async (e) => { await setDoc(flashRef, { conteudo: e.target.value }); });

// Renderização
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

window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    const original = [d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei];
    
    if (valor === "Online") {
        await updateDoc(docRef, { status: "Online" });
    } else if (valor === "Retorno") {
        await updateDoc(docRef, { pixbet: d.original_pixbet, bds: d.original_bds, betvip: d.original_betvip, ganhei: d.original_ganhei, status: "Online" });
    } else {
        const ativos = original.filter(n => n !== valor && n && n.trim() !== "");
        const p = ativos.length;
        if (p === 0) return;
        let redistribuicao = (p === 2) ? { pixbet: ativos[0], bds: ativos[0], betvip: ativos[1], ganhei: ativos[1] } 
                                       : { pixbet: ativos[0 % p], bds: ativos[1 % p], betvip: ativos[2 % p], ganhei: ativos[3 % p] };
        await updateDoc(docRef, { ...redistribuicao, status: "Pausa: " + valor });
    }
};

// Geração com Verificação de Data
document.getElementById("btn-girar").addEventListener("click", async () => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const logRef = doc(db, "config", "sorteio_log");
    const logSnap = await getDoc(logRef);
    const dataUltimoSorteio = logSnap.exists() ? logSnap.data().data : "";

    // Se já houve sorteio hoje, exige senha
    if (dataUltimoSorteio === dataHoje) {
        const senhaDigitada = prompt("Sorteio já realizado hoje. Digite a senha de administrador para um novo:");
        if (senhaDigitada !== SENHA_ADMIN) {
            alert("Acesso negado.");
            return;
        }
    }

    const inputs = [document.getElementById("c1").value, document.getElementById("c2").value, document.getElementById("c3").value, document.getElementById("c4").value];
    const colabs = inputs.filter(n => n && n.trim() !== "");
    const p = colabs.length;
    
    if (p === 0) { alert("Adicione pelo menos um colaborador!"); return; }

    const snaps = await getDocs(collection(db, "escala_ativa"));
    for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    
    for (let i = 0; i < 8; i++) {
        let hora = (23 + i) % 24;
        let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
        await setDoc(doc(db, "escala_ativa", `turno_${i}`), { 
            ordem: i, horario: horarioFormatado, 
            pixbet: colabs[i % p], bds: colabs[(i+1) % p], betvip: colabs[(i+2) % p], ganhei: colabs[(i+3) % p], 
            original_pixbet: colabs[i % p], original_bds: colabs[(i+1) % p], original_betvip: colabs[(i+2) % p], original_ganhei: colabs[(i+3) % p], 
            status: "Online" 
        });
    }

    // Registra a data no log
    await setDoc(logRef, { data: dataHoje });
    alert("Escala gerada com sucesso!");
});

document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja realmente apagar toda a escala atual?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        alert("Escala limpa!");
    }
});
