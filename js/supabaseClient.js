// Shared Supabase client and UI helpers for OWAS.
const configFromStorage = JSON.parse(localStorage.getItem("owas_supabase_config") || "{}");

const FILE_SUPABASE_URL = window.OWAS_SUPABASE_URL || "https://utwzuopejfikaijimept.supabase.co";
const FILE_SUPABASE_ANON_KEY = window.OWAS_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d3p1b3BlamZpa2FpamltZXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NjkyMjQsImV4cCI6MjA4NjQ0NTIyNH0.kuy7eSHThBNmozDsHkuAXFJ0pdFgD4M9yUIVl_H-3ls";
const HAS_FILE_CONFIG =
  !FILE_SUPABASE_URL.includes("YOUR-PROJECT") &&
  !FILE_SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY");

const SUPABASE_URL = HAS_FILE_CONFIG ? FILE_SUPABASE_URL : (configFromStorage.url || FILE_SUPABASE_URL);
const SUPABASE_ANON_KEY = HAS_FILE_CONFIG ? FILE_SUPABASE_ANON_KEY : (configFromStorage.anonKey || FILE_SUPABASE_ANON_KEY);

if (!window.supabase || !window.supabase.createClient) {
  throw new Error("Supabase SDK not loaded. Ensure CDN script is included before module scripts.");
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export function saveSupabaseConfig(url, anonKey) {
  localStorage.setItem("owas_supabase_config", JSON.stringify({ url, anonKey }));
}

export function getSupabaseConfig() {
  return { SUPABASE_URL, SUPABASE_ANON_KEY };
}

export function showToast(message, type = "info") {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = `[${type.toUpperCase()}] ${message}`;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 200);
  }, 2400);
}

export function setLoading(isLoading) {
  const existing = document.getElementById("owas-loading");
  if (isLoading) {
    if (existing) return;
    const overlay = document.createElement("div");
    overlay.id = "owas-loading";
    overlay.className = "loading";
    overlay.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
    document.body.appendChild(overlay);
  } else if (existing) {
    existing.remove();
  }
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function requireElement(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el;
}

export function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export async function getCurrentUserProfile() {
  const { data: authData } = await sb.auth.getUser();
  const user = authData?.user;
  if (!user) return null;

  const { data: profile, error } = await sb
    .from("users")
    .select("id,email,full_name,role_id")
    .eq("id", user.id)
    .single();

  if (error) return null;

  let roleName = "Student";
  if (profile?.role_id) {
    const { data: roleRow } = await sb
      .from("roles")
      .select("name")
      .eq("id", profile.role_id)
      .maybeSingle();
    roleName = roleRow?.name || roleName;
  }

  return {
    ...profile,
    role: roleName
  };
}

export function paginate(page = 1, pageSize = 10) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Number(pageSize) || 10);
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to, page: safePage, pageSize: safeSize };
}
