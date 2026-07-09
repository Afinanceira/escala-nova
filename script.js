import { db } from './firebaseConfig.js';
import { 
    collection, onSnapshot, doc, updateDoc, getDoc, setDoc, 
    query, orderBy, getDocs, deleteDoc, getDoc as getFirestoreDoc,
    writeBatch // Importação adicionada para o lote
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const SENHA_ADMIN = "1234";

// Inicializa a data atual
document.getElementById("data-atual").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");
const flashText = document.getElementById("flash-text");

// 1. Flash Report em tempo real
const flashRef = doc(db, "config", "flash_report");
onSnapshot(flashRef, (docSnap) => { 
    if (docSnap.exists()) flashText.value = docSnap.data().conteudo || ""; 
});
flashText.addEventListener("input", async (e) => { 
    await setDoc(flashRef, { conteudo: e.target.value }); 
});

// 2. Renderização da Escala (Listener Global)
const renderizarEscala = () => {
    onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
        tbody.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const colunas = ['pixbet', 'bds', 'betvip', 'ganhei'];
            const colabsLinha = [...new Set([d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei].filter(n => n && n.trim() !== ""))];
            
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
            tbody.insertAdjacentHTML('beforeend', linhaHTML);
        });
    });
};

// Inicia o monitoramento ao carregar
renderizarEscala();

window.checkin = async (id, col) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    await updateDoc(docRef, { [`checkin_${col}`]: d[`checkin_${col}`] === 'OK' ? 'Pendente' : 'OK' });
};

window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const d = (await getDoc(docRef)).data();
    const original = [d.original_pixbet, d.original_bds, d.original_betvip, d.original_ganhei];
    
    if (valor === "Online") {
        await updateDoc(docRef, { status: "Online" });
    } else if (valor === "Retorno") {
        await updateDoc(docRef, { 
            pixbet: d.original_pixbet, bds: d.original_bds, betvip: d.original_betvip, ganhei: d.original_ganhei, 
            status: "Online" 
        });
    } else {
        const ativos = [...new Set(original.filter(n => n !== valor && n && n.trim() !== ""))];
        const p = ativos.length;
        if (p === 0) return;

        let novaEscala = {};
        if (p === 1) {
            novaEscala = { pixbet: ativos[0], bds: ativos[0], betvip: ativos[0], ganhei: ativos[0] };
        } else if (p === 2) {
            novaEscala = { pixbet: ativos[0], bds: ativos[0], betvip: ativos[1], ganhei: ativos[1] };
        } else {
            novaEscala = { 
                pixbet: ativos[0 % p], bds: ativos[1 % p], betvip: ativos[2 % p], ganhei: ativos[3 % p] 
            };
        }
        await updateDoc(docRef, { ...novaEscala, status: "Pausa: " + valor });
    }
};

// 3. Geração de Rodízio com BATCH (Sincronização em tempo real otimizada)
document.getElementById("btn-girar").addEventListener("click", async () => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const logRef = doc(db, "config", "sorteio_log");
    const logSnap = await getFirestoreDoc(logRef);
    
    let dadosLog = logSnap.exists() && logSnap.data().data === dataHoje ? logSnap.data() : { data: dataHoje, contagem: 0 };

    if (dadosLog.contagem >= 2) {
        const senhaDigitada = prompt("Limite diário atingido. Digite a senha de administrador:");
        if (senhaDigitada !== SENHA_ADMIN) { alert("Acesso negado."); return; }
    }

    const inputs = [document.getElementById("c1").value, document.getElementById("c2").value, document.getElementById("c3").value, document.getElementById("c4").value];
    const colabs = inputs.filter(n => n && n.trim() !== "");
    const p = colabs.length;
    
    if (p === 0) { alert("Adicione colaboradores!"); return; }

    // Inicia o Batch para garantir que todos os clientes recebam a atualização juntos
    const batch = writeBatch(db);
    
    // Deleta os antigos
    const snaps = await getDocs(collection(db, "escala_ativa"));
    snaps.docs.forEach(s => batch.delete(s.ref));
    
    // Prepara os novos
    for (let i = 0; i < 8; i++) {
        let hora = (23 + i) % 24;
        let horarioFormatado = `${hora.toString().padStart(2, '0')}:00`;
        const novoDocRef = doc(collection(db, "escala_ativa"), `turno_${i}`);
        
        batch.set(novoDocRef, { 
            ordem: i, horario: horarioFormatado, 
            pixbet: colabs[i % p], bds: colabs[(i+1) % p], betvip: colabs[(i+2) % p], ganhei: colabs[(i+3) % p], 
            original_pixbet: colabs[i % p], original_bds: colabs[(i+1) % p], original_betvip: colabs[(i+2) % p], original_ganhei: colabs[(i+3) % p], 
            status: "Online" 
        });
    }

    // Executa tudo de uma vez
    await batch.commit();

    dadosLog.contagem += 1;
    await setDoc(logRef, dadosLog);
    alert(`Escala gerada com sucesso!`);
});

document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Apagar toda a escala?")) {
        const snaps = await getDocs(collection(db, "escala_ativa"));
        const batch = writeBatch(db);
        snaps.docs.forEach(s => batch.delete(s.ref));
        await batch.commit();
        alert("Escala limpa!");
    }
});
