/* ══════════════════════════════════════════════════════════
   IMPORTS — Firebase App
══════════════════════════════════════════════════════════ */
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

/* ── Firebase Auth ──────────────────────────────────────── */
import {
  getAuth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── Firebase Firestore ─────────────────────────────────── */
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════════
   FIREBASE CONFIG
══════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyDUSDpICxBNNCd4-tgTBCAj6TcYTX4fljI",
    authDomain: "gafila-hackathon.firebaseapp.com",
    projectId: "gafila-hackathon",
    storageBucket: "gafila-hackathon.firebasestorage.app",
    messagingSenderId: "666654710488",
    appId: "1:666654710488:web:3d5b3c64a6304e252395ad",
    measurementId: "G-CXTHG11B6Z"
};

/* ══════════════════════════════════════════════════════════
   INICIALIZAÇÃO DO FIREBASE
══════════════════════════════════════════════════════════ */
let app  = null;
let auth = null;
let db   = null;

try {
  app  = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);
} catch (e) {
  console.warn("GaFila: Falha ao inicializar Firebase →", e.message);
}

/* ══════════════════════════════════════════════════════════
   ESTADO GLOBAL
══════════════════════════════════════════════════════════ */
let STATE = {
  userType:      null,   
  userUID:       null,
  userData:      {},    
  meuNumero:     null,  
  meuTipo:       null,
  foiAtendido:   false,
  filaPrincipal: [],
  filaRepeticao: [],
  numeroAtual:   1,
  atendidos:     0,
  unsubFila:     null,
};

/* ══════════════════════════════════════════════════════════
   MODO DEMONSTRAÇÃO
══════════════════════════════════════════════════════════ */
let DEMO_MODE = !app;

let DEMO_DB = {
  filaPrincipal: [],
  filaRepeticao: [],
  numeroAtual:   1,
  atendidos:     0,
  chamandoAgora: null,
};

let _demoListeners = [];

function enableDemoMode() {
  DEMO_MODE = true;
  console.info("GaFila: Modo demonstração ativo (sem Firebase).");
}

function demoSubscribe(callback) {
  callback({ ...DEMO_DB });
  _demoListeners.push(callback);
  return () => { _demoListeners = _demoListeners.filter(l => l !== callback); };
}

function demoNotify() {
  _demoListeners.forEach(cb => cb({ ...DEMO_DB }));
}

/* ══════════════════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  if (!app) enableDemoMode();
  hideSplash();
  showPage("login");
});

/* ══════════════════════════════════════════════════════════
   SPLASH / NAVEGAÇÃO
══════════════════════════════════════════════════════════ */

function hideSplash() {
  const splash = document.getElementById("splash-screen");
  // A animação CSS splashFadeOut já oculta visualmente em 2.2s;
  // adicionamos .hidden após o fim para liberar o layout.
  setTimeout(() => splash?.classList.add("hidden"), 2700);
}

function showPage(page) {
  ["login", "aluno", "func"].forEach(p => {
    document.getElementById("page-" + p)?.classList.add("hidden");
  });
  document.getElementById("page-" + page)?.classList.remove("hidden");
}

/* ══════════════════════════════════════════════════════════
   ABAS DE NAVEGAÇÃO INFERIOR
══════════════════════════════════════════════════════════ */

/**
 * @param {"aluno"|"func"} userType
 * @param {"inicio"|"fila"|"perfil"} tab
 */
function switchTab(userType, tab) {
  ["inicio", "fila", "perfil"].forEach(t => {
    document.getElementById(`tab-${userType}-${t}`)?.classList.add("hidden");
  });
  document.getElementById(`tab-${userType}-${tab}`)?.classList.remove("hidden");

  document.getElementById(`nav-${userType}`)
    ?.querySelectorAll(".nav-btn")
    .forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
}

/* ══════════════════════════════════════════════════════════
   LOGIN — FORMULÁRIOS
══════════════════════════════════════════════════════════ */

let _loginMode = "login";
let _loginType = "aluno";

function showMainLogin() {
  hide("login-card-aluno");
  hide("login-card-func");
  show("login-card-main");
}

