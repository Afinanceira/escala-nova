document.getElementById("btn-girar").addEventListener("click", async () => {
    const nomes = [
        document.getElementById("c1").value,
        document.getElementById("c2").value,
        document.getElementById("c3").value,
        document.getElementById("c4").value
    ].filter(n => n !== ""); // Remove campos vazios

    if (nomes.length < 4) return alert("Preencha os 4 nomes!");

    // Algoritmo de rodízio: Para cada hora, rotacionamos a lista
    const horas = ["23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"];
    
    for (let i = 0; i < horas.length; i++) {
        // Rotaciona a lista a cada hora
        const rodizio = [...nomes.slice(i % 4), ...nomes.slice(0, i % 4)];
        
        // Salva cada hora como um documento no Firebase
        await setDoc(doc(db, "escala_ativa", `turno_${horas[i].replace(":", "")}`), {
            horario: horas[i],
            pixbet: rodizio[0],
            bds: rodizio[1],
            betvip: rodizio[2],
            ganhei: rodizio[3],
            discord: "Todos",
            status: "-"
        });
    }
    alert("Rodízio gerado com sucesso!");
});
