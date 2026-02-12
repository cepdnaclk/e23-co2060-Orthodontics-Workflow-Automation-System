import { sb, getCurrentUserProfile, requireElement, saveSupabaseConfig, setLoading, showToast } from "./supabaseClient.js";

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
let inactivityTimer;

export function startInactivityTimer() {
  const reset = async () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      await sb.auth.signOut();
      showToast("Session expired due to inactivity.", "warning");
      window.location.href = "index.html";
    }, INACTIVITY_LIMIT_MS);
  };

  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, reset, { passive: true });
  });

  reset();
}

export async function protectPage() {
  setLoading(true);
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session) {
    setLoading(false);
    window.location.href = "index.html";
    return null;
  }

  const profile = await getCurrentUserProfile();
  const userLabel = document.getElementById("userLabel");
  if (userLabel && profile) {
    userLabel.textContent = `${profile.full_name || profile.email} (${profile.role})`;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      window.location.href = "index.html";
    });
  }

  startInactivityTimer();
  setLoading(false);
  return { session: data.session, profile };
}

export function initLoginPage() {
  const loginForm = requireElement("loginForm");
  const configForm = document.getElementById("configForm");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = requireElement("email").value.trim();
    const password = requireElement("password").value;

    try {
      setLoading(true);
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await getCurrentUserProfile();
      if (!profile) {
        throw new Error("Login succeeded but no OWAS user profile was found. Add this auth user to public.users.");
      }
      showToast("Login successful", "success");
      window.location.href = profile.role === "Admin" ? "admin.html" : "dashboard.html";
    } catch (err) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  });

  const resetBtn = document.getElementById("resetPasswordBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const email = requireElement("email").value.trim();
      if (!email) {
        showToast("Enter email first", "warning");
        return;
      }
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}${location.pathname}`
      });
      if (error) showToast(error.message, "error");
      else showToast("Password reset email sent", "success");
    });
  }

  if (configForm) {
    configForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = requireElement("supabaseUrl").value.trim();
      const anonKey = requireElement("supabaseAnonKey").value.trim();
      saveSupabaseConfig(url, anonKey);
      showToast("Supabase config saved. Reloading...", "success");
      setTimeout(() => window.location.reload(), 700);
    });
  }
}