function showLoginForm(type, mode) {
  _loginType = type;
  _loginMode = mode;
  hide("login-card-main");

  if (type === "aluno") {
    show("login-card-aluno");
    document.getElementById("form-aluno-title").textContent =
      mode === "login" ? "Login — Aluno" : "Registrar — Aluno";
    document.getElementById("btn-aluno-submit").textContent =
      mode === "login" ? "Entrar" : "Criar conta";
  } else {
    show("login-card-func");
    document.getElementById("form-func-title").textContent =
      mode === "login" ? "Login — Funcionário" : "Registrar — Funcionário";
    document.getElementById("btn-func-submit").textContent =
      mode === "login" ? "Entrar" : "Criar conta";
  }
}

async function submitAluno() {
  const nome  = document.getElementById("aluno-nome").value.trim();
  const rm    = document.getElementById("aluno-rm").value.trim();
  const senha = document.getElementById("aluno-senha").value;
  const errEl = document.getElementById("aluno-error");

  clearError(errEl);

  if (!nome || !rm || !senha) return showError(errEl, "Preencha todos os campos.");
  if (senha.length < 6)       return showError(errEl, "Senha deve ter ao menos 6 caracteres.");

  const email = `aluno-${rm.replace(/\s/g, "")}@gafila.app`;

  setLoading("btn-aluno-submit", true);
  try {
    if (_loginMode === "register") await registrarAluno(email, senha, nome, rm);
    else                           await loginAluno(email, senha, nome, rm);
  } catch (e) {
    showError(errEl, traduzirErroFirebase(e.code || e.message));
  } finally {
    setLoading("btn-aluno-submit", false);
  }
}

async function registrarAluno(email, senha, nome, rm) {
  if (DEMO_MODE) {
    Object.assign(STATE, { userType: "aluno", userData: { nome, rm }, userUID: "demo-" + Date.now() });
    return entrarComoAluno();
  }

  const cred = await createUserWithEmailAndPassword(auth, email, senha);

  await setDoc(doc(db, "usuarios", cred.user.uid), {
    tipo: "aluno", nome, rm,
    criadoEm: new Date().toISOString(),
  });

  Object.assign(STATE, { userType: "aluno", userData: { nome, rm }, userUID: cred.user.uid });
  entrarComoAluno();
}

async function loginAluno(email, senha, nome, rm) {
  if (DEMO_MODE) {
    Object.assign(STATE, {
      userType: "aluno",
      userData: { nome: nome || "Aluno Demo", rm: rm || "000000" },
      userUID: "demo-" + Date.now(),
    });
    return entrarComoAluno();
  }

  const cred = await signInWithEmailAndPassword(auth, email, senha);

  const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
  const data = snap.exists() ? snap.data() : { nome, rm };

  Object.assign(STATE, { userType: "aluno", userData: { nome: data.nome, rm: data.rm }, userUID: cred.user.uid });
  entrarComoAluno();
}

async function submitFunc() {
  const nome  = document.getElementById("func-nome").value.trim();
  const cpf   = document.getElementById("func-doc").value.trim();
  const senha = document.getElementById("func-senha").value;
  const errEl = document.getElementById("func-error");

  clearError(errEl);

  if (!nome || !cpf || !senha) return showError(errEl, "Preencha todos os campos.");
  if (senha.length < 6)        return showError(errEl, "Senha deve ter ao menos 6 caracteres.");

  const email = `func-${cpf.replace(/\D/g, "")}@gafila.app`;

  setLoading("btn-func-submit", true);
  try {
    if (_loginMode === "register") await registrarFunc(email, senha, nome, cpf);
    else                           await loginFunc(email, senha, nome, cpf);
  } catch (e) {
    showError(errEl, traduzirErroFirebase(e.code || e.message));
  } finally {
    setLoading("btn-func-submit", false);
  }
}

async function registrarFunc(email, senha, nome, cpf) {
  if (DEMO_MODE) {
    Object.assign(STATE, { userType: "funcionario", userData: { nome, cpf }, userUID: "demo-func-" + Date.now() });
    return entrarComoFunc();
  }

  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await setDoc(doc(db, "usuarios", cred.user.uid), {
    tipo: "funcionario", nome, cpf,
    criadoEm: new Date().toISOString(),
  });

  Object.assign(STATE, { userType: "funcionario", userData: { nome, cpf }, userUID: cred.user.uid });
  entrarComoFunc();
}

