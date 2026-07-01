import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, getDoc, getDocs, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Inicialização
document.getElementById("data-atual").innerText = new Date().toLocaleDateString('pt-BR');
const tbody = document.getElementById("escala-body");

// Monitoramento em tempo real
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">Nenhuma escala encontrada. Preencha os nomes e clique em Gerar Rodízio.</td></tr>`;
        return;
    }

    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const corStatus = d.status && d.status.startsWith("Online") ? "#28a745" : "#dc3545";
        const colabsLinha = [d.original_pixbet || d.pixbet, d.original_bds || d.bds, d.original_betvip || d.betvip, d.original_ganhei || d.ganhei].filter((v, i, s) => s.indexOf(v) === i && v);

        tbody.innerHTML += `
            <tr>
                <td class="text-bold">${d.horario}</td>
                <td>${d.pixbet}</td><td>${d.bds}</td><td>${d.betvip}</td><td>${d.ganhei}</td>
                <td>
                    <div class="dropdown">
                        <button class="status-btn" style="background:${corStatus}">${d.status || 'Pausa'}</button>
                        <div class="dropdown-content">
                            <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Online')">✅ Check-in</a>
                            <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Retorno')">🔙 Retorno</a>
                            ${colabsLinha.map(n => `<a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', '${n}')">⏸️ Pausa: ${n}</a>`).join('')}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
});

// Gestão de Status
window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const d = snap.data();

    const orig = { p: d.original_pixbet || d.pixbet, b: d.original_bds || d.bds, v: d.original_betvip || d.betvip, g: d.original_ganhei || d.ganhei };

    if (valor === "Online") {
        await updateDoc(docRef, { status: "Online" });
    } else if (valor === "Retorno") {
        await updateDoc(docRef, { pixbet: orig.p, bds: orig.b, betvip: orig.v, ganhei: orig.g, status: "Online" });
    } else {
        const ativos = [orig.p, orig.b, orig.v, orig.g].filter(n => n !== valor);
        await updateDoc(docRef, { 
            pixbet: ativos[0], bds: ativos[1 % ativos.length], betvip: ativos[2 % ativos.length], ganhei: ativos[3 % ativos.length],
            original_pixbet: orig.p, original_bds: orig.b, original_betvip: orig.v, original_ganhei: orig.g, status: "Pausa: " + valor 
        });
    }
};

// Gerar Rodízio
const btnGirar = document.getElementById("btn-girar");
if (btnGirar) {
    btnGirar.addEventListener("click", async () => {
        const colaboradores = [document.getElementById("c1").value || "Leandro", document.getElementById("c2").value || "Ivah", document.getElementById("c3").value || "Tarcyla", document.getElementById("c4").value || "Paloma"];
        const horarios = ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"];
        
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
        
        for (let i = 0; i < horarios.length; i++) {
            await setDoc(doc(db, "escala_ativa", `turno_${i}`), {
                ordem: i, horario: horarios[i], pixbet: colaboradores[i % 4], bds: colaboradores[(i+1) % 4], betvip: colaboradores[(i+2) % 4], ganhei: colaboradores[(i+3) % 4],
                original_pixbet: colaboradores[i % 4], original_bds: colaboradores[(i+1) % 4], original_betvip: colaboradores[(i+2) % 4], original_ganhei: colaboradores[(i+3) % 4], status: "Online"
            });
        }
        alert("Escala gerada!");
    });
}

// Limpar
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Apagar tudo?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        for (const s of snaps.docs) await deleteDoc(doc(db, "escala_ativa", s.id));
    }
});
