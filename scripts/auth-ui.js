// =============================
// Auth UI Controller for Navbar
// =============================

// API Base URL (Adjust for local development if needed)
const API_BASE_URL = "https://hirehive-api.onrender.com";

// Select UI elements
const loginLink = document.getElementById("login-link");
const profileMenu = document.getElementById("profile-menu");
const usernameSpan = document.getElementById("username");
const dashboardLink = document.getElementById("dashboard-link");
const logoutBtn = document.getElementById("logout-btn");

// Mobile menu toggle
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("nav-open");
    });
}

// Token check
const token = localStorage.getItem("token");

if (!token) {
    // Not logged in -> show login button
    if (loginLink) loginLink.style.display = "inline-block";
    if (profileMenu) profileMenu.classList.add("hidden");
} else {
    // Logged in -> validate token and fetch profile
    fetch(`${API_BASE_URL}/api/auth/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (!data.user) throw new Error("Invalid session");

            const user = data.user;
            const role = user.role;

            // Update Navbar UI
            if (usernameSpan) usernameSpan.textContent = user.name.split(" ")[0];
            if (loginLink) loginLink.style.display = "none";
            if (profileMenu) profileMenu.classList.remove("hidden");

            // Dashboard routing by role
            if (dashboardLink) {
                if (role === "seeker") dashboardLink.href = "seeker-dashboard.html";
                else if (role === "employer") dashboardLink.href = "employer-dashboard.html";
                else if (role === "admin") dashboardLink.href = "admin-panel.html";
                else dashboardLink.href = "#";
            }
        })
        .catch(err => {
            console.warn("Session check failed:", err.message);
            localStorage.removeItem("token");
            location.reload();
        });
}

// Logout Handler
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });
}