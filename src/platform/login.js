import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import { client } from "./supabase";
import "./design/tokens.css";
import "./design/login.css";

const supabaseClient = client;

const form = document.getElementById("loginForm");

const status = document.getElementById("status");

const emailInput = document.getElementById("email");

const passwordInput = document.getElementById("password");

const rememberInput = document.getElementById("remember");

const togglePassword = document.getElementById("togglePassword");

const loginButton = document.getElementById("loginButton");

const forgot = document.getElementById("forgot");

// =========================================================
// STATUS
// =========================================================

function showStatus(message, type = "error") {
  status.textContent = message;

  status.className = `status ${type}`;
}

// =========================================================
// MOSTRAR / OCULTAR SENHA
// =========================================================

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";

  passwordInput.type = showing ? "password" : "text";

  togglePassword.setAttribute(
    "aria-label",
    showing ? "Mostrar senha" : "Ocultar senha",
  );
});

// =========================================================
// LOGIN
// =========================================================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  const password = passwordInput.value;

  if (!email || !password) {
    showStatus("Preencha seu e-mail e sua senha para continuar.");

    return;
  }

  if (!email.includes("@")) {
    showStatus("Informe um e-mail válido.");

    return;
  }

  loginButton.disabled = true;

  loginButton.innerHTML = "Entrando...";

  try {
    console.log("WashSense: tentando autenticar...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,

      password,
    });

    if (error) {
      console.error("WashSense Auth:", error);

      throw error;
    }

    if (!data.session) {
      throw new Error("Login realizado, mas nenhuma sessão foi criada.");
    }

    console.log("WashSense: usuário autenticado:", data.user?.id);

    showStatus("Login realizado com sucesso. Abrindo a plataforma...", "ok");

    /*
     * A sessão já foi armazenada pelo
     * Supabase Auth.
     *
     * O finance.js poderá utilizar
     * getSession() normalmente.
     */

    setTimeout(() => {
      window.location.href = "app.html#/visao-geral";
    }, 600);
  } catch (error) {
    console.error("WashSense: erro no login:", error);

    let message = "Não foi possível entrar. Verifique seu e-mail e senha.";

    if (error?.message?.toLowerCase().includes("invalid login credentials")) {
      message = "E-mail ou senha incorretos.";
    }

    if (error?.message?.toLowerCase().includes("email not confirmed")) {
      message = "Seu e-mail ainda não foi confirmado.";
    }

    showStatus(message);

    loginButton.disabled = false;

    loginButton.innerHTML = "Entrar na plataforma <span>→</span>";
  }
});

// =========================================================
// RECUPERAÇÃO DE SENHA
// =========================================================

forgot.addEventListener("click", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  if (!email) {
    showStatus("Digite seu e-mail primeiro para recuperar a senha.");

    emailInput.focus();

    return;
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html`,
    });

    if (error) {
      throw error;
    }

    showStatus(
      "Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.",
      "ok",
    );
  } catch (error) {
    console.error("WashSense recuperação:", error);

    showStatus("Não foi possível iniciar a recuperação de senha.");
  }
});

// =========================================================
// VERIFICAR SE JÁ ESTÁ LOGADO
// =========================================================

async function checkExistingSession() {
  try {
    const { data } = await supabaseClient.auth.getSession();

    if (data?.session) {
      console.log("WashSense: sessão existente encontrada.");

      /*
       * Não redirecionamos automaticamente
       * neste momento para permitir que o
       * usuário veja a tela de login.
       */
    }
  } catch (error) {
    console.error("WashSense: erro ao verificar sessão:", error);
  }
}

checkExistingSession();
