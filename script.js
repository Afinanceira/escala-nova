import { db } from './firebaseConfig.js';
import { 
    collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const tbody = document.getElementById("escala-body");

// 1. Renderiza a tabela em tempo real
const q = query(collection(db, "escala_ativa"), orderBy("horario"));
onSnapshot(q, (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
        const d = doc.data();
        const id = doc.id;
        // Se status for Online, aplica a classe .ativo que você definiu no CSS
        const statusClass = d.status === "Online" ? "ativo" : "";
        
        tbody.innerHTML += `
            <tr>
                <td>${d.horario}</td>
                <td>${d.pixbet}</td>
                <td>${d.bds}</td>
                <td>${d.betvip}</td>
                <td>${d.ganhei}</td>
                <td>Todos</td>
                <td>
                    <button class="colaborador-btn ${statusClass}" onclick="window.marcarStatus('${id}', '${d.status}')">
                        ${d.status || 'Pausa'}
                    </button>
                </td>
            </tr>
        `;
    });
});

// 2. Ação do Botão Girar (Rodízio Justo)
document.getElementById("btn-girar").addEventListener("click", async () => {
    let nomes = [
        document.getElementById("c1").value,
        document.getElementById("c2").value,
        document.getElementById("c3").value,
        document.getElementById("c4").value
    ].filter(n => n.trim() !== "");

    if (nomes.length < 2) return alert("Insira pelo menos 2 colaboradores!");
    while (nomes.length < 4) nomes.push("Vago");

    const horas = ["23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"];
    
    for (let i = 0; i < horas.length; i++) {
        const rodizio = [...nomes.slice(i % 4), ...nomes.slice(0, i % 4)];
        await setDoc(doc(db, "escala_ativa", `turno_${horas[i].replace(":", "")}`), {
            horario: horas[i],
            pixbet: rodizio[0],
            bds: rodizio[1],
            betvip: rodizio[2],
            ganhei: rodizio[3],
            status: "Pausa"
        });
    }
    alert("Rodízio gerado com sucesso!");
});

// 3. Função de Check-in (Alterna entre Pausa e Online)
window.marcarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === "Online" ? "Pausa" : "Online";
    await updateDoc(doc(db, "escala_ativa", id), { status: novoStatus });
};
