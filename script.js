import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Inicialização de Data
document.getElementById("data-atual").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");
const flashText = document.getElementById("flash-text");

// Flash Report em tempo real
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (doc) => { if (doc.exists()) flashText.value = doc.data().conteudo || ""; });
flashText.addEventListener("input", async (e) => { await setDoc(flashRef, { conteudo: e.target.value }); });

// Renderização da Escala
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const colunas = ['pixbet', 'bds', 'betvip', 'ganhei'];
        const colabsLinha = [d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei].filter(n => n && n.trim() !== "");
        
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

// Funções de Ação
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    const original = [d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei];
    
    if (valor === "Online") await updateDoc(docRef, { status: "Online" });
    else if (valor === "Retorno") await updateDoc(docRef, { pixbet: d.original_pixbet, bds: d.original_bds, betvip: d.original_betvip, ganhei: d.original_ganhei, status: "Online" });
    else {
        const ativos = original.filter(n => n !== valor && n && n.trim() !== "");
        await updateDoc(docRef, { 
            pixbet: ativos[0] || "", bds: ativos[1] || "", betvip: ativos[2] || "", ganhei: ativos[3] || "", 
            status: "Pausa: " + valor 
        });
    }
};

// Geração de Rodízio (Considera 2, 3 ou 4 colaboradores)
document.getElementById("btn-girar").addEventListener("click", async () => {
    const inputs = [document.getElementById("c1").value, document.getElementById("c2").value, document.getElementById("c3").value, document.getElementById("c4").value];
    const colabs = inputs.filter(n => n && n.trim() !== "");
    
    const snaps = await getDocs(collection(db, "escala_ativa"));
    for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    
    for (let i = 0; i < 7; i++) {
        const p = colabs.length;
        await setDoc(doc(db, "escala_ativa", `turno_${i}`), { 
            ordem: i, horario: `${i.toString().padStart(2, '0')}:00`, 
            pixbet: colabs[i % p] || "", bds: colabs[(i+1) % p] || "", betvip: colabs[(i+2) % p] || "", ganhei: colabs[(i+3) % p] || "", 
            original_pixbet: colabs[i % p] || "", original_bds: colabs[(i+1) % p] || "", original_betvip: colabs[(i+2) % p] || "", original_ganhei: colabs[(i+3) % p] || "", 
            status: "Online" 
        });
    }
    alert("Escala gerada para " + colabs.length + " colaboradores!");
});

document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja realmente apagar toda a escala?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        alert("Escala limpa!");
    }
});