async function loginFunc(email, senha, nome, cpf) {
  if (DEMO_MODE) {
    Object.assign(STATE, {
      userType: "funcionario",
      userData: { nome: nome || "Funcionário Demo", cpf: cpf || "000.000.000-00" },
      userUID: "demo-func-" + Date.now(),
    });
    return entrarComoFunc();
  }

  const cred = await signInWithEmailAndPassword(auth, email, senha);
  const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
  const data = snap.exists() ? snap.data() : { nome, cpf };

  Object.assign(STATE, { userType: "funcionario", userData: { nome: data.nome, cpf: data.cpf }, userUID: cred.user.uid });
  entrarComoFunc();
}

async function loginAnonymous() {
  if (DEMO_MODE) {
    Object.assign(STATE, {
      userType: "guest",
      userData: { nome: "Visitante", rm: "—" },
      userUID: "guest-" + Date.now(),
    });
    return entrarComoAluno();
  }

  try {
    // v9 modular: signInAnonymously(auth)
    const cred = await signInAnonymously(auth);
    Object.assign(STATE, {
      userType: "guest",
      userData: { nome: "Visitante", rm: "—" },
      userUID: cred.user.uid,
    });
    entrarComoAluno();
  } catch (e) {
    enableDemoMode();
    Object.assign(STATE, {
      userType: "guest",
      userData: { nome: "Visitante", rm: "—" },
      userUID: "guest-" + Date.now(),
    });
    entrarComoAluno();
  }
}

async function doLogout() {
  if (STATE.meuNumero !== null) await sairDaFila();

  if (STATE.unsubFila) {
    STATE.unsubFila();
    STATE.unsubFila = null;
  }

  if (!DEMO_MODE && auth) {
    try { await signOut(auth); } catch (_) {}
  }

  STATE = {
    userType: null, userUID: null, userData: {},
    meuNumero: null, meuTipo: null, foiAtendido: false,
    filaPrincipal: [], filaRepeticao: [],
    numeroAtual: 1, atendidos: 0, unsubFila: null,
  };

  showPage("login");
  showMainLogin();
  showToast("Você saiu da conta 👋", "👋");
}

async function changePassword() {
  const newPass     = document.getElementById("new-pass").value;
  const confirmPass = document.getElementById("confirm-pass").value;
  const errEl       = document.getElementById("pass-error");

  clearError(errEl);

  if (newPass.length < 6)      return showError(errEl, "Senha deve ter ao menos 6 caracteres.");
  if (newPass !== confirmPass)  return showError(errEl, "As senhas não coincidem.");

  if (DEMO_MODE) {
    closePopup("popup-change-pass");
    return showToast("Senha alterada com sucesso! 🔒", "✅");
  }

  try {
    await updatePassword(auth.currentUser, newPass);
    closePopup("popup-change-pass");
    showToast("Senha alterada com sucesso! 🔒", "✅");
  } catch (e) {
    showError(errEl, traduzirErroFirebase(e.code));
  }
}

/* ══════════════════════════════════════════════════════════
   ENTRAR NAS PÁGINAS
══════════════════════════════════════════════════════════ */

function entrarComoAluno() {
  const { nome = "Visitante", rm = "—" } = STATE.userData;

  setText("aluno-welcome-name",  nome);
  setText("aluno-profile-name",  nome);
  setText("aluno-profile-rm",    "RM: " + rm);
  setText("aluno-avatar-initial", nome.charAt(0).toUpperCase());
  setText("aluno-avatar-big",     nome.charAt(0).toUpperCase());

  STATE.meuNumero   = null;
  STATE.meuTipo     = null;
  STATE.foiAtendido = false;
  atualizarStatusFila();

  iniciarListenerFila();
  showPage("aluno");
  switchTab("aluno", "inicio");
}

