// ==========================================
// ESTADO DO JOGO (STATE)
// ==========================================
let game = {
    money: 0,
    level: 1,
    xp: 0,
    rebirths: 0,
    skin: 'default',
    lastSaveTime: Date.now(),
    upgrades: {
        clickPlus: { level: 0, baseCost: 10, costMult: 1.5 },
        clickMulti: { level: 0, baseCost: 500, costMult: 2.5 },
        autoClick: { level: 0, baseCost: 50, costMult: 1.8 },
        speedClick: { level: 0, baseCost: 200, costMult: 2.0 },
        offline: { level: 0, baseCost: 1000, costMult: 3.0 },
        crit: { level: 0, baseCost: 2500, costMult: 2.5 }
    }
};

let autoClickInterval;
let multiplicadorCompra = 1;
let contadorPobre = 0;
let comboAtual = 0;
let comboTimer = null;

// ==========================================
// INICIALIZAÇÃO E SALVAMENTO
// ==========================================
function init() {
    carregarJogo();
    calcularGanhosOffline();
    iniciarAutoClick();
    atualizarInterface();
    setInterval(salvarJogo, 10000); // Salva a cada 10 segundos
}

function salvarJogo() {
    game.lastSaveTime = Date.now();
    localStorage.setItem('clickerAutoSave', JSON.stringify(game));
}

function carregarJogo() {
    const save = localStorage.getItem('clickerAutoSave');
    if (save) {
        // Mescla o save com o objeto padrão para evitar erros se adicionar novos upgrades no futuro
        const savedGame = JSON.parse(save);
        game = { ...game, ...savedGame, upgrades: { ...game.upgrades, ...savedGame.upgrades } };
    }
    equiparSkin(game.skin);
}

function calcularGanhosOffline() {
    if (game.upgrades.offline.level > 0 && game.upgrades.autoClick.level > 0) {
        const agora = Date.now();
        const tempoForaEmSegundos = Math.floor((agora - game.lastSaveTime) / 1000);

        if (tempoForaEmSegundos > 60) { // Só mostra se ficou fora mais de 1 minuto
            const autoClickPorSegundo = calcularPoderAutoClick();
            // Nível de offline determina a % ganha (ex: lvl 1 = 10%, lvl 2 = 20%)
            const porcentagemOffline = Math.min(game.upgrades.offline.level * 0.1, 1.0); // Máx 100%

            const dinheiroGanho = Math.floor(tempoForaEmSegundos * autoClickPorSegundo * porcentagemOffline);

            if (dinheiroGanho > 0) {
                document.getElementById('offline-money-display').innerText = `$ ${dinheiroGanho.toLocaleString()}`;
                document.getElementById('modal-offline').style.display = 'flex';
                game.money += dinheiroGanho;
            }
        }
    }
}

function coletarOffline() {
    fecharModal('modal-offline');
    salvarJogo();
    atualizarInterface();
}

// ==========================================
// CÁLCULOS DE PODER
// ==========================================
function calcularPoderClique() {
    // Base 1 + (+1 por clickPlus)
    let poder = 1 + game.upgrades.clickPlus.level;

    // Multiplicador do x2 Clique (cada level dobra o base)
    if (game.upgrades.clickMulti.level > 0) {
        poder *= Math.pow(2, game.upgrades.clickMulti.level);
    }

    // Bônus de Rebirth (ex: 50% a mais por rebirth)
    const bonusRebirth = 1 + (game.rebirths * 0.5);

    return Math.floor(poder * bonusRebirth);
}

function calcularPoderAutoClick() {
    let poder = game.upgrades.autoClick.level;
    const bonusRebirth = 1 + (game.rebirths * 0.5);
    return Math.floor(poder * bonusRebirth);
}

function calcularIntervaloAutoClick() {
    // Base 1000ms, reduz conforme speedClick level (mínimo 100ms)
    let intervalo = 1000 - (game.upgrades.speedClick.level * 100);
    // Bônus do rebirth deixa ainda mais rápido
    intervalo -= (game.rebirths * 50);

    return Math.max(100, intervalo);
}

