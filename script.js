import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const tbody = document.getElementById("escala-body");
const flashText = document.getElementById("flash-text");

// 1. Flash Report em Tempo Real
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (doc) => {
    if (doc.exists()) flashText.value = doc.data().conteudo || "";
});

flashText.addEventListener("input", async (e) => {
    await setDoc(flashRef, { conteudo: e.target.value });
});

// 2. Monitoramento da Escala e Renderização com Botões de Check-in nos Nomes
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const colunas = ['pixbet', 'bds', 'betvip', 'ganhei'];
        const corStatus = d.status && d.status.startsWith("Online") ? "#28a745" : "#dc3545";
        
        let linhaHTML = `<tr><td class="text-bold">${d.horario}</td>`;
        
        colunas.forEach(col => {
            const nome = d[col];
            const statusCheck = d[`checkin_${col}`] === 'OK' ? '#28a745' : '#1a2533'; 
            linhaHTML += `<td>
                <button class="btn-nome-checkin" onclick="window.checkin('${docSnap.id}', '${col}')" 
                        style="background:${statusCheck};">
                    ${nome}
                </button>
            </td>`;
        });

        linhaHTML += `<td>
            <div class="dropdown">
                <button class="status-btn" style="background:${corStatus}">${d.status || 'Online'}</button>
                <div class="dropdown-content">
                    <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Online')">✅ Check-in</a>
                    <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Retorno')">🔙 Retorno</a>
                    <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Pausa')">⏸️ Pausa</a>
                </div>
            </div>
        </td></tr>`;
        tbody.innerHTML += linhaHTML;
    });
});

// 3. Função de Check-in Individual
window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    const atual = snap.data()[`checkin_${col}`];
    await updateDoc(docRef, { [`checkin_${col}`]: atual === 'OK' ? 'Pendente' : 'OK' });
};

// 4. Gestão de Status de Pausa
window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const d = snap.data();
    const orig = { p: d.original_pixbet || d.pixbet, b: d.original_bds || d.bds, v: d.original_betvip || d.betvip, g: d.original_ganhei || d.ganhei };

    if (valor === "Online") await updateDoc(docRef, { status: "Online" });
    else if (valor === "Retorno") await updateDoc(docRef, { pixbet: orig.p, bds: orig.b, betvip: orig.v, ganhei: orig.g, status: "Online" });
    else {
        const ativos = [orig.p, orig.b, orig.v, orig.g].filter(n => n !== "Pausa");
        await updateDoc(docRef, { 
            pixbet: ativos[0], bds: ativos[1 % ativos.length], betvip: ativos[2 % ativos.length], ganhei: ativos[3 % ativos.length],
            status: "Pausa" 
        });
    }
};

// 5. Geração de Rodízio
const btnGirar = document.getElementById("btn-girar");
if (btnGirar) {
    btnGirar.addEventListener("click", async () => {
        const colabs = [document.getElementById("c1").value || "Leandro", document.getElementById("c2").value || "Ivah", document.getElementById("c3").value || "Tarcyla", document.getElementById("c4").value || "Paloma"];
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        
        for (let i = 0; i < 7; i++) {
            await setDoc(doc(db, "escala_ativa", `turno_${i}`), {
                ordem: i, horario: `${i.toString().padStart(2, '0')}:00`, 
                pixbet: colabs[i%4], bds: colabs[(i+1)%4], betvip: colabs[(i+2)%4], ganhei: colabs[(i+3)%4],
                original_pixbet: colabs[i%4], original_bds: colabs[(i+1)%4], original_betvip: colabs[(i+2)%4], original_ganhei: colabs[(i+3)%4], 
                status: "Online"
            });
        }
        alert("Escala gerada!");
    });
}
