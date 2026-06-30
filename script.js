import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const tbody = document.getElementById("escala-body");

// Renderiza a tabela em tempo real
onSnapshot(collection(db, "escala_ativa"), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
        const d = doc.data();
        tbody.innerHTML += `
            <tr>
                <td>23:00</td>
                <td><button class="colaborador-btn">${d.pixbet || ''}</button></td>
                <td><button class="colaborador-btn">${d.bds || ''}</button></td>
                <td><button class="colaborador-btn">${d.betvip || ''}</button></td>
                <td><button class="colaborador-btn">${d.ganhei || ''}</button></td>
                <td>Todos</td>
                <td>-</td>
            </tr>
        `;
    });
});

// Ação do Botão Girar
document.getElementById("btn-girar").addEventListener("click", async () => {
    const n1 = document.getElementById("c1").value;
    const n2 = document.getElementById("c2").value;
    const n3 = document.getElementById("c3").value;
    const n4 = document.getElementById("c4").value;
    
    try {
        await setDoc(doc(db, "escala_ativa", "turno_atual"), {
            pixbet: n1, bds: n2, betvip: n3, ganhei: n4
        });
        document.getElementById("data-atual").innerText = new Date().toLocaleDateString();
        alert("Escala atualizada!");
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao atualizar!");
    }
});