// ==========================================
// SISTEMA DE CLIQUE
// ==========================================
function clicarBotao(event) {
    let granaGanha = calcularPoderClique();
    let isCrit = false;

    // Chance de crítico (cada level da 10% chance de 5x mais dinheiro)
    if (game.upgrades.crit.level > 0) {
        const chanceCrit = Math.min(game.upgrades.crit.level * 0.1, 0.8); // máx 80%
        if (Math.random() < chanceCrit) {
            granaGanha *= 5;
            isCrit = true;
        }
    }

    game.money += granaGanha;
    ganharXP(1); // 1 clique = 1 de XP base

    // Lógica de Combo
    comboAtual++;
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
        comboAtual = 0;
        document.body.className = '';
        const audio = document.getElementById('meme-audio');
        if(audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }, 1000);
    atualizarCaosVisuais();

    // Efeitos Visuais
    animarBotao();
    criarDinheiroVoador(event, granaGanha, isCrit);

    atualizarInterface();
}

function atualizarCaosVisuais() {
    document.body.className = '';
    if (comboAtual >= 50) {
        document.body.classList.add('chaos-mode');
        const audio = document.getElementById('meme-audio');
        if (audio && audio.paused) audio.play();
    } else if (comboAtual >= 40) {
        document.body.classList.add('combo-40');
    } else if (comboAtual >= 30) {
        document.body.classList.add('combo-30');
    } else if (comboAtual >= 20) {
        document.body.classList.add('combo-20');
    } else if (comboAtual >= 10) {
        document.body.classList.add('combo-10');
    }
}

function animarBotao() {
    const btn = document.getElementById('main-click-btn');
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        btn.style.transform = 'scale(1)';
    }, 50);
}

function criarDinheiroVoador(event, valor, isCrit) {
    const container = document.getElementById('particles-container');
    const particle = document.createElement('div');

    particle.innerText = `+$${valor}`;
    particle.className = isCrit ? 'floating-money floating-crit' : 'floating-money';
    if (isCrit) particle.innerText = `CRÍTICO! +$${valor}`;

    // Posição baseada no clique, ou no centro se for auto-click (sem event)
    let x, y;
    if (event && event.clientX) {
        // Pega a posição relativa ao container de partículas
        const rect = container.getBoundingClientRect();
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;

        // Espalhamento aleatório sutil
        x += (Math.random() - 0.5) * 40;
    } else {
        // Centro do botão principal
        const btnRect = document.getElementById('main-click-btn').getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        x = (btnRect.left - containerRect.left) + (btnRect.width / 2) + ((Math.random() - 0.5) * 50);
        y = (btnRect.top - containerRect.top) + (btnRect.height / 2);
    }

    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;

    container.appendChild(particle);

    // Remove do DOM após a animação (1 segundo)
    setTimeout(() => {
        particle.remove();
    }, 1000);
}

// ==========================================
// SISTEMA DE LEVEL E XP
// ==========================================
function getXpNecessario() {
    return Math.floor(100 * Math.pow(1.5, game.level - 1));
}

function ganharXP(qtd) {
    // XP aumenta mais rápido com rebirths
    game.xp += qtd + (game.rebirths * 2);

    let xpNext = getXpNecessario();
    if (game.xp >= xpNext) {
        game.xp -= xpNext;
        game.level++;
        verificarDesbloqueios();
    }
}

function verificarDesbloqueios() {
    // Verifica se atingiu condições para Rebirth (ex: lvl 50 ou mt dinheiro)
    // Aqui usaremos Level 30 como requisito de exemplo para o botão aparecer
    if (game.level >= 30) {
        document.getElementById('btn-rebirth').style.display = 'inline-block';
    }
}

// ==========================================
// SISTEMA DE LOJA
// ==========================================
function setMultiplier(val) {
    multiplicadorCompra = val;
    // Atualiza botões
    document.querySelectorAll('.btn-mult').forEach(b => b.classList.remove('active'));
    // Encontra o botão certo baseado no texto
    document.querySelectorAll('.btn-mult').forEach(b => {
        if(b.innerText === val + 'x' || b.innerText === val) {
            b.classList.add('active');
        }
    });
    atualizarInterface();
}