function entrarComoFunc() {
  const { nome = "Funcionário", cpf = "—" } = STATE.userData;

  setText("func-welcome-name",   nome);
  setText("func-profile-name",   nome);
  setText("func-profile-doc",    "CPF/RG: " + cpf);
  setText("func-avatar-initial", nome.charAt(0).toUpperCase());
  setText("func-avatar-big",     nome.charAt(0).toUpperCase());

  iniciarListenerFila();
  showPage("func");
  switchTab("func", "inicio");
}

/* ══════════════════════════════════════════════════════════
   FIRESTORE — LISTENER EM TEMPO REAL
══════════════════════════════════════════════════════════ */

function iniciarListenerFila() {
  // Cancela listener anterior, se houver
  if (STATE.unsubFila) STATE.unsubFila();

  if (DEMO_MODE) {
    STATE.unsubFila = demoSubscribe(dados => onFilaUpdate(dados));
    return;
  }

  if (!db) return;

  // v9 modular: onSnapshot(docRef, successCb, errorCb)
  const filaRef = doc(db, "gafila", "fila");

  STATE.unsubFila = onSnapshot(
    filaRef,
    (snap) => {
      if (snap.exists()) {
        onFilaUpdate(snap.data());
      } else {
        // Documento ainda não existe — cria a estrutura inicial
        initFirestoreDoc();
      }
    },
    (err) => {
      console.warn("GaFila: Firestore onSnapshot error →", err.code);
      // Fallback para demo se as regras negarem ou rede cair
      enableDemoMode();
      STATE.unsubFila = demoSubscribe(dados => onFilaUpdate(dados));
    }
  );
}

async function initFirestoreDoc() {
  if (!db) return;
  // v9 modular: setDoc(doc(db, colecao, id), dados)
  await setDoc(doc(db, "gafila", "fila"), {
    filaPrincipal: [],
    filaRepeticao: [],
    numeroAtual:   1,
    atendidos:     0,
    chamandoAgora: null,
  });
}

/**
 * Chamada sempre que o Firestore (ou demo) emite novos dados.
 * Atualiza STATE e redesenha a UI.
 * @param {Object} dados — snapshot do documento "gafila/fila"
 */
function onFilaUpdate(dados) {
  STATE.filaPrincipal = dados.filaPrincipal || [];
  STATE.filaRepeticao = dados.filaRepeticao || [];
  STATE.numeroAtual   = dados.numeroAtual   || 1;
  STATE.atendidos     = dados.atendidos     || 0;

  if (dados.chamandoAgora && STATE.meuNumero !== null) {
    if (dados.chamandoAgora === STATE.meuNumero) {
      STATE.foiAtendido = true;
      STATE.meuNumero   = null;
      STATE.meuTipo     = null;
      notificarSuaVez(dados.chamandoAgora);
    }
  }

  renderizarFila();
  atualizarStatusFila();
  atualizarPainelFunc(dados);
}

/* ══════════════════════════════════════════════════════════
   LÓGICA DA FILA
══════════════════════════════════════════════════════════ */

/**
 * Aluno entra na fila principal ou de repetição.
 * @param {"principal"|"repeticao"} tipo
 */
async function entrarFila(tipo) {
  if (STATE.meuNumero !== null)         return showToast("Você já está na fila!", "⚠️");
  if (STATE.userType === "funcionario") return showToast("Funcionários não entram na fila.", "⚠️");

  const numero = String(STATE.numeroAtual).padStart(2, "0");
  const item   = {
    uid:    STATE.userUID,
    numero,
    nome:   STATE.userData.nome || "Visitante",
    tipo,
  };

  STATE.meuNumero = numero;
  STATE.meuTipo   = tipo;

  if (DEMO_MODE) {
    const campo     = tipo === "principal" ? "filaPrincipal" : "filaRepeticao";
    DEMO_DB[campo]       = [...DEMO_DB[campo], item];
    DEMO_DB.numeroAtual  = STATE.numeroAtual + 1;
    demoNotify();
    return showToast(`Você entrou na fila! Senha: ${numero} 🎟️`, "✅");
  }

  if (!db) return;

  try {
    const campo = tipo === "principal" ? "filaPrincipal" : "filaRepeticao";
    // v9 modular: updateDoc + arrayUnion
    await updateDoc(doc(db, "gafila", "fila"), {
      [campo]:     arrayUnion(item),
      numeroAtual: STATE.numeroAtual + 1,
    });
    showToast(`Você entrou na fila! Senha: ${numero} 🎟️`, "✅");
  } catch (e) {
    STATE.meuNumero = null;
    STATE.meuTipo   = null;
    console.error(e);
    showToast("Erro ao entrar na fila. Tente novamente.", "❌");
  }
}

