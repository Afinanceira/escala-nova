import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";

const tbody = document.getElementById("escala-body");

// 1. Escuta em tempo real
onSnapshot(collection(db, "escala_ativa"), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
        const d = doc.data();
        // Renderiza a linha com os botões verdes
        tbody.innerHTML += `
            <tr>
                <td>${d.horario}</td>
                <td><button class="colaborador-btn ${d.status_p1 ? 'ativo' : ''}" onclick="fazerCheckin('p1')">${d.pixbet}</button></td>
                <td><button class="colaborador-btn ${d.status_p2 ? 'ativo' : ''}" onclick="fazerCheckin('p2')">${d.bds}</button></td>
                <td><button class="colaborador-btn ${d.status_p3 ? 'ativo' : ''}" onclick="fazerCheckin('p3')">${d.betvip}</button></td>
                <td><button class="colaborador-btn ${d.status_p4 ? 'ativo' : ''}" onclick="fazerCheckin('p4')">${d.ganhei}</button></td>
                <td>${d.discord}</td>
                <td>${d.pausa || '-'}</td>
            </tr>
        `;
    });
});

// 2. Lógica do Rodízio
document.getElementById("btn-girar").addEventListener("click", async () => {
    const nomes = [document.getElementById("c1").value, document.getElementById("c2").value, 
                   document.getElementById("c3").value, document.getElementById("c4").value];
    const primeiro = nomes.shift(); nomes.push(primeiro);
    
    await setDoc(doc(db, "escala_ativa", "turno_atual"), {
        pixbet: nomes[0], bds: nomes[1], betvip: nomes[2], ganhei: nomes[3],
        horario: "23:00", discord: "Todos", status_p1: false, status_p2: false
    });
});

// 3. Função de Check-in (Global para o HTML)
window.fazerCheckin = async (posicao) => {
    const ref = doc(db, "escala_ativa", "turno_atual");
    await updateDoc(ref, { [`status_${posicao}`]: true });
};