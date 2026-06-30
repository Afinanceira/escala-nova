import { db } from './firebaseConfig.js';
import { 
    collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, getDocs, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const tbody = document.getElementById("escala-body");

// 1. Renderiza a tabela (Ordenada por ID/Ordem de criação)
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
        const d = doc.data();
        tbody.innerHTML += `
            <tr>
                <td>${d.horario}</td>
                <td>${d.pixbet}</td><td>${d.bds}</td><td>${d.betvip}</td><td>${d.ganhei}</td>
                <td><button onclick="window.confirmarPresenca('${doc.id}')" class="colaborador-btn ${d.status === 'Online' ? 'ativo' : ''}">${d.status || 'Pausa'}</button></td>
            </tr>
        `;
    });
});

// 2. Limpar Escala (Novo dia)
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if(!confirm("Tem certeza que deseja apagar toda a escala para um novo dia?")) return;
    const snapshot = await getDocs(collection(db, "escala_ativa"));
    snapshot.forEach(async (doc) => await deleteDoc(doc.ref));
    alert("Escala limpa!");
});

// 3. Botão Girar (Agora na ordem correta)
document.getElementById("btn-girar").addEventListener("click", async () => {
    let nomes = ["c1", "c2", "c3", "c4"].map(id => document.getElementById(id).value).filter(n => n.trim() !== "");
    const horas = ["23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00"];
    
    for (let i = 0; i < horas.length; i++) {
        let escala = {};
        for(let j=0; j<4; j++) escala[["pixbet", "bds", "betvip", "ganhei"][j]] = nomes[(i + j) % nomes.length];
        
        await setDoc(doc(db, "escala_ativa", `turno_${i}`), { 
            ...escala, status: "Pausa", horario: horas[i], ordem: i 
        });
    }
});

// 4. Pausa com Realocação
window.iniciarPausa = async () => {
    const nomePausa = document.getElementById("nome-pausa").value;
    const snapshot = await getDocs(collection(db, "escala_ativa"));
    const todos = ["c1", "c2", "c3", "c4"].map(id => document.getElementById(id)?.value).filter(n => n && n.trim() !== "");
    const ativos = todos.filter(n => n !== nomePausa);

    snapshot.forEach(async (doc) => {
        if (Object.values(doc.data()).includes(nomePausa)) {
            let novaEscala = {};
            ["pixbet", "bds", "betvip", "ganhei"].forEach((c, i) => novaEscala[c] = ativos[i % ativos.length]);
            await updateDoc(doc.ref, { ...novaEscala, status: "Pausa (" + nomePausa + ")" });
        }
    });
};

window.confirmarPresenca = async (id) => await updateDoc(doc(db, "escala_ativa", id), { status: "Online" });