async function sairDaFila() {
  if (STATE.meuNumero === null) return;

  const tipo  = STATE.meuTipo;
  const campo = tipo === "principal" ? "filaPrincipal" : "filaRepeticao";
  const fila  = tipo === "principal" ? STATE.filaPrincipal : STATE.filaRepeticao;
  const item  = fila.find(i => i.uid === STATE.userUID);
  if (!item) return;

  if (DEMO_MODE) {
    DEMO_DB[campo] = DEMO_DB[campo].filter(i => i.uid !== STATE.userUID);
    demoNotify();
    STATE.meuNumero = null;
    STATE.meuTipo   = null;
    return;
  }

  if (!db) return;

  try {
    // v9 modular: arrayRemove remove o objeto exato do array Firestore
    await updateDoc(doc(db, "gafila", "fila"), { [campo]: arrayRemove(item) });
    STATE.meuNumero = null;
    STATE.meuTipo   = null;
  } catch (e) { console.error(e); }
}

async function chamarProximo() {
  if (STATE.userType !== "funcionario") return;

  const usaPrincipal = STATE.filaPrincipal.length > 0;
  const fila         = usaPrincipal ? STATE.filaPrincipal : STATE.filaRepeticao;

  if (fila.length === 0) return showToast("A fila está vazia!", "🎉");

  const proximo = fila[0];
  const campo   = usaPrincipal ? "filaPrincipal" : "filaRepeticao";

  if (DEMO_MODE) {
    DEMO_DB[campo]        = DEMO_DB[campo].slice(1);
    DEMO_DB.atendidos++;
    DEMO_DB.chamandoAgora = proximo.numero;
    onFilaUpdate({ ...DEMO_DB });
    return showToast(`Chamando senha ${proximo.numero} — ${proximo.nome}`, "📣");
  }

  if (!db) return;

  try {
    // v9 modular: updateDoc + arrayRemove
    await updateDoc(doc(db, "gafila", "fila"), {
      [campo]:       arrayRemove(proximo),
      chamandoAgora: proximo.numero,
      atendidos:     STATE.atendidos + 1,
    });
    showToast(`Chamando senha ${proximo.numero} — ${proximo.nome}`, "📣");
  } catch (e) {
    console.error(e);
    showToast("Erro ao chamar próximo.", "❌");
  }
}

/* ══════════════════════════════════════════════════════════
   RENDERIZAÇÃO DA FILA
══════════════════════════════════════════════════════════ */

function renderizarFila() {
  // Listas na aba do aluno
  renderFila(STATE.filaPrincipal, "ql-principal",  "ql-principal-empty",  false);
  renderFila(STATE.filaRepeticao, "ql-repeticao",  "ql-repeticao-empty",  false);
  renderFila(STATE.filaPrincipal, "fql-principal", "fql-principal-empty", true);
  renderFila(STATE.filaRepeticao, "fql-repeticao", "fql-repeticao-empty", true);
}

/**
 * @param {Array}   fila
 * @param {string}  listId
 * @param {string}  emptyId
 * @param {boolean} isFunc
 */
