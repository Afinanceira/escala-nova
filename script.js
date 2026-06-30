import { db } from './firebaseConfig.js';
import { 
    collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const tbody = document.getElementById("escala-body");

// 1. Renderiza a tabela em tempo real
const q = query(collection(db, "escala_ativa"), orderBy("horario"));
onSnapshot(q, (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
        const d = doc.data();
        const statusClass = d.status && d.status.includes("Pausa") ? "" : "ativo";
        tbody.innerHTML += `
            <tr>
                <td>${d.horario}</td>
                <td>${d.pixbet}</td><td>${d.bds}</td><td>${d.betvip}</td><td>${d.ganhei}</td>
                <td>
                    <button onclick="window.confirmarPresenca('${doc.id}')" class="colaborador-btn ${statusClass}">
                        ${d.status || 'Pausa'}
                    </button>
                </td>
            </tr>
        `;
    });
});

// 2. Ação de Pausa com Realocação Automática
window.iniciarPausa = async () => {
    const nomePausa = document.getElementById("nome-pausa").value;
    if (!nomePausa) return alert("Digite o nome de quem vai pausar!");

    const snapshot = await getDocs(collection(db, "escala_ativa"));
    const todosNomes = ["c1", "c2", "c3", "c4"].map(id => document.getElementById(id)?.value).filter(n => n && n.trim() !== "");
    const ativos = todosNomes.filter(n => n !== nomePausa);

    if (ativos.length === 0) return alert("Não há colaboradores disponíveis para realocação!");

    snapshot.forEach(async (doc) => {
        let dados = doc.data();
        if (Object.values(dados).includes(nomePausa)) {
            let casas = ["pixbet", "bds", "betvip", "ganhei"];
            let novaEscala = {};
            casas.forEach((c, i) => novaEscala[c] = ativos[i % ativos.length]);
            
            await updateDoc(doc.ref, { 
                ...novaEscala, 
                status: "Pausa (Saída de " + nomePausa + ")" 
            });
        }
    });
    alert("Realocação concluída!");
};

// 3. Ação do Botão Girar (Rodízio Justo)
document.getElementById("btn-girar").addEventListener("click", async () => {
    let nomes = ["c1", "c2", "c3", "c4"].map(id => document.getElementById(id).value).filter(n => n.trim() !== "");
    if (nomes.length < 1) return alert("Insira os colaboradores!");

    const horas = ["23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"];
    
    for (let i = 0; i < horas.length; i++) {
        let escala = {};
        for(let j=0; j<4; j++) escala[["pixbet", "bds", "betvip", "ganhei"][j]] = nomes[(i + j) % nomes.length];
        await setDoc(doc(db, "escala_ativa", `turno_${horas[i].replace(":", "")}`), { 
            ...escala, status: "Pausa", horario: horas[i] 
        });
    }
});

// 4. Check-in Simples
window.confirmarPresenca = async (id) => {
    const docRef = doc(db, "escala_ativa", id);
    await updateDoc(docRef, { status: "Online" });
};
