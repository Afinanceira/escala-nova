import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Inicialização de metadados
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
        const colabsLinha = [d.original_pixbet || d.pixbet, d.original_bds || d.bds, d.original_betvip || d.betvip, d.original_ganhei || d.ganhei].filter((v, i, s) => s.indexOf(v) === i && v);
        
        let linhaHTML = `<tr><td class="text-bold">${d.horario}</td>`;
        colunas.forEach(col => {
            const statusCheck = d[`checkin_${col}`] === 'OK' ? '#28a745' : '#1a2533';
            linhaHTML += `<td><button class="btn-nome-checkin" onclick="window.checkin('${docSnap.id}', '${col}')" style="background:${statusCheck};">${d[col]}</button></td>`;
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
    const d = (await getDoc(doc(db, "escala_ativa", id))).data();
    await updateDoc(doc(db, "escala_ativa", id), { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

window.gerenciarStatus = async (id, valor) => {
    const d = (await getDoc(doc(db, "escala_ativa", id))).data();
    const orig = { p: d.original_pixbet, b: d.original_bds, v: d.original_betvip, g: d.original_ganhei };
    if (valor === "Online") await updateDoc(doc(db, "escala_ativa", id), { status: "Online" });
    else if (valor === "Retorno") await updateDoc(doc(db, "escala_ativa", id), { ...orig, status: "Online" });
    else {
        const ativos = [orig.p, orig.b, orig.v, orig.g].filter(n => n !== valor);
        await updateDoc(doc(db, "escala_ativa", id), { pixbet: ativos[0%ativos.length], bds: ativos[1%ativos.length], betvip: ativos[2%ativos.length], ganhei: ativos[3%ativos.length], status: "Pausa: " + valor });
    }
};

document.getElementById("btn-girar").addEventListener("click", async () => {
    const colabs = [document.getElementById("c1").value, document.getElementById("c2").value, document.getElementById("c3").value, document.getElementById("c4").value];
    const snaps = await getDocs(collection(db, "escala_ativa"));
    for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    for (let i = 0; i < 7; i++) {
        await setDoc(doc(db, "escala_ativa", `turno_${i}`), { ordem: i, horario: `${i.toString().padStart(2, '0')}:00`, pixbet: colabs[i%4], bds: colabs[(i+1)%4], betvip: colabs[(i+2)%4], ganhei: colabs[(i+3)%4], original_pixbet: colabs[i%4], original_bds: colabs[(i+1)%4], original_betvip: colabs[(i+2)%4], original_ganhei: colabs[(i+3)%4], status: "Online" });
    }
    alert("Escala gerada!");
});

document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Apagar tudo?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    }
});