function renderFila(fila, listId, emptyId, isFunc) {
  const listEl  = document.getElementById(listId);
  const emptyEl = document.getElementById(emptyId);
  if (!listEl || !emptyEl) return;

  if (fila.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  listEl.innerHTML = fila.map((item, idx) => {
    const isMe    = !isFunc && item.uid === STATE.userUID;
    const isNext  = idx === 0 && isFunc;
    const classes = ["queue-item", isMe ? "my-item" : "", isNext ? "current-item" : ""].join(" ").trim();
    const tagHtml = isMe   ? `<span class="queue-item-tag tag-you">Você</span>`
                  : isNext ? `<span class="queue-item-tag tag-now">Próximo</span>`
                  :          `<span class="queue-item-tag tag-wait">#${idx + 1}</span>`;

    return `
      <div class="${classes}">
        <div class="queue-item-num">${item.numero}</div>
        <div class="queue-item-info">
          <div class="queue-item-name">${escapeHtml(item.nome)}</div>
          <div class="queue-item-sub">Senha ${item.numero}</div>
        </div>
        ${tagHtml}
      </div>`;
  }).join("");
}

/* ══════════════════════════════════════════════════════════
   PAINEL DO ALUNO
══════════════════════════════════════════════════════════ */

function atualizarStatusFila() {
  const iconEl   = document.getElementById("aluno-queue-icon");
  const textEl   = document.getElementById("aluno-queue-text");
  const numEl    = document.getElementById("aluno-queue-num");
  const posEl    = document.getElementById("aluno-queue-pos");
  const curNumEl = document.getElementById("aluno-current-num");

  const proxima = STATE.filaPrincipal[0]?.numero
               ?? STATE.filaRepeticao[0]?.numero
               ?? "—";
  if (curNumEl) curNumEl.textContent = proxima;

  if (STATE.foiAtendido && STATE.meuNumero === null) {
    if (iconEl) iconEl.textContent = "✅";
    if (textEl) textEl.textContent = "Você já fez seu pedido!";
    hide("aluno-queue-badge");
    hide("aluno-queue-pos-wrap");
    hide("btn-enter-queue");
    show("btn-enter-repet");

  } else if (STATE.meuNumero !== null) {
    const fila     = STATE.meuTipo === "principal" ? STATE.filaPrincipal : STATE.filaRepeticao;
    const posIndex = fila.findIndex(i => i.uid === STATE.userUID);
    const pos      = posIndex >= 0 ? posIndex + 1 : "—";

    if (iconEl) iconEl.textContent = "🎟️";
    if (textEl) textEl.textContent = STATE.meuTipo === "repeticao"
      ? "Você está na fila de repetição"
      : "Você está na fila";

    show("aluno-queue-badge");
    if (numEl) numEl.textContent = STATE.meuNumero;
    show("aluno-queue-pos-wrap");
    if (posEl) posEl.textContent = pos === 1 ? "Próximo! 🎉" : `${pos}º lugar`;
    hide("btn-enter-queue");
    hide("btn-enter-repet");

  } else {
    if (iconEl) iconEl.textContent = "🕐";
    if (textEl) textEl.textContent = "Entre na fila para iniciar a contagem";
    hide("aluno-queue-badge");
    hide("aluno-queue-pos-wrap");
    show("btn-enter-queue");
    hide("btn-enter-repet");
  }
}

/* ══════════════════════════════════════════════════════════
   PAINEL DO FUNCIONÁRIO
══════════════════════════════════════════════════════════ */

function atualizarPainelFunc(dados) {
  const total  = STATE.filaPrincipal.length + STATE.filaRepeticao.length;
  const numEl  = document.getElementById("func-current-num");
  const typeEl = document.getElementById("func-call-type");

  setText("stat-principal-count", STATE.filaPrincipal.length);
  setText("stat-repet-count",     STATE.filaRepeticao.length);
  setText("stat-atendidos",       STATE.atendidos);
  setText("func-queue-total",     `Total: ${total} aluno${total !== 1 ? "s" : ""}`);

  if (dados?.chamandoAgora) {
    show("func-call-active");
    hide("func-call-empty");
    if (numEl)  numEl.textContent  = dados.chamandoAgora;
    if (typeEl) typeEl.textContent = STATE.filaPrincipal.length > 0 ? "Principal" : "Repetição";
  } else if (total > 0) {
 
    show("func-call-empty");
    hide("func-call-active");
    const emptyEl = document.getElementById("func-call-empty");
    const p    = emptyEl?.querySelector("p");
    const icon = emptyEl?.querySelector(".empty-icon");
    if (p)    p.textContent    = "Chame o próximo!";
    if (icon) icon.textContent = "👆";
  } else {

    show("func-call-empty");
    hide("func-call-active");
    const emptyEl = document.getElementById("func-call-empty");
    const p    = emptyEl?.querySelector("p");
    const icon = emptyEl?.querySelector(".empty-icon");
    if (p)    p.textContent    = "A fila está vazia";
    if (icon) icon.textContent = "🎉";
  }
}

/* ══════════════════════════════════════════════════════════
   SUB-ABAS DE FILA
══════════════════════════════════════════════════════════ */

function switchQueueView(tipo) {
  ["principal", "repeticao"].forEach(t => {
    document.getElementById(`aluno-queue-list-${t}`)?.classList.toggle("hidden", t !== tipo);
    document.getElementById(`qtab-${t}`)?.classList.toggle("active", t === tipo);
  });
}

function switchFuncQueueView(tipo) {
  ["principal", "repeticao"].forEach(t => {
    document.getElementById(`func-queue-list-${t}`)?.classList.toggle("hidden", t !== tipo);
    document.getElementById(`fqtab-${t}`)?.classList.toggle("active", t === tipo);
  });
}

/* ══════════════════════════════════════════════════════════
   NOTIFICACAO "E A SUA VEZ"
══════════════════════════════════════════════════════════ */

function notificarSuaVez(numero) {
  setText("popup-sua-vez-num", numero);
  openPopup("popup-sua-vez");
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

/* ══════════════════════════════════════════════════════════
   POPUPS
══════════════════════════════════════════════════════════ */

function openPopup(id)  { document.getElementById(id)?.classList.remove("hidden"); }
function closePopup(id) { document.getElementById(id)?.classList.add("hidden"); }

function closePopupOutside(event, id) {
  if (event.target.id === id) closePopup(id);
}

/* ══════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════ */

let _toastTimer = null;

function showToast(msg, icon = "✅") {
  const toast  = document.getElementById("toast");
  const msgEl  = document.getElementById("toast-msg");
  const iconEl = document.getElementById("toast-icon");
  if (!toast) return;

  if (msgEl)  msgEl.textContent  = msg;
  if (iconEl) iconEl.textContent = icon;

  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("show"), 10);

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 2800);
}