function getCustoUpgradeInfo(upgradeId) {
    const upg = game.upgrades[upgradeId];
    let custoTotal = 0;
    let quantidade = 0;
    let custoAtual = Math.floor(upg.baseCost * Math.pow(upg.costMult, upg.level));
    let dinheiroRestante = game.money;

    if (multiplicadorCompra === 'MAX') {
        while (dinheiroRestante >= custoAtual) {
            custoTotal += custoAtual;
            dinheiroRestante -= custoAtual;
            quantidade++;
            custoAtual = Math.floor(upg.baseCost * Math.pow(upg.costMult, upg.level + quantidade));
        }
        if (quantidade === 0) { // Não pode comprar nenhum, mostra o custo de 1
            custoTotal = custoAtual;
            quantidade = 1;
        }
    } else {
        for (let i = 0; i < multiplicadorCompra; i++) {
            custoTotal += Math.floor(upg.baseCost * Math.pow(upg.costMult, upg.level + i));
        }
        quantidade = multiplicadorCompra;
    }
    return { custoTotal, quantidade };
}

function comprarUpgrade(upgradeId) {
    const info = getCustoUpgradeInfo(upgradeId);

    if (game.money >= info.custoTotal) {
        game.money -= info.custoTotal;
        game.upgrades[upgradeId].level += info.quantidade;
        contadorPobre = 0; // reset

        // Se comprou auto-clicker ou speed, reinicia o loop
        if (upgradeId === 'autoClick' || upgradeId === 'speedClick') {
            iniciarAutoClick();
        }

        atualizarInterface();
    } else {
        contadorPobre++;
        mostrarMensagemPobre();
    }
}

