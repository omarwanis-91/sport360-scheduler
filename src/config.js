const runtimeConfig = window.__SPORT360_CONFIG__ || {};

export const supabaseConfig = {
  url: runtimeConfig.supabaseUrl || "",
  anonKey: runtimeConfig.supabaseAnonKey || ""
};

export const appConfig = {
  demoMode: runtimeConfig.demoMode === true,
  defaultScheduleDays: 14,
  allowSignup: runtimeConfig.allowSignup === true,
  release: runtimeConfig.release || "local"
};