/* ══════════════════════════════════════════════════════════
   HELPERS DE UI
══════════════════════════════════════════════════════════ */

function show(id)          { document.getElementById(id)?.classList.remove("hidden"); }
function hide(id)          { document.getElementById(id)?.classList.add("hidden"); }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.dataset.orig = btn.textContent;
    btn.textContent  = "Aguarde...";
    btn.disabled     = true;
  } else {
    if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
    btn.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ══════════════════════════════════════════════════════════
   TRADUCAO DE ERROS DO FIREBASE AUTH
══════════════════════════════════════════════════════════ */

function traduzirErroFirebase(code) {
  const erros = {
    "auth/email-already-in-use":   "Esse RM/CPF já está cadastrado.",
    "auth/invalid-email":          "Formato de email inválido.",
    "auth/weak-password":          "Senha muito fraca (mín. 6 caracteres).",
    "auth/user-not-found":         "Usuário não encontrado. Verifique os dados.",
    "auth/wrong-password":         "Senha incorreta.",
    "auth/invalid-credential":     "Credenciais inválidas. Verifique seus dados.",
    "auth/too-many-requests":      "Muitas tentativas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Erro de rede. Verifique sua conexão.",
    "auth/operation-not-allowed":  "Método de login não habilitado no Firebase.",
    "auth/requires-recent-login":  "Faça login novamente antes de alterar a senha.",
  };
  return erros[code] || `Erro: ${code || "desconhecido"}. Tente novamente.`;
}

/* ══════════════════════════════════════════════════════════
   EXPOSICAO GLOBAL
══════════════════════════════════════════════════════════ */
Object.assign(window, {
  showLoginForm,
  showMainLogin,
  submitAluno,
  submitFunc,
  loginAnonymous,
  doLogout,
  changePassword,
  switchTab,
  switchQueueView,
  switchFuncQueueView,
  entrarFila,
  chamarProximo,
  openPopup,
  closePopup,
  closePopupOutside,
});
