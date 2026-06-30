import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

document.getElementById("data-atual").innerText = new Date().toLocaleDateString();

const tbody = document.getElementById("escala-body");
const colabs = ["Leandro", "Ivah", "Tarcyla", "Paloma"]; // Mantenha sua lista aqui

onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
        const d = doc.data();
        const corStatus = d.status && d.status.startsWith("Online") ? "#28a745" : "#dc3545";
        
        tbody.innerHTML += `
            <tr>
                <td>${d.horario}</td>
                <td>${d.pixbet}</td><td>${d.bds}</td><td>${d.betvip}</td><td>${d.ganhei}</td>
                <td>
                    <div class="dropdown">
                        <button class="status-btn" style="background:${corStatus}">${d.status || 'Pausa'}</button>
                        <div class="dropdown-content">
                            <a href="#" onclick="window.gerenciarStatus('${doc.id}', 'Online')">✅ Check-in</a>
                            <a href="#" onclick="window.gerenciarStatus('${doc.id}', 'Retorno')">🔙 Retorno</a>
                            ${colabs.map(n => `<a href="#" onclick="window.gerenciarStatus('${doc.id}', '${n}')">Pausa: ${n}</a>`).join('')}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
});

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    const d = snap.data();

    if (valor === "Online") {
        await updateDoc(docRef, { status: "Online" });
    } else if (valor === "Retorno") {
        await updateDoc(docRef, {
            pixbet: d.original_pixbet, bds: d.original_bds,
            betvip: d.original_betvip, ganhei: d.original_ganhei,
            status: "Online"
        });
    } else {
        const ativos = colabs.filter(n => n !== valor);
        let nova = {};
        ["pixbet", "bds", "betvip", "ganhei"].forEach((c, i) => nova[c] = ativos[i % ativos.length]);
        
        await updateDoc(docRef, {
            ...nova,
            original_pixbet: d.pixbet, original_bds: d.bds,
            original_betvip: d.betvip, original_ganhei: d.ganhei,
            status: "Pausa: " + valor
        });
    }
};
