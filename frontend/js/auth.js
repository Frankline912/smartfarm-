// auth.js - Centralized Authentication Helper
const Auth = {
  // Retrieve the logged-in user object from localStorage
  user() {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },

  // Retrieve the auth token
  token() {
    return localStorage.getItem("token");
  },

  // Save token and user after a successful login
  setSession(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  },

  // Clear session data and send user back to the login page
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token();
  }
};