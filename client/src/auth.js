
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const TOKEN_KEY = "taskmaster_token";

// GET SAVED TOKEN
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// SAVE TOKEN AFTER LOGIN
export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

// REMOVE TOKEN
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// CENTRAL API REQUEST FUNCTION
export async function apiRequest(path, options = {}) {
  const token = getToken();

  const headers = {
    ...options.headers
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(
      "Cannot connect to the backend server."
    );
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.error || `Request failed: ${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

// LOGIN
export async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password
    })
  });

  saveToken(data.token);

  return data.user;
}

// REGISTER
export async function register(name, email, password) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password
    })
  });

  saveToken(data.token);

  return data.user;
}

// GET CURRENT LOGGED-IN USER
export async function getCurrentUser() {
  const data = await apiRequest("/auth/me");

  return data.user;
}

// LOGOUT
export function logout() {
  clearToken();
}