function mostrarMensagemPobre() {
    const msgs = [
        "",
        "vc é pobre....",
        "de novo vc é pobre...",
        "tres vezes? vc nao tem dinheiro!",
        "chega....",
        "PARA, VC NAO TEM DINHEIRO, VC É LERDO??",
        "CARALHO, VC É CRIANÇA",
        "67???💀💀💀",
        "mano...",
        "CHEGA CARALHO",
        "stop💔💔😭😭"
    ];
    let msg = msgs[contadorPobre] || "stop💔💔😭😭";
    if (contadorPobre >= 10) contadorPobre = 0;

    const container = document.getElementById('chaos-messages-container');
    const el = document.createElement('div');
    el.className = 'poor-msg';
    el.innerText = msg;
    el.style.left = (Math.random() * 50 + 10) + '%';
    el.style.top = (Math.random() * 50 + 10) + '%';
    container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

function iniciarAutoClick() {
    clearInterval(autoClickInterval);
    if (game.upgrades.autoClick.level > 0) {
        autoClickInterval = setInterval(() => {
            const granaGanha = calcularPoderAutoClick();
            game.money += granaGanha;
            ganharXP(0.5); // auto click da metade do XP
            criarDinheiroVoador(null, granaGanha, false);
            atualizarInterface();
        }, calcularIntervaloAutoClick());
    }
}

// ==========================================
// SISTEMA DE REBIRTH
// ==========================================
function fazerRebirth() {
    // Só permite rebirth se for level 30+ e tiver pelo menos 1M
    if (game.level >= 30) {
        // Animação épica
        const flash = document.getElementById('rebirth-flash');
        flash.classList.add('rebirth-active');

        setTimeout(() => {
            // Lógica de reset
            game.rebirths++;
            game.money = 0;
            game.level = 1;
            game.xp = 0;
            // Reseta níveis de upgrades
            for (let key in game.upgrades) {
                game.upgrades[key].level = 0;
            }

            iniciarAutoClick();
            verificarDesbloqueios(); // Esconde o botão de rebirth
            atualizarInterface();
            salvarJogo();

            setTimeout(() => {
                flash.classList.remove('rebirth-active');
            }, 2000);
        }, 1000);
    } else {
        alert("Você precisa do Nível 30 para fazer Rebirth!");
    }
}

// ==========================================
// SISTEMA DE SKINS
// ==========================================
function equiparSkin(skinId) {
    const btn = document.getElementById('main-click-btn');

    // Remove as classes de skin anteriores
    btn.className = "main-btn";

    // Adiciona a nova
    btn.classList.add(`skin-${skinId}`);
    game.skin = skinId;
    salvarJogo();
}

function checarSkinsDesbloqueadas() {
    // Lógica para destravar visualmente no modal
    const lvl = game.level;
    const rb = game.rebirths;

    function trava(id, condition) {
        const el = document.getElementById(id);
        if (condition) {
            el.classList.remove('locked');
            el.innerHTML = el.innerHTML.split('(')[0]; // Remove texto de requisito
        } else {
            el.classList.add('locked');
        }
    }

    trava('skin-lock-ouro', lvl >= 5);
    trava('skin-lock-neon', lvl >= 10);
    trava('skin-lock-fogo', lvl >= 20);
    trava('skin-lock-galaxy', rb >= 1);
    trava('skin-lock-hacker', rb >= 3);
    
    // Skins do Caos
    trava('skin-lock-sorriso', lvl >= 25);
    trava('skin-lock-horror', lvl >= 35);
    trava('skin-lock-fogo-azul', lvl >= 45);
    trava('skin-lock-67chaos', lvl >= 67);
    trava('skin-lock-lava', lvl >= 80);
    trava('skin-lock-frio-aura', lvl >= 90);
    trava('skin-lock-led-neon', lvl >= 100);
    trava('skin-lock-rgb-dance', rb >= 2);
    trava('skin-lock-radioactive', rb >= 4);
    trava('skin-lock-ice-crystal', rb >= 5);
    trava('skin-lock-dragon', rb >= 6);
    trava('skin-lock-cursed', rb >= 7);
}

// ==========================================
// ATUALIZAÇÃO DA INTERFACE (UI)
// ==========================================
function atualizarInterface() {
    // Textos principais
    document.getElementById('money-display').innerText = `$ ${game.money.toLocaleString()}`;
    document.getElementById('level-display').innerText = game.level;

    // XP Bar
    const xpNext = getXpNecessario();
    document.getElementById('xp-display').innerText = Math.floor(game.xp).toLocaleString();
    document.getElementById('xp-next-display').innerText = xpNext.toLocaleString();

    const porcentagemXp = (game.xp / xpNext) * 100;
    document.getElementById('xp-bar').style.width = `${porcentagemXp}%`;

    // Rebirth stats
    if (game.rebirths > 0) {
        document.getElementById('rebirth-container').style.display = 'flex';
        document.getElementById('rebirth-display').innerText = game.rebirths;
        document.getElementById('rebirth-bonus-display').innerText = `(+${game.rebirths * 50}% bônus)`;
    }

    // Botão de Rebirth só aparece no lvl 30
    if (game.level >= 30) {
        document.getElementById('btn-rebirth').style.display = 'inline-block';
    } else {
        document.getElementById('btn-rebirth').style.display = 'none';
    }

    // Atualiza Loja
    const upgradesIds = ['clickPlus', 'clickMulti', 'autoClick', 'speedClick', 'offline', 'crit'];

    upgradesIds.forEach(id => {
        const info = getCustoUpgradeInfo(id);
        const custo = info.custoTotal;
        const level = game.upgrades[id].level;

        // Elementos html: lvl-ID, cost-ID, btn-buy-ID
        // Usar kebab-case pro HTML (ex: clickPlus -> click-plus)
        const idHtml = id.replace(/([A-Z])/g, "-$1").toLowerCase();

        document.getElementById(`lvl-${idHtml}`).innerText = level + (info.quantidade > 1 ? ` (+${info.quantidade})` : '');
        document.getElementById(`cost-${idHtml}`).innerText = custo.toLocaleString();

        const btnBuy = document.getElementById(`btn-buy-${idHtml}`);
        if (game.money >= custo) {
            btnBuy.classList.add('can-buy');
        } else {
            btnBuy.classList.remove('can-buy');
        }
    });

    checarSkinsDesbloqueadas();
}

// ==========================================
// FUNÇÕES DE MODAL E HUMOR
// ==========================================
function abrirModalSkins() {
    document.getElementById('modal-skins').style.display = 'flex';
    checarSkinsDesbloqueadas();
}

function abrirModalSair() {
    document.getElementById('modal-sair').style.display = 'flex';
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

function sairDeVerdade() {
    window.location.href = "https://www.google.com/search?q=como+parar+de+ser+um+desistente";
}

function trollExit() {
    const btn = document.getElementById('btn-troll-exit');
    btn.innerText = "MORRA 😡";
    btn.classList.remove('btn-green');
    btn.classList.add('btn-red');
    
    setTimeout(() => {
        window.open("https://www.youtube.com/watch?v=Cbus9b1OlBc", "_blank");
        fecharModal('modal-sair');
        
        // reseta o botão para a próxima vez
        setTimeout(() => {
            btn.innerText = "não = continua jogar :)💖";
            btn.classList.remove('btn-red');
            btn.classList.add('btn-green');
        }, 500);
    }, 1000);
}

// Inicializa o jogo ao carregar a página
window.onload = init;
