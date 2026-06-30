import { db } from './firebaseConfig.js';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, getDoc, getDocs, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Inicialização de metadados da interface
document.getElementById("data-atual").innerText = new Date().toLocaleDateString('pt-BR');

const tbody = document.getElementById("escala-body");

// Monitoramento em tempo real do banco de dados para renderização da tabela
onSnapshot(query(collection(db, "escala_ativa"), orderBy("ordem")), (snapshot) => {
    tbody.innerHTML = "";
    
    if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">Nenhuma escala ativa encontrada. Preencha os colaboradores abaixo e clique em Gerar Rodízio.</td></tr>`;
        return;
    }

    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const corStatus = d.status && d.status.startsWith("Online") ? "#28a745" : "#dc3545";
        
        // Extração dos colaboradores atuais desta linha para popular dinamicamente as pausas válidas
        const colaboradoresLinha = [
            d.original_pixbet || d.pixbet,
            d.original_bds || d.bds,
            d.original_betvip || d.betvip,
            d.original_ganhei || d.ganhei
        ].filter((value, index, self) => self.indexOf(value) === index && value);

        tbody.innerHTML += `
            <tr>
                <td class="text-bold">${d.horario}</td>
                <td>${d.pixbet}</td>
                <td>${d.bds}</td>
                <td>${d.betvip}</td>
                <td>${d.ganhei}</td>
                <td>
                    <div class="dropdown">
                        <button class="status-btn" style="background:${corStatus}">${d.status || 'Pausa'}</button>
                        <div class="dropdown-content">
                            <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Online')">✅ Check-in</a>
                            <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', 'Retorno')">🔙 Retorno</a>
                            ${colaboradoresLinha.map(nome => `
                                <a href="#" onclick="event.preventDefault(); window.gerenciarStatus('${docSnap.id}', '${nome}')">⏸️ Pausa: ${nome}</a>
                            `).join('')}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
});

// Função global para gerenciamento de pausas seletivas e redistribuição inteligente
window.gerenciarStatus = async (id, valor) => {
    const docRef = doc(db, "escala_ativa", id);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return;
    const d = snap.data();

    // Preserva os dados originais caso ainda não tenham sido salvos em um estado anterior de pausa
    const origPixbet = d.original_pixbet || d.pixbet;
    const origBds = d.original_bds || d.bds;
    const origBetvip = d.original_betvip || d.betvip;
    const origGanhei = d.original_ganhei || d.ganhei;

    if (valor === "Online") {
        await updateDoc(docRef, { status: "Online" });
    } 
    else if (valor === "Retorno") {
        // Restaura a escala original do turno selecionado
        await updateDoc(docRef, {
            pixbet: origPixbet,
            bds: origBds,
            betvip: origBetvip,
            ganhei: origGanhei,
            status: "Online"
        });
    } 
    else {
        // Coleta os colaboradores definidos originalmente para a linha e remove quem entrou de pausa
        const listaOriginal = [origPixbet, origBds, origBetvip, origGanhei];
        const ativos = listaOriginal.filter(nome => nome !== valor);
        
        // Aplica o cálculo matemático distribuindo as casas de forma justa apenas entre quem restou online
        let novaAlocacao = {};
        ["pixbet", "bds", "betvip", "ganhei"].forEach((casa, index) => {
            novaAlocacao[casa] = ativos[index % ativos.length];
        });
        
        await updateDoc(docRef, {
            ...novaAlocacao,
            original_pixbet: origPixbet,
            original_bds: origBds,
            original_betvip: origBetvip,
            original_ganhei: origGanhei,
            status: "Pausa: " + valor
        });
    }
};

// Lógica de Geração Automatizada do Rodízio de Turno
const btnGirar = document.getElementById("btn-girar");

if (btnGirar) {
    btnGirar.addEventListener("click", async () => {
        const n1 = document.getElementById("c1").value.trim() || "Leandro";
        const n2 = document.getElementById("c2").value.trim() || "Ivah";
        const n3 = document.getElementById("c3").value.trim() || "Tarcyla";
        const n4 = document.getElementById("c4").value.trim() || "Paloma";
        
        const colaboradores = [n1, n2, n3, n4];
        const horarios = ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"];
        
        // Limpeza prévia para evitar conflitos de índices antigos
        const querySnapshot = await getDocs(collection(db, "escala_ativa"));
        for (const docSnap of querySnapshot.docs) {
            await deleteDoc(doc(db, "escala_ativa", docSnap.id));
        }
        
        // Injeção estruturada com matriz rotativa de horários e casas de apostas
        for (let i = 0; i < horarios.length; i++) {
            const p1 = colaboradores[(i + 0) % 4];
            const p2 = colaboradores[(i + 1) % 4];
            const p3 = colaboradores[(i + 2) % 4];
            const p4 = colaboradores[(i + 3) % 4];
            
            await setDoc(doc(db, "escala_ativa", `turno_${i}`), {
                ordem: i,
                horario: horarios[i],
                pixbet: p1,
                bds: p2,
                betvip: p3,
                ganhei: p4,
                original_pixbet: p1,
                original_bds: p2,
                original_betvip: p3,
                original_ganhei: p4,
                status: "Online"
            });
        }
        alert("Escala gerada com sucesso!");
    });
}
    }
    
    // Injeção estruturada com matriz rotativa de horários e casas de apostas
    for (let i = 0; i < horarios.length; i++) {
        const p1 = colaboradores[(i + 0) % 4];
        const p2 = colaboradores[(i + 1) % 4];
        const p3 = colaboradores[(i + 2) % 4];
        const p4 = colaboradores[(i + 3) % 4];
        
        await setDoc(doc(db, "escala_ativa", `turno_${i}`), {
            ordem: i,
            horario: horarios[i],
            pixbet: p1,
            bds: p2,
            betvip: p3,
            ganhei: p4,
            original_pixbet: p1,
            original_bds: p2,
            original_betvip: p3,
            original_ganhei: p4,
            status: "Online"
        });
    }
});

// Ação para apagar a escala ativa operacional
document.getElementById("btn-limpar").addEventListener("click", async () => {
    if (confirm("Deseja redefinir e apagar toda a escala do turno atual?")) {
        const querySnapshot = await getDocs(collection(db, "escala_ativa"));
        for (const docSnap of querySnapshot.docs) {
            await deleteDoc(doc(db, "escala_ativa", docSnap.id));
        }
    }
});
