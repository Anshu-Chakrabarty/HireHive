// --- Frontend: app.js (FINAL COMPLETE VERSION) ---

// ------------------------------------------------------------------
// 0. GLOBAL HELPER FUNCTIONS (Available everywhere)
// ------------------------------------------------------------------

/**
 * Share Job Logic (Web Share API)
 */
window.shareJob = async(id, title, company) => {
    // 1. Build the deep link URL
    const shareUrl = `${window.location.origin}?jobId=${id}`;

    // 2. Data to share
    const shareData = {
        title: `Hiring: ${title}`,
        text: `Check out this ${title} role at ${company} on HireHive!`,
        url: shareUrl
    };

    try {
        // 3. Try Native Mobile Sharing first
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // 4. Desktop Fallback: Copy to Clipboard
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            // Use the globally available showStatusMessage if DOM is ready
            if (window.showStatusMessage) {
                window.showStatusMessage("Link Copied! 📋", "The job link has been copied to your clipboard.", false);
            } else {
                alert("Link Copied! 📋 The job link has been copied to your clipboard.");
            }
        }
    } catch (err) {
        console.error('Share failed:', err);
    }
};

/**
 * Helper to generate Job Card HTML with Share Button
 */


/**
 * Attaches event listeners to dynamically generated "Apply" buttons
 */
function setupApplicationListeners() {
    const applyButtons = document.querySelectorAll('.apply-btn:not(:disabled)');

    applyButtons.forEach(button => {
        // Cloning removes old listeners to prevent duplicates
        const newBtn = button.cloneNode(true);
        button.parentNode.replaceChild(newBtn, button);

        newBtn.addEventListener('click', (e) => {
            const jobId = e.target.getAttribute('data-id');
            const jobTitle = e.target.getAttribute('data-title');

            // Trigger application logic
            if (typeof window.handleJobApplication === 'function') {
                window.handleJobApplication(jobId, []);
            } else {
                alert(`Applying for: ${jobTitle}`);
            }
        });
    });
}

// ------------------------------------------------------------------
// DOM CONTENT LOADED - MAIN APP LOGIC
// ------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
            // ------------------------------------------------------------------
            // 1. GLOBAL CONFIGURATION & API HELPERS
            // ------------------------------------------------------------------

            const BASE_URL = "https://hirehive-api.onrender.com/api";

            const getToken = () => localStorage.getItem("hirehiveToken");
            const setToken = (token) => localStorage.setItem("hirehiveToken", token);
            const removeToken = () => localStorage.removeItem("hirehiveToken");

            const getLocalUser = () => JSON.parse(sessionStorage.getItem("localUser"));
            const setLocalUser = (user) => {
                if (user) {
                    sessionStorage.setItem("localUser", JSON.stringify(user));
                } else {
                    sessionStorage.removeItem("localUser");
                }
            };

            const statusMessageModal = document.getElementById("statusMessageModal");

            // Expose showStatusMessage globally so shareJob can use it
            window.showStatusMessage = (title, body, isError = false) => {
                document.getElementById("statusMessageTitle").textContent = title;
                document.getElementById("statusMessageBody").textContent = body;
                if (isError) {
                    document.getElementById("statusMessageTitle").style.color = 'var(--danger-color)';
                } else {
                    document.getElementById("statusMessageTitle").style.color = 'var(--secondary-color)';
                }
                if (statusMessageModal) statusMessageModal.style.display = 'block';
            };

            document.querySelectorAll('.status-close-btn').forEach(btn => {
                btn.onclick = () => {
                    statusMessageModal.style.display = 'none';
                };
            });

            const confirmationModal = document.getElementById("confirmationModal");
            const confirmTitleEl = document.getElementById("confirmTitle");
            const confirmBodyEl = document.getElementById("confirmBody");
            const confirmInputEl = document.getElementById("confirmInput");
            const confirmOKBtn = document.getElementById("confirmOKBtn");
            const confirmCancelBtn = document.getElementById("confirmCancelBtn");

            const showConfirmation = (title, body, isPrompt = false, okText = 'OK') => {
                return new Promise((resolve) => {
                    confirmTitleEl.textContent = title;
                    confirmBodyEl.textContent = body;
                    confirmInputEl.classList.toggle('hidden', !isPrompt);
                    confirmInputEl.value = '';
                    confirmOKBtn.textContent = isPrompt ? 'Submit' : okText;
                    confirmCancelBtn.textContent = isPrompt ? 'Cancel Application' : 'Cancel';
                    confirmationModal.style.display = 'block';

                    const cleanup = (result) => {
                        confirmationModal.style.display = 'none';
                        confirmOKBtn.onclick = null;
                        confirmCancelBtn.onclick = null;
                        resolve(result);
                    };

                    confirmOKBtn.onclick = () => {
                        cleanup(isPrompt ? confirmInputEl.value.trim() : true);
                    };

                    confirmCancelBtn.onclick = () => {
                        cleanup(isPrompt ? null : false);
                    };
                });
            };

            // --- Subscription Plan Limits & Details ---
            const HIVE_PLANS = {
                'buzz': {
                    name: "Buzz Plan",
                    limit: 2,
                    icon: "fas fa-bug",
                    color: "#28a745",
                    price: "Free",
                    description: "Post 2 free job listing. Access to limited candidate applications."
                },
                'worker': {
                    name: "Worker Plan",
                    limit: 5,
                    icon: "fas fa-user-tie",
                    color: "#007bff",
                    price: "₹1,999 / month",
                    description: "Post up to 5 active jobs. Access to 50 candidate resumes."
                },
                'colony': {
                    name: "Colony Plan",
                    limit: 15,
                    icon: "fas fa-industry",
                    color: "#fd7e14",
                    price: "₹4,999 / month",
                    description: "Post up to 15 active jobs. Access to unlimited resume downloads."
                },
                'queen': {
                    name: "Queen Plan",
                    limit: 30,
                    icon: "fas fa-crown",
                    color: "#6f42c1",
                    price: "₹8,999 / month",
                    description: "Post up to 30 active jobs. Access to premium candidate database & AI."
                },
                'hive_master': {
                    name: "Hive Master Plan",
                    limit: Infinity,
                    icon: "fas fa-trophy",
                    color: "#dc3545",
                    price: "₹14,999 / month",
                    description: "Unlimited job postings. Full database access. Dedicated support."
                },
            };

            async function fetchApi(endpoint, method = 'GET', data = null, isFormData = false) {
                const token = getToken();
                const url = `${BASE_URL}/${endpoint}`;
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const config = {
                    method,
                    headers
                };
                if (data) {
                    if (isFormData) {
                        config.body = data;
                    } else {
                        headers['Content-Type'] = 'application/json';
                        config.body = JSON.stringify(data);
                    }
                }
                try {
                    const response = await fetch(url, config);
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const responseData = await response.json();
                        if (!response.ok) {
                            const errorMessage = responseData.error || `Request failed with status ${response.status}`;
                            throw new Error(errorMessage);
                        }
                        return responseData;
                    } else if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Backend Error (${response.status}):`, errorText);
                        throw new Error(`Server returned status ${response.status}. Please check backend logs.`);
                    }
                    return {};
                } catch (error) {
                    console.error("Fetch API Error:", error);
                    throw error;
                }
            }

            const setLoading = (buttonId, isLoading, defaultText = 'Submit') => {
                const btn = document.getElementById(buttonId);
                if (!btn) return;
                if (isLoading) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                } else {
                    btn.disabled = false;
                    btn.textContent = defaultText;
                }
            };

            // ------------------------------------------------------------------
            // 2. DOM ELEMENTS & SPA ROUTER
            // ------------------------------------------------------------------

            const views = {
                'home': document.getElementById("home-view"),
                'dashboard': document.getElementById("dashboard-view"),
                'admin': document.getElementById("admin-view"),
                'about': document.getElementById("about-view"),
                'contact': document.getElementById("contact-view"),
                'career-growth': document.getElementById("career-growth-view"),
                'plans': document.getElementById("plans-view"),
            };

            const dashboardLink = document.getElementById("dashboardLink");
            const adminLink = document.getElementById("adminLink");
            const plansNavLink = document.getElementById("plansNavLink");
            const loginBtn = document.getElementById("loginBtn");
            const signupBtn = document.getElementById("signupBtn");
            const logoutBtn = document.getElementById("logoutBtn");
            const welcomeMessage = document.getElementById("welcome-message");
            const menuToggle = document.getElementById('menuToggle');
            const navLinks = document.getElementById('navLinks');
            const employerDashboard = document.getElementById("employer-dashboard");
            const googleLoginBtn = document.getElementById("googleLoginBtn");
            const appMainContent = document.getElementById('app-main-content');

            // Guide Elements
            const guideModal = document.getElementById('guideModal');
            const guideTitle = document.getElementById('guideTitle');
            const guideBody = document.getElementById('guideBody');
            const guideNextBtn = document.getElementById('guideNextBtn');
            const guideCloseBtns = document.querySelectorAll('.guide-close-btn');

            const triggerSuccessEffect = () => {
                const colors = ['#ffc107', '#007bff', '#dc3545', '#28a745', '#ffffff'];
                const container = document.createElement('div');
                container.id = 'success-effect-container';
                document.body.appendChild(container);

                for (let i = 0; i < 50; i++) {
                    const confetti = document.createElement('div');
                    confetti.style.width = '10px';
                    confetti.style.height = '10px';
                    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    confetti.style.position = 'absolute';
                    confetti.style.left = `${Math.random() * 100}vw`;
                    confetti.style.top = `${-10 - Math.random() * 20}vh`;
                    confetti.style.opacity = 1;
                    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

                    confetti.animate([{
                        transform: `translateY(0) rotate(0deg)`,
                        opacity: 1
                    }, {
                        transform: `translateY(${window.innerHeight * 1.5}px) rotate(720deg)`,
                        opacity: 0.1
                    }], {
                        duration: 2500 + Math.random() * 1000,
                        easing: 'ease-in-out',
                        delay: Math.random() * 500
                    });

                    container.appendChild(confetti);
                }

                setTimeout(() => {
                    container.remove();
                }, 4000);
            };

            const GUIDE_STEPS = (role) => {
                if (role === 'employer') {
                    return [{
                        title: "Welcome, New Employer! 🎉",
                        body: "We're excited to have you! Your next step is managing your job postings. Click 'Next Tip' to see your new Dashboard."
                    }, {
                        title: "Post a Job",
                        body: "Use the **'Post Job'** tab to easily list new openings. Remember to check your **Hive Plan** limits!"
                    }, {
                        title: "Manage Applicants",
                        body: "The **'Manage Posted Jobs'** tab lets you track applications, view seeker profiles, and shortlist candidates."
                    }, ];
                }
                return [{
                    title: "Welcome to the Hive! 🐝",
                    body: "Your career journey starts here! First, let's complete your profile for the best job matching."
                }, {
                    title: "Complete Your Profile",
                    body: "Click **'Edit Profile'** to add your skills, education, and upload your CV. A complete profile gets noticed faster!"
                }, {
                    title: "Search & Apply",
                    body: "Use the search bar or domain links to find jobs. Your skill-matched opportunities will appear under **Shortlisted Jobs**."
                }];
            };

            let currentGuideStep = 0;
            let guideFlow = [];

            const showGuidePopup = (userRole) => {
                guideFlow = GUIDE_STEPS(userRole);
                currentGuideStep = 0;
                showNextGuideStep();
            };

            const showNextGuideStep = () => {
                if (currentGuideStep < guideFlow.length) {
                    const step = guideFlow[currentGuideStep];
                    guideTitle.textContent = step.title;
                    guideBody.innerHTML = step.body;
                    guideModal.style.display = 'block';
                    guideNextBtn.textContent = (currentGuideStep === guideFlow.length - 1) ? 'Start Exploring!' : 'Next Tip';
                    currentGuideStep++;
                } else {
                    guideModal.style.display = 'none';
                }
            };

            guideNextBtn.onclick = showNextGuideStep;
            guideCloseBtns.forEach(btn => btn.onclick = () => {
                guideModal.style.display = 'none';
            });

            if (menuToggle && navLinks) {
                menuToggle.addEventListener('click', () => {
                    navLinks.classList.toggle('active');
                });
                navLinks.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => {
                        if (navLinks.classList.contains('active')) {
                            navLinks.classList.remove('active');
                        }
                    });
                });
            }

            if (appMainContent && navLinks) {
                appMainContent.addEventListener('click', (event) => {
                    if (window.innerWidth < 992 && navLinks.classList.contains('active')) {
                        if (!navLinks.contains(event.target) && event.target !== menuToggle && !menuToggle.contains(event.target)) {
                            navLinks.classList.remove('active');
                        }
                    }
                });
            }

            async function updateHeaderUI() {
                let user = getLocalUser();
                const token = getToken();

                // Reset UI to 'Logged Out' state
                loginBtn.classList.remove("hidden");
                signupBtn.classList.remove("hidden");
                logoutBtn.classList.add("hidden");
                dashboardLink.classList.add("hidden");
                adminLink.classList.add("hidden");
                if (plansNavLink) plansNavLink.classList.add("hidden");
                welcomeMessage.classList.add("hidden");

                if (token) {
                    if (!user) {
                        try {
                            const data = await fetchApi('auth/me', 'GET');
                            user = data.user;
                            setLocalUser(user);
                        } catch (e) {
                            removeToken();
                            setLocalUser(null);
                            return;
                        }
                    }

                    // Logged In UI Logic
                    loginBtn.classList.add("hidden");
                    signupBtn.classList.add("hidden");
                    logoutBtn.classList.remove("hidden");
                    dashboardLink.classList.remove("hidden");
                    welcomeMessage.classList.remove("hidden");
                    welcomeMessage.textContent = `Hi, ${user.name.split(' ')[0]}`;

                    if (user.role === 'admin') {
                        adminLink.classList.remove("hidden");
                    } else if (user.role === 'employer' && plansNavLink) {
                        plansNavLink.classList.remove("hidden");
                    }
                }
            }

            const showView = (viewName, updateHash = true, filters = null) => {
                const user = getLocalUser();
                const token = getToken();

                // 🔒 SECURITY GUARD
                if ((viewName === 'dashboard' || viewName === 'admin') && (!user || !token)) {
                    window.showStatusMessage("Login Required", "Please log in to access your dashboard.", false);
                    viewName = 'home';
                }

                Object.values(views).forEach(v => v.classList.add("hidden"));
                let viewToShow = views[viewName] || views['home'];
                viewToShow.classList.remove("hidden");

                if (viewName === 'dashboard') initDashboard(filters);
                if (viewName === 'admin') initAdmin();
                if (viewName === 'plans') loadPlansView();

                if (updateHash) {
                    window.location.hash = (viewName === 'home') ? '' : `#${viewName}`;
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            window.addEventListener('hashchange', () => {
                const hash = window.location.hash.replace('#', '');
                const viewName = hash || 'home';
                updateHeaderUI();
                // Don't re-trigger showView here if it's just a UI update, let the click handler manage it or check state
            });

            document.querySelectorAll('[data-view]').forEach(el => {
                el.addEventListener('click', (e) => {
                    // Null check for e.currentTarget just in case
                    const target = e.currentTarget;
                    if (!target) return;

                    const viewName = target.getAttribute("data-view");
                    if (!viewName) return;

                    if (viewName === 'home-link') {
                        showView('home');
                        setTimeout(() => {
                            const href = target.getAttribute('href');
                            if (href) {
                                const targetEl = document.getElementById(href.substring(1));
                                if (targetEl) {
                                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        }, 10);
                    } else {
                        showView(viewName);
                    }
                });
            });

            logoutBtn.onclick = () => {
                removeToken();
                setLocalUser(null);
                window.location.hash = '';
                updateHeaderUI();
                showView('home');
            };

            updateHeaderUI();

            document.querySelectorAll(".opportunity-link").forEach((link) => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = e.currentTarget.querySelector('span').textContent.trim();
                    const currentUser = getLocalUser();

                    if (!currentUser) {
                        window.showStatusMessage("Login Required", "Please log in as a Job Seeker to view and search jobs.", false);
                        showView('home');
                        showForm(loginFormContainer);
                        return;
                    }

                    const filters = { category: category };
                    showView('dashboard', true, filters);
                });
            });

            // ------------------------------------------------------------------
            // 3. AUTH & MODAL LOGIC
            // ------------------------------------------------------------------

            const authModal = document.getElementById("authModal");
            const loginFormContainer = document.getElementById("login-form-container");
            const signupFormContainer = document.getElementById("signup-form-container");
            const forgotFormContainer = document.getElementById("forgot-form-container");
            const otpFormContainer = document.getElementById("otp-form-container");
            const closeAuthBtn = document.querySelector("#authModal .close-btn");
            const applicantsModal = document.getElementById("applicantsModal");
            const subscriptionModal = document.getElementById("subscriptionModal");
            const closeApplicantsModalBtn = document.getElementById("close-applicants-modal");
            const userTypeSelect = document.getElementById("userType");
            const companyNameInput = document.getElementById("signupCompanyName");
            const switchFormLink = document.getElementById("switch-form-link");
            const forgotPasswordLink = document.getElementById("forgotPasswordLink");
            const backToLoginLink = document.getElementById("backToLoginLink");

            const showForm = (formToShow) => {
                [loginFormContainer, signupFormContainer, forgotFormContainer, otpFormContainer].forEach((f) => f ? f.classList.add("hidden") : null);
                formToShow.classList.remove("hidden");
                authModal.style.display = "block";

                if (formToShow === loginFormContainer || formToShow === signupFormContainer) {
                    if (switchFormLink) {
                        switchFormLink.style.display = 'block';
                        const isLogin = formToShow === loginFormContainer;
                        switchFormLink.textContent = isLogin ? "Need an account? Sign Up" : "Already have an account? Log In";
                    }
                    if (forgotPasswordLink) forgotPasswordLink.style.display = (formToShow === loginFormContainer) ? 'block' : 'none';
                } else {
                    if (switchFormLink) switchFormLink.style.display = 'none';
                    if (forgotPasswordLink) forgotPasswordLink.style.display = 'none';
                }

                if (formToShow === signupFormContainer) {
                    userTypeSelect.value = 'seeker';
                    companyNameInput.classList.add('hidden');
                    companyNameInput.required = false;
                }
            };

            if (loginBtn) loginBtn.onclick = () => showForm(loginFormContainer);
            if (signupBtn) signupBtn.onclick = () => showForm(signupFormContainer);
            if (closeAuthBtn) closeAuthBtn.onclick = () => authModal.style.display = "none";
            if (closeApplicantsModalBtn) closeApplicantsModalBtn.onclick = () => applicantsModal.style.display = "none";

            if (forgotPasswordLink) {
                forgotPasswordLink.onclick = (e) => {
                    e.preventDefault();
                    showForm(forgotFormContainer);
                };
            }
            if (backToLoginLink) {
                backToLoginLink.onclick = (e) => {
                    e.preventDefault();
                    showForm(loginFormContainer);
                };
            }

            window.onclick = (event) => {
                if (event.target == authModal) authModal.style.display = "none";
                if (event.target == applicantsModal) applicantsModal.style.display = "none";
                if (event.target == subscriptionModal) subscriptionModal.style.display = "none";
                if (event.target == statusMessageModal) statusMessageModal.style.display = "none";
                if (event.target == confirmationModal) confirmationModal.style.display = "none";

                // Close Chat window if clicking outside
                if (chatWindow && !chatWindow.classList.contains('hidden') &&
                    !chatWindow.contains(event.target) && event.target !== chatBtn && !chatBtn.contains(event.target)) {
                    // chatWindow.classList.add('hidden'); // Optional: auto close chat
                }
            };

            if (switchFormLink) {
                switchFormLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const formContainer = signupFormContainer.classList.contains("hidden") ? signupFormContainer : loginFormContainer;
                    showForm(formContainer);
                });
            }

            if (userTypeSelect) {
                userTypeSelect.addEventListener('change', () => {
                    if (userTypeSelect.value === 'employer') {
                        companyNameInput.classList.remove('hidden');
                        companyNameInput.required = true;
                    } else {
                        companyNameInput.classList.add('hidden');
                        companyNameInput.required = false;
                    }
                });
            }

            // Forgot Password
            if (document.getElementById("forgotPasswordForm")) {
                document.getElementById("forgotPasswordForm").addEventListener("submit", async(e) => {
                    e.preventDefault();
                    setLoading('submitResetBtn', true, 'Send Reset Link');
                    const email = document.getElementById("resetEmail").value;
                    try {
                        const data = await fetchApi('auth/forgot-password', 'POST', { email });
                        authModal.style.display = "none";
                        window.showStatusMessage("Reset Link Sent", data.message, false);
                        document.getElementById("forgotPasswordForm").reset();
                    } catch (error) {
                        authModal.style.display = "none";
                        window.showStatusMessage("Reset Failed", error.message, true);
                    } finally {
                        setLoading('submitResetBtn', false, 'Send Reset Link');
                    }
                });
            }

            // Signup Logic
            // Signup Logic with Employer Email Validation
            document.getElementById("signupForm").addEventListener("submit", async(e) => {
                e.preventDefault();

                // 1. Get values first to validate
                const name = document.getElementById("signupName").value;
                const email = document.getElementById("signupEmail").value.trim().toLowerCase();
                const password = document.getElementById("signupPassword").value;
                const phone = document.getElementById("signupPhone").value;
                const role = userTypeSelect.value;
                const companyName = companyNameInput.value;

                // --- 🚫 NEW: EMPLOYER EMAIL VALIDATION ---
                if (role === 'employer') {
                    const blockedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
                    const emailDomain = email.split('@')[1];

                    if (blockedDomains.includes(emailDomain)) {
                        window.showStatusMessage(
                            "Business Email Required",
                            "Employers cannot use personal addresses (like @gmail.com). Please use your official company email.",
                            true
                        );
                        return; // 🛑 Stop the signup process immediately
                    }
                }
                // ----------------------------------------

                setLoading('submitSignupBtn', true, 'Sign Up');

                const signupData = { name, email, password, role, phone };
                if (role === 'employer') {
                    signupData.companyName = companyName;
                }

                try {
                    const data = await fetchApi('auth/signup', 'POST', signupData);
                    setToken(data.token);
                    setLocalUser(data.user);

                    authModal.style.display = "none";
                    document.getElementById("signupForm").reset();

                    updateHeaderUI();
                    triggerSuccessEffect();
                    showGuidePopup(data.user.role);
                } catch (error) {
                    console.error("Signup failed:", error.message);
                    authModal.style.display = "none";

                    if (error.message.includes('already exists')) {
                        window.showStatusMessage("Account Exists", "A user with this email already exists. Please log in.", true);
                        showForm(loginFormContainer);
                    } else {
                        window.showStatusMessage("Registration Failed", error.message, true);
                    }
                } finally {
                    setLoading('submitSignupBtn', false, 'Sign Up');
                }
            });

            // Login Logic
            document.getElementById("loginForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                setLoading('submitLoginBtn', true, 'Login');
                const email = document.getElementById("loginEmail").value;
                const password = document.getElementById("loginPassword").value;
                try {
                    const data = await fetchApi('auth/login', 'POST', { email, password });
                    setToken(data.token);
                    setLocalUser(data.user);
                    authModal.style.display = "none";
                    document.getElementById("loginForm").reset();
                    updateHeaderUI();
                    triggerSuccessEffect();
                } catch (error) {
                    console.error("Login failed:", error.message);
                    authModal.style.display = "none";
                    window.showStatusMessage("Login Failed", error.message.includes('credentials') ? error.message : "Invalid email or password.", true);
                } finally {
                    setLoading('submitLoginBtn', false, 'Login');
                }
            });

            // Google Auth
            if (googleLoginBtn) {
                googleLoginBtn.addEventListener('click', () => {
                    window.location.href = `${BASE_URL}/auth/google/login`;
                });
            }

            async function handleGoogleAuthCallback() {
                const hash = window.location.hash;
                if (!hash) return; // Exit if no hash

                const urlParams = new URLSearchParams(hash.substring(1));
                const token = urlParams.get('google_token');
                const error = urlParams.get('error');

                // Clear hash to prevent loops
                history.pushState("", document.title, window.location.pathname + window.location.search);

                if (error) {
                    authModal.style.display = "none";
                    window.showStatusMessage("Google Sign-In Failed", `Error: ${error}`, true);
                    return;
                }

                if (token) {
                    setToken(token);
                    try {
                        const userData = await fetchApi('auth/me', 'GET');
                        setLocalUser(userData.user);
                        updateHeaderUI();
                        authModal.style.display = "none";
                        triggerSuccessEffect();
                        if (userData.user && !userData.user.is_verified) {
                            showGuidePopup(userData.user.role);
                        }
                    } catch (e) {
                        removeToken();
                        authModal.style.display = "none";
                        window.showStatusMessage("Sign In Error", "Could not retrieve user data.", true);
                    }
                }
            }
            // Check for Google callback on load
            handleGoogleAuthCallback();

            // ------------------------------------------------------------------
            // 4. CONTACT FORM LOGIC
            // ------------------------------------------------------------------
            const contactForm = document.querySelector(".contact-form");
            if (contactForm) {
                contactForm.addEventListener('submit', async(e) => {
                    e.preventDefault();
                    setLoading('contactSubmitBtn', true, 'Send Message');
                    const name = document.getElementById("contact-name").value;
                    const email = document.getElementById("contact-email").value;
                    const message = document.getElementById("contact-message").value;
                    try {
                        await fetchApi('contact', 'POST', { name, email, message });
                        window.showStatusMessage("Message Sent!", "Thank you for contacting HireHive.", false);
                        contactForm.reset();
                    } catch (error) {
                        window.showStatusMessage("Submission Failed", error.message, true);
                    } finally {
                        setLoading('contactSubmitBtn', false, 'Send Message');
                    }
                });
            }

            // ------------------------------------------------------------------
            // 5. SUBSCRIPTION LOGIC & PLANS VIEW
            // ------------------------------------------------------------------
            const loadPlansView = () => {
                const staticPlanDisplay = document.getElementById("static-plan-display");
                if (!staticPlanDisplay) return;

                staticPlanDisplay.innerHTML = '';
                const user = getLocalUser();
                const isEmployer = user && user.role === 'employer';
                const currentPlanKey = user ? (user.subscriptionstatus || 'buzz') : 'none';

                for (const [key, plan] of Object.entries(HIVE_PLANS)) {
                    const isCurrent = currentPlanKey === key;
                    const priceText = plan.price;
                    const buttonText = isCurrent ? 'Current Plan' : isEmployer ? 'Select Plan' : 'Sign Up to Select';
                    const buttonClass = isCurrent ? 'btn-secondary disabled' : 'btn-primary';
                    const priceColor = key === 'buzz' ? plan.color : '#333';

                    const planCard = document.createElement('div');
                    planCard.classList.add('subscription-card');
                    planCard.style.cssText = `border: 2px solid ${isCurrent ? plan.color : '#ccc'}; width: 100%; max-width: 350px; text-align: center; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: transform 0.3s;`;
                    planCard.innerHTML = `
                <h3 style="color:${plan.color}; font-size:1.5rem; margin-bottom: 0.5rem;"><i class="${plan.icon}"></i> ${plan.name}</h3>
                <p style="font-weight: bold; font-size: 1.2rem; margin-bottom: 1rem; color: ${priceColor};">${priceText}</p>
                <p style="font-size: 0.9rem; color: #666; margin-bottom: 1.5rem; height: 120px; overflow-y: hidden;">${plan.description.split('. ').join('.<br/>')}</p>
                <button class="btn ${buttonClass} select-plan-btn" data-plan-key="${key}" ${isCurrent || !isEmployer ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            `;
                    staticPlanDisplay.appendChild(planCard);
                }

                document.querySelectorAll('#plans-view .select-plan-btn').forEach(btn => {
                    if (isEmployer && !btn.disabled) {
                        btn.addEventListener('click', () => {
                            window.showStatusMessage("Subscription Simulation", `You are simulating the purchase of the ${HIVE_PLANS[btn.dataset.planKey].name}.`, false);
                        });
                    } else if (!user) {
                        btn.addEventListener('click', () => {
                            showForm(signupFormContainer);
                        });
                    }
                });
            };

  const showSubscriptionModal = () => {
    const user = getLocalUser();
    if (!user || user.role !== 'employer') return;

    const modalContent = document.querySelector("#subscriptionModal .modal-content");
    const currentPlanKey = user.subscriptionstatus || 'buzz';
    const isEmployer = user.role === 'employer';

    // 1. GENERATE UI
    let planCardsHTML = `
        <span class="close-btn" id="close-subscription-modal">&times;</span>
        <h2 style="margin-bottom: 1rem;">Choose Your Hive Plan</h2>
        <p>Your Current Plan: <strong style="color: ${HIVE_PLANS[currentPlanKey].color}">${HIVE_PLANS[currentPlanKey].name}</strong></p>
        <div class="plans-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1.5rem;">`;

    for (const [key, plan] of Object.entries(HIVE_PLANS)) {
        const isCurrent = currentPlanKey === key;
        const priceText = plan.price;
        // Disable button if it's the current plan OR if it's the free plan (buzz) which can't be bought
        const isDisabled = isCurrent || key === 'buzz'; 
        const buttonClass = isDisabled ? 'btn-secondary disabled' : 'btn-primary';
        const buttonText = isCurrent ? 'Current Plan' : (key === 'buzz' ? 'Free Plan' : 'Select Plan');
        const priceColor = key === 'buzz' ? plan.color : '#333';

        planCardsHTML += `
            <div class="subscription-card" style="border: 2px solid ${isCurrent ? plan.color : '#ccc'}; padding: 1rem; border-radius: 8px; text-align: center; position: relative; background: #fff;">
                ${isCurrent ? '<div style="position:absolute; top:-10px; right:10px; background:#22c55e; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">ACTIVE</div>' : ''}
                <h3 style="color:${plan.color}; font-size:1.3rem;"><i class="${plan.icon}"></i> ${plan.name}</h3>
                <p style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem; color: ${priceColor};">${priceText}</p>
                <p style="font-size: 0.8rem; margin-bottom: 1rem; color: #666; height: 100px; overflow-y: hidden;">${plan.description.split('. ').join('.<br/>')}</p>
                <button class="btn ${buttonClass} select-plan-btn" data-plan-key="${key}" ${isDisabled || !isEmployer ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        `;
    }
    planCardsHTML += `</div>`;
    
    // 2. INJECT HTML & SETUP LISTENERS
    modalContent.innerHTML = planCardsHTML;
    const subscriptionModal = document.getElementById("subscriptionModal");
    subscriptionModal.style.display = "block";

    document.getElementById("close-subscription-modal").onclick = () => {
        subscriptionModal.style.display = "none";
    };

    // 3. HANDLE PAYMENT CLICK
    modalContent.querySelectorAll('.select-plan-btn').forEach(btn => {
        if (isEmployer && !btn.disabled) {
            btn.addEventListener('click', async (e) => {
                const planKey = e.currentTarget.dataset.planKey;
                const btnElement = e.currentTarget;
                const originalText = btnElement.textContent;

                // A. Show Loading State
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecting...';

                try {
                    // B. Call Backend to Initiate Payment
                    // Note: 'payment/pay' matches your new backend route structure (/api/payment/pay)
                    const response = await fetchApi('payment/pay', 'POST', { 
                        planKey: planKey, 
                        userId: user.id 
                    });

                    // C. Redirect to PhonePe
                    if (response.url) {
                        window.location.href = response.url; 
                    } else {
                        throw new Error("No payment URL received from server.");
                    }

                } catch (error) {
                    console.error("Payment Initiation Error:", error);
                    window.showStatusMessage("Payment Failed", "Could not connect to PhonePe. Please try again.", true);
                    
                    // Reset Button
                    btnElement.disabled = false;
                    btnElement.innerHTML = originalText;
                }
            });
        }
    });
};

window.showSubscriptionModal = showSubscriptionModal;

            // ------------------------------------------------------------------
            // 6. DASHBOARD LOGIC
            // ------------------------------------------------------------------

function initDashboard(filters = null) {
    const currentUser = getLocalUser();
    if (!currentUser) {
        showView('home', true, null);
        return;
    }

    const seekerDashboard = document.getElementById("seeker-dashboard");
    const employerDashboard = document.getElementById("employer-dashboard");

    // ==========================================
    // 🎁 BONUS: HANDLE PAYMENT RETURN
    // ==========================================
    // Check if URL has ?status=success (Returning from PhonePe)
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]); 
    const status = urlParams.get('status');
    const plan = urlParams.get('plan');

    if (status === 'success' && currentUser.role === 'employer') {
        window.showStatusMessage("Payment Successful! 🎉", `You have been upgraded to the ${plan ? plan.toUpperCase() : 'Premium'} plan.`, false);
        // Clean URL so message doesn't persist on refresh
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
        
        // Refresh user data immediately to reflect new plan limits
        fetchUserData(); 
    } else if (status === 'failed') {
        window.showStatusMessage("Payment Failed ❌", "The transaction was declined or cancelled.", true);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
    }
    // ==========================================

    if (currentUser.role === "seeker") {
        seekerDashboard.classList.remove("hidden");
        employerDashboard.classList.add("hidden");
        loadSeekerProfileForm();

        // Set filter inputs if passed
        const filterKeywordsEl = document.getElementById("filter-keywords");
        if (filters) {
            if (filterKeywordsEl) filterKeywordsEl.value = filters.keywords || '';
            document.getElementById("filter-location").value = filters.location || '';
            document.getElementById("filter-experience").value = filters.experience || '0';
            document.getElementById("filter-category").value = filters.category || '';
        } else {
            document.getElementById("jobFilterForm").reset();
            if (filterKeywordsEl) filterKeywordsEl.value = '';
        }

        document.querySelectorAll(".job-filter-btn").forEach(b => b.classList.remove('btn-primary'));
        document.querySelector(".job-filter-btn[data-filter='all']").classList.add('btn-primary');
        document.querySelectorAll(".job-view-section").forEach(section => section.classList.add('hidden'));
        document.getElementById('shortlisted-jobs').classList.remove('hidden');
        document.getElementById('all-jobs').classList.remove('hidden');
        document.getElementById('applied-jobs').classList.add('hidden');

        loadJobs(filters || {});
    } else if (currentUser.role === "employer") {
        employerDashboard.classList.remove("hidden");
        seekerDashboard.classList.add("hidden");
        switchEmployerView("employer-management-view");
    }
}

            // ------------------------------------------------------------------
            // 7. SEEKER LOGIC
            // ------------------------------------------------------------------

            async function loadSeekerProfileForm() {
                const currentUser = getLocalUser();
                const seekerJobView = document.getElementById("seeker-job-view");
                const seekerProfileView = document.getElementById("seeker-profile-view");

                document.getElementById("seeker-name").value = currentUser.name || "";
                document.getElementById("seeker-email").value = currentUser.email || "";
                document.getElementById("seeker-skills").value = (currentUser.skills || []).join(", ");
                document.getElementById("seeker-education").value = currentUser.education || "";

                let completionScore = 0;
                const totalChecks = 4;
                if (currentUser.name && currentUser.name.trim() !== '') completionScore++;
                if (currentUser.email && currentUser.email.trim() !== '') completionScore++;
                if (currentUser.education && currentUser.education.trim() !== '') completionScore++;
                if (currentUser.cvfilename && currentUser.cvfilename.trim() !== '') completionScore++;

                const percentage = Math.round((completionScore / totalChecks) * 100);
                document.getElementById("profileCompletionBar").style.width = percentage + "%";
                document.getElementById("profileCompletionText").textContent = percentage + "% Complete";

                const cvFilenameEl = document.getElementById("cv-filename");
                if (currentUser.cvfilename) {
                    cvFilenameEl.innerHTML = `Uploaded: ${currentUser.cvfilename} (<a href="#" class="cv-link" data-filename="${currentUser.cvfilename}">View/Download</a>)`;
                } else {
                    cvFilenameEl.textContent = "No CV uploaded.";
                }

                cvFilenameEl.querySelectorAll('.cv-link').forEach(link => {
                    link.onclick = (e) => {
                        e.preventDefault();
                        window.showStatusMessage("CV View/Download", `Simulating download/view of CV: ${e.target.dataset.filename}.`, false);
                    };
                });

                const editProfileSidebarBtn = document.getElementById("editProfileSidebarBtn");
                if (editProfileSidebarBtn) {
                    editProfileSidebarBtn.onclick = () => {
                        document.getElementById("seeker-profile-view").classList.remove('hidden');
                        document.getElementById("seeker-job-view").classList.add('hidden');
                        loadSeekerProfileForm();
                    };
                }

                document.getElementById("profile-form").onsubmit = async(e) => {
                    e.preventDefault();
                    const saveBtn = e.target.querySelector('button[type="submit"]');
                    setLoading(saveBtn.id || 'profileSaveBtn', true, 'Save Profile');

                    const name = document.getElementById("seeker-name").value;
                    const skills = document.getElementById("seeker-skills").value;
                    const education = document.getElementById("seeker-education").value;
                    const cvFile = document.getElementById("cv-upload").files[0];

                    const formData = new FormData();
                    formData.append('name', name);
                    formData.append('education', education);
                    formData.append('skills', skills);
                    if (cvFile) {
                        formData.append('cvFile', cvFile);
                    }

                    try {
                        const data = await fetchApi('seeker/profile', 'PUT', formData, true);
                        setLocalUser(data.user);
                        window.showStatusMessage("Profile Updated", "Your profile has been saved successfully.", false);
                        seekerJobView.classList.remove('hidden');
                        seekerProfileView.classList.add('hidden');
                        loadSeekerProfileForm();
                    } catch (error) {
                        window.showStatusMessage("Profile Update Failed", error.message, true);
                    } finally {
                        setLoading(saveBtn.id || 'profileSaveBtn', false, 'Save Profile');
                    }
                };
            }

            // JOB APPLICATION LOGIC (Exposed for Share Button / Deep Link)
            window.handleJobApplication = async(jobId, answers) => {
                const user = getLocalUser();
                if (!user) {
                    window.showStatusMessage("Login Required", "Please login to apply.", false);
                    showForm(loginFormContainer);
                    return;
                }
                try {
                    await fetchApi(`seeker/apply/${jobId}`, 'POST', { answers });
                    window.showStatusMessage("Application Successful", "You have successfully applied for this job!", false);
                    loadJobs(); // Refresh job list to update button state
                } catch (error) {
                    window.showStatusMessage("Application Failed", error.message, true);
                }
            };

            async function loadJobs(filters = {}) {
                const allJobsList = document.getElementById("all-jobs-list");
                const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");
                const appliedJobsList = document.getElementById("applied-jobs-list");

                const loadingHTML = '<p class="center-text"><i class="fas fa-spinner fa-spin"></i> Fetching the latest opportunities...</p>';
                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = loadingHTML;

                try {
                    const cleanFilters = {};
                    Object.keys(filters).forEach(key => {
                        if (filters[key] && filters[key] !== '0' && filters[key] !== '') {
                            cleanFilters[key] = filters[key];
                        }
                    });

                    const filterParams = new URLSearchParams(cleanFilters).toString();

                    const [jobs, applicationData] = await Promise.all([
                        fetchApi(`seeker/jobs?${filterParams}`, 'GET'),
                        fetchApi('seeker/applications', 'GET')
                    ]);

                    allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";

                    const appliedJobIds = applicationData.applied.map(job => job.id);

                    // 5. Render "All Available Jobs"
                    if (jobs.length === 0) {
                        allJobsList.innerHTML = `<p class="center-text">No jobs found matching your search.</p>`;
                    } else {
                        jobs.forEach(job => {
                            const isApplied = appliedJobIds.includes(job.id);
                            allJobsList.innerHTML += renderJobCard(job, isApplied);
                        });
                    }

                    // 6. Render "Shortlisted/Recommended"
                    if (applicationData.shortlisted.length === 0) {
                        shortlistedJobsList.innerHTML = `<p class="center-text">No suggestions yet. Update your skills!</p>`;
                    } else {
                        applicationData.shortlisted.forEach(job => {
                            shortlistedJobsList.innerHTML += renderJobCard(job, false);
                        });
                    }

                    // 7. Render "Applied"
                    if (applicationData.applied.length === 0) {
                        appliedJobsList.innerHTML = `<p class="center-text">You haven't applied to any jobs yet.</p>`;
                    } else {
                        applicationData.applied.forEach(job => {
                            appliedJobsList.innerHTML += renderJobCard(job, true);
                        });
                    }

                    setupApplicationListeners();

                } catch (error) {
                    console.error("Job load error:", error);
                    allJobsList.innerHTML = "<p class='center-text error'>Failed to load jobs.</p>";
                }
            }

            const jobFilterForm = document.getElementById("jobFilterForm");
            const resetFiltersBtn = document.getElementById("resetFiltersBtn");

            // Dynamic Keywords Input
            if (jobFilterForm && !document.getElementById('filter-keywords')) {
                const filterKeywordsEl = document.createElement('input');
                filterKeywordsEl.type = 'text';
                filterKeywordsEl.id = 'filter-keywords';
                filterKeywordsEl.placeholder = 'Keywords, Title, Company';

                const keywordsLabel = document.createElement('label');
                keywordsLabel.htmlFor = 'filter-keywords';
                keywordsLabel.textContent = 'Keywords';

                const filterLocationEl = document.getElementById("filter-location");
                if (filterLocationEl) {
                    filterLocationEl.closest('form').insertBefore(filterKeywordsEl, filterLocationEl.closest('form').firstChild);
                    filterLocationEl.closest('form').insertBefore(keywordsLabel, filterKeywordsEl);
                }
            }

            if (jobFilterForm) {
                jobFilterForm.onsubmit = (e) => {
                    e.preventDefault();
                    const keywordsInput = document.getElementById("filter-keywords");
                    const keywords = keywordsInput ? keywordsInput.value : "";
                    const location = document.getElementById("filter-location").value.trim();
                    const salary = document.getElementById("filter-salary").value.trim();
                    const experience = document.getElementById("filter-experience").value;
                    const category = document.getElementById("filter-category").value;

                    const newFilters = {};
                    if (keywords) newFilters.keywords = keywords;
                    if (location) newFilters.location = location;
                    if (salary) newFilters.salary = salary;
                    if (experience && experience !== '0') newFilters.experience = experience;
                    if (category) newFilters.category = category;

                    loadJobs(newFilters);
                };
            }

            if (resetFiltersBtn) {
                resetFiltersBtn.onclick = () => {
                    jobFilterForm.reset();
                    const filterKeywordsEl = document.getElementById("filter-keywords");
                    if (filterKeywordsEl) filterKeywordsEl.value = '';
                    loadJobs({});
                };
            }

            // ------------------------------------------------------------------
            // 8. EMPLOYER DASHBOARD LOGIC
            // ------------------------------------------------------------------
            const employerJobDetailsView = document.getElementById("employer-job-view-details");

            function showJobDetailsView(jobDetails) {
                employerJobDetailsView.innerHTML = `
            <div class="job-detail-header">
                <button class="btn" id="backToManagementBtn"><i class="fas fa-arrow-left"></i> Back to Management</button>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-secondary edit-job-btn" data-job-id="${jobDetails.id}"><i class="fas fa-edit"></i> Edit Job</button>
                    <button class="btn delete-job-btn" data-job-id="${jobDetails.id}"><i class="fas fa-trash-alt"></i> Delete Job</button>
                </div>
            </div>
            <div class="job-detail-content">
                <h2 style="margin-top: 1rem; color: var(--secondary-color);">${jobDetails.title}</h2>
                <p class="font-bold" style="color: var(--accent-color);">${jobDetails.category}</p>
                <div class="job-card-meta" style="margin-bottom: 20px;">
                    <span class="job-location"><i class="fas fa-map-marker-alt"></i> ${jobDetails.location}</span>
                    <span class="job-experience"><i class="fas fa-briefcase"></i> ${jobDetails.experience}</span>
                    <span class="job-salary"><i class="fas fa-money-bill-wave"></i> ${jobDetails.salary}</span>
                </div>
                
                <h3>Job Description</h3>
                <p>${jobDetails.description.split('\n').join('<br>')}</p>

                <h3 class="spaced-heading">Key Requirements</h3>
                <div class="skills">${(jobDetails.required_skills || []).map((s) => `<span>${s}</span>`).join("")}</div>

                <h3 class="spaced-heading">Screening Questions</h3>
                ${jobDetails.screening_questions && jobDetails.screening_questions.length > 0 ?
                `<ul>${jobDetails.screening_questions.map((q, i) => `<li><i class="fas fa-question-circle" style="color: var(--primary-color);"></i> ${q}</li>`).join('')}</ul>` :
                `<p>No mandatory screening questions were set for this job.</p>`
            }
            </div>
        `;

        document.getElementById("backToManagementBtn").onclick = () => switchEmployerView("employer-management-view");
        document.querySelectorAll(".edit-job-btn").forEach((button) => {
            button.onclick = async (e) => {
                e.preventDefault();
                const jobId = parseInt(e.currentTarget.dataset.jobId);
                try {
                    const jobToEdit = await fetchApi(`employer/jobs/${jobId}`, 'GET');
                    editJob(jobId, jobToEdit);
                } catch (error) {
                    window.showStatusMessage("Error", "Could not fetch job details for editing.", true);
                }
            };
        });
        document.querySelectorAll(".delete-job-btn").forEach((button) => {
            button.onclick = (e) => {
                e.preventDefault();
                deleteJob(parseInt(e.currentTarget.dataset.jobId));
            };
        });

        switchEmployerView("employer-job-view-details");
    }

// --- EMPLOYER LOGIC ---

    // EXPORT TO WINDOW (Fixes "ReferenceError")
    window.switchEmployerView = function(targetViewId) {
        
        // 1. Hide all employer sub-views
        document.querySelectorAll("#employer-dashboard .full-screen-view").forEach(view => {
            view.classList.add("hidden");
        });

        // 2. Show the target view
        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.remove("hidden");

            // Load specific data depending on the view
            if (targetViewId === "employer-post-view") loadEmployerPostForm();
            if (targetViewId === "employer-management-view") loadPostedJobs();
            if (targetViewId === "employer-find-applicants-view") loadFindApplicants(); // <--- Key for Find Talent
        }

        // 3. Update Navigation Buttons (Highlight the active tab)
        document.querySelectorAll('#employer-nav-tabs button').forEach(btn => {
            btn.classList.remove('btn-primary');
            
            // Check if this button targets the current view (via data attribute OR click handler)
            const target = btn.getAttribute('data-view-target');
            const onClickAttr = btn.getAttribute('onclick') || "";
            
            if (target === targetViewId || onClickAttr.includes(targetViewId)) {
                btn.classList.add('btn-primary');
            }
        });
    };
    document.getElementById("postNewJobBtn").onclick = () => switchEmployerView("employer-post-view");
    document.getElementById("postJobTab").onclick = () => switchEmployerView("employer-post-view");
    document.getElementById("manageJobsTab").onclick = () => switchEmployerView("employer-management-view");
    document.getElementById("choosePlanTab").onclick = () => showSubscriptionModal();

    function loadEmployerPostForm() {
        const user = getLocalUser();
        const currentPlanKey = user.subscriptionstatus || 'buzz';
        const currentPlan = HIVE_PLANS[currentPlanKey] || HIVE_PLANS['buzz'];

        const isUnlimited = currentPlan.limit === Infinity;
        const currentJobs = user.jobpostcount || 0;
        const jobLimit = currentPlan.limit;
        const statusEl = document.getElementById("employer-subscription-status-small");

        statusEl.innerHTML = isUnlimited ?
            `<a href="#" onclick="event.preventDefault(); window.showSubscriptionModal();" style="color: ${currentPlan.color}">Unlimited Posts (${currentPlan.name})</a>` :
            `<a href="#" onclick="event.preventDefault(); window.showSubscriptionModal();" style="color: ${currentPlan.color}">${currentPlan.name}: ${currentJobs}/${jobLimit} Posts</a>`;

        const canPost = isUnlimited || currentJobs < jobLimit;
        const postJobSubmitBtn = document.getElementById("postJobSubmitBtn");

        document.getElementById("jobStep1Form").classList.remove("hidden");
        document.getElementById("jobStep2Form").classList.add("hidden");
        document.getElementById("jobStep3Form").classList.add("hidden");
        document.getElementById("jobStep3Form").reset();

        postJobSubmitBtn.disabled = !canPost;
        postJobSubmitBtn.textContent = canPost ? "Review & Post Job" : "Limit Reached";
        postJobSubmitBtn.onclick = (e) => {
            e.preventDefault();
            const form = document.getElementById("jobStep3Form");
            if (form.checkValidity()) {
                handleJobPost(e);
            } else {
                form.reportValidity();
            }
        };

        const jobForms = {
            1: document.getElementById("jobStep1Form"),
            2: document.getElementById("jobStep2Form"),
            3: document.getElementById("jobStep3Form"),
        };

        document.querySelectorAll(".next-step-btn").forEach((button) => {
            button.onclick = () => {
                if (!canPost) {
                    window.showStatusMessage("Post Limit Reached", "Upgrade your Hive Plan to post more jobs!", true);
                    showSubscriptionModal();
                    return;
                }
                const currentStep = parseInt(button.dataset.step);
                const currentForm = jobForms[currentStep];
                if (!currentForm.checkValidity()) {
                    currentForm.reportValidity();
                    return;
                }
                currentForm.classList.add("hidden");
                jobForms[currentStep + 1].classList.remove("hidden");
            };
        });

        document.querySelectorAll(".prev-step-btn").forEach((button) => {
            button.onclick = () => {
                const currentStep = parseInt(button.dataset.step);
                jobForms[currentStep].classList.add("hidden");
                jobForms[currentStep - 1].classList.remove("hidden");
            };
        });

        const screeningSelect = document.getElementById("add-screening-questions");
        const screeningContainer = document.getElementById("screening-questions-container");
        screeningContainer.classList.add("hidden");
        screeningSelect.value = "no";
        document.getElementById("sq1").value = document.getElementById("sq2").value = document.getElementById("sq3").value = "";

        screeningSelect.onchange = () => {
            if (screeningSelect.value === 'yes') {
                screeningContainer.classList.remove("hidden");
            } else {
                screeningContainer.classList.add("hidden");
            }
        };
    }

    async function handleJobPost(e, jobId = null) {
        e.preventDefault();
        const postJobSubmitBtn = document.getElementById('postJobSubmitBtn');
        const defaultText = jobId ? 'Save Changes & Update Job' : 'Review & Post Job';
        setLoading('postJobSubmitBtn', true, defaultText);

        const jobData = {
            title: document.getElementById("job-title").value,
            category: document.getElementById("job-category").value,
            location: document.getElementById("job-location").value,
            experience: document.getElementById("job-experience").value,
            salary: document.getElementById("job-salary").value,
            ctc: document.getElementById("job-current-ctc").value,
            requiredSkills: document.getElementById("job-skills").value
                .split(",").map((s) => s.trim()).filter(Boolean),
            description: document.getElementById("job-description").value,
            noticePeriod: document.getElementById("job-notice-period").value,
        };

        const screeningQ = [];
        if (document.getElementById("add-screening-questions").value === 'yes') {
            const q1 = document.getElementById("sq1").value.trim();
            const q2 = document.getElementById("sq2").value.trim();
            const q3 = document.getElementById("sq3").value.trim();

            if (!jobId && (q1 === "" || q2 === "")) {
                window.showStatusMessage("Missing Questions", "Screening Question 1 and 2 are mandatory. Please fill them out or select 'No'.", true);
                setLoading('postJobSubmitBtn', false, defaultText);
                return;
            }
            if (q1) screeningQ.push(q1);
            if (q2) screeningQ.push(q2);
            if (q3) screeningQ.push(q3);
        }
        jobData.screeningQuestions = screeningQ;

        try {
            const response = await fetchApi(`employer/jobs${jobId ? '/' + jobId : ''}`, jobId ? 'PUT' : 'POST', jobData);

            if (response && response.user) {
                setLocalUser(response.user);
            }

            window.showStatusMessage("Success!", `Job has been successfully ${jobId ? 'updated' : 'posted'}.`, false);

            document.getElementById("jobStep3Form").reset();
            document.getElementById("jobStep1Form").reset();
            document.getElementById("jobStep2Form").reset();

            switchEmployerView("employer-management-view");
        } catch (error) {
            window.showStatusMessage("Job Operation Failed", error.message, true);
        } finally {
            setLoading('postJobSubmitBtn', false, defaultText);
        }
    }

    async function loadPostedJobs() {
        const postedJobsList = document.getElementById("posted-jobs-list");
        postedJobsList.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading posted jobs...</p>';

        try {
            const myJobs = await fetchApi('employer/jobs', 'GET');
            postedJobsList.innerHTML = "";

            if (myJobs.length === 0) {
                postedJobsList.innerHTML = "<p>You have not posted any jobs yet. Click 'Post New Job' to start.</p>";
                return;
            }

            myJobs.forEach((job) => {
                const applicantCount = job.applications?.[0]?.count || 0;
                postedJobsList.innerHTML += `
                    <div class="job-card" data-job-id="${job.id}">
                        <div class="job-card-header">
                            <h4 class="job-title">${job.title}</h4>
                            <div class="job-actions">
                                <button class="btn view-applicants-btn" data-job-id="${job.id}" data-job-title="${job.title}">
                                    <i class="fas fa-users"></i> Applicants (<span class="applicant-count">${applicantCount}</span>)
                                </button>
                                <button class="btn btn-secondary edit-job-btn" data-job-id="${job.id}"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn delete-job-btn" data-job-id="${job.id}"><i class="fas fa-trash-alt"></i> Delete</button>
                            </div>
                        </div>
                        <div class="job-card-meta">
                            <span class="job-location"><i class="fas fa-map-marker-alt"></i> ${job.location}</span>
                            <span class="job-posted-date"> | Posted: ${new Date(job.posteddate).toLocaleDateString()}</span>
                        </div>
                    </div>
                `;
            });

            document.querySelectorAll(".job-card").forEach((card) => {
                card.onclick = async (e) => {
                    if (!e.target.closest('.job-actions')) {
                        const jobId = parseInt(card.dataset.jobId);
                        try {
                            const jobDetails = await fetchApi(`employer/jobs/${jobId}`, 'GET');
                            showJobDetailsView(jobDetails);
                        } catch (error) {
                            window.showStatusMessage("Error", "Could not fetch job details.", true);
                        }
                    }
                };
            });

            document.querySelectorAll(".view-applicants-btn").forEach((button) => {
                button.onclick = (e) => {
                    e.preventDefault();
                    showApplicantsModal(parseInt(e.currentTarget.dataset.jobId));
                };
            });
            document.querySelectorAll(".edit-job-btn").forEach((button) => {
                button.onclick = async (e) => {
                    e.preventDefault();
                    const jobId = parseInt(e.currentTarget.dataset.jobId);
                    try {
                        const jobToEdit = await fetchApi(`employer/jobs/${jobId}`, 'GET');
                        editJob(jobId, jobToEdit);
                    } catch (error) {
                        window.showStatusMessage("Error", "Could not fetch job details for editing.", true);
                    }
                };
            });
            document.querySelectorAll(".delete-job-btn").forEach((button) => {
                button.onclick = (e) => {
                    e.preventDefault();
                    deleteJob(parseInt(e.currentTarget.dataset.jobId));
                };
            });

        } catch (error) {
            postedJobsList.innerHTML = `<p style='color:red;'>Failed to load posted jobs: ${error.message}</p>`;
        }
    }

    async function editJob(jobId, jobToEdit) {
        const result = await showConfirmation(`Edit Job: ${jobToEdit.title}`, "Are you sure you want to edit this job? This will pre-fill the posting form.", false, 'Edit Now');
        if (!result) return;

        document.getElementById("job-title").value = jobToEdit.title || '';
        document.getElementById("job-category").value = jobToEdit.category || '';
        document.getElementById("job-location").value = jobToEdit.location || '';
        document.getElementById("job-experience").value = jobToEdit.experience || '';
        document.getElementById("job-salary").value = jobToEdit.salary || '';
        document.getElementById("job-current-ctc").value = jobToEdit.ctc || '';
        document.getElementById("job-skills").value = (jobToEdit.required_skills || []).join(", ");
        document.getElementById("job-description").value = jobToEdit.description || '';
        document.getElementById("job-notice-period").value = jobToEdit.notice_period || '';

        const screeningSelect = document.getElementById("add-screening-questions");
        const screeningContainer = document.getElementById("screening-questions-container");
        const questions = jobToEdit.screening_questions || [];

        if (questions.length > 0) {
            screeningSelect.value = "yes";
            screeningContainer.classList.remove("hidden");
            document.getElementById("sq1").value = questions[0] || '';
            document.getElementById("sq2").value = questions[1] || '';
            document.getElementById("sq3").value = questions[2] || '';
        } else {
            screeningSelect.value = "no";
            screeningContainer.classList.add("hidden");
        }

        const postJobSubmitBtn = document.getElementById("postJobSubmitBtn");
        postJobSubmitBtn.textContent = "Save Changes & Update Job";
        postJobSubmitBtn.onclick = (e) => handleJobPost(e, jobId);

        document.getElementById("jobStep1Form").classList.remove("hidden");
        document.getElementById("jobStep2Form").classList.add("hidden");
        document.getElementById("jobStep3Form").classList.add("hidden");

        switchEmployerView("employer-post-view");
    }

    async function deleteJob(jobId) {
        const result = await showConfirmation(`Confirm Deletion`, "Are you sure you want to delete this job? This action cannot be undone.", false, 'Yes, Delete It');
        if (!result) return;

        try {
            const response = await fetchApi(`employer/jobs/${jobId}`, 'DELETE');
            if (response && response.user) {
                setLocalUser(response.user);
            }
            window.showStatusMessage("Job Deleted", "The job has been permanently removed.", false);
            loadPostedJobs();
        } catch (error) {
            window.showStatusMessage("Deletion Failed", error.message, true);
        }
    }

    // --- Global State for Applicant Filtering ---
    let currentApplicants = [];
    let currentJobMetadata = {};
    // Store the ID of the job currently being viewed in the modal
    let currentModalJobId = null;

    async function showApplicantsModal(jobId) {
        const listElement = document.getElementById("applicants-list");
        listElement.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading applicants...</p>';
        
        currentModalJobId = jobId; // Store ID for later use

        try {
            const data = await fetchApi(`employer/applicants/${jobId}`, 'GET');
            
            // Store data globally for the filter function
            currentApplicants = data.applicants;
            currentJobMetadata = {
                title: data.jobTitle,
                screeningQuestions: data.screeningQuestions || []
            };

            document.getElementById("applicants-job-title").textContent = currentJobMetadata.title;

            // Clear previous content to force a fresh render of filters
            listElement.innerHTML = '';
            
            // Render the initial full list (and the filter bar)
            renderApplicantsView(currentApplicants);
            
            // Show modal
            document.getElementById("applicantsModal").style.display = "block";

        } catch (error) {
            listElement.innerHTML = `<p style='color:red;'>Failed to load applicants: ${error.message}</p>`;
        }
    }
// ==========================================
// NEW: FIND APPLICANTS LOGIC (Vanilla JS)
// ==========================================

let allCandidatesData = []; // Store data globally for search filtering

async function loadFindApplicants() {
    const grid = document.getElementById("all-candidates-grid");
    grid.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading talent pool...</p>';

    try {
        // Fetch from backend
        const candidates = await fetchApi('talent/candidates', 'GET');
        allCandidatesData = candidates; // Save for filtering
        renderCandidateGrid(candidates);
    } catch (error) {
        grid.innerHTML = `<p style="color:red;">Error loading candidates: ${error.message}</p>`;
    }
}

function renderCandidateGrid(candidates) {
    const grid = document.getElementById("all-candidates-grid");
    
    if (!candidates || candidates.length === 0) {
        grid.innerHTML = '<p>No candidates found.</p>';
        return;
    }

    grid.innerHTML = candidates.map(c => {
        // 1. Handle Skills (Ensure it's an array)
        let skillsArray = [];
        if (Array.isArray(c.skills)) {
            skillsArray = c.skills;
        } else if (typeof c.skills === 'string') {
            skillsArray = c.skills.split(',').map(s => s.trim());
        }

        // 2. Format Field of Work
        const fieldOfWork = c.category || c.title || 'Job Seeker';

        return `
        <div class="candidate-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: 1px solid #eee; display: flex; flex-direction: column; justify-content: space-between;">
            
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 50px; height: 50px; background: #007bff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; flex-shrink: 0;">
                    ${c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 18px; color: #333; word-break: break-word;">${c.name}</h3>
                    <span style="font-size: 14px; color: #666; font-weight: 500;">
                        <i class="fas fa-briefcase" style="font-size:0.8rem;"></i> ${fieldOfWork}
                    </span>
                </div>
            </div>
            
            <div style="font-size: 14px; color: #555; margin-bottom: 15px;">
                <div style="margin-bottom: 10px;">
                    <i class="fas fa-envelope" style="color: #007bff;"></i> ${c.email}
                </div>

                <div style="margin-top: 10px;">
                    <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 5px; color: #444;">Top Skills:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${skillsArray.length > 0 
                            ? skillsArray.slice(0, 4).map(skill => 
                                `<span style="background: #f0f2f5; color: #333; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid #ddd;">${skill}</span>`
                              ).join('')
                            : '<span style="color:#999; font-style:italic;">No skills listed</span>'
                        }
                        ${skillsArray.length > 4 ? `<span style="font-size: 11px; color: #666; padding-top:4px;">+${skillsArray.length - 4} more</span>` : ''}
                    </div>
                </div>
            </div>

            <button class="btn btn-primary view-candidate-btn" data-id="${c.id}" style="width: 100%; margin-top: auto;">
                View Profile
            </button>
        </div>
    `}).join('');

    // Attach click listeners to new buttons
    document.querySelectorAll('.view-candidate-btn').forEach(btn => {
        btn.onclick = () => showCandidateModal(btn.dataset.id);
    });
}

// Search Logic
document.getElementById('candidateSearchInput').addEventListener('keyup', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allCandidatesData.filter(c => c.name.toLowerCase().includes(term));
    renderCandidateGrid(filtered);
});

// Modal Logic
function showCandidateModal(candidateId) {
    // Find candidate from local data (no need to fetch again if we have basic info)
    // Or fetch full details if needed: await fetchApi(`employer/candidate/${id}`)
    const candidate = allCandidatesData.find(c => c.id == candidateId);
    if (!candidate) return;

    const modalBody = document.getElementById("candidate-modal-body");
    modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; background: #007bff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; margin: 0 auto 10px auto;">
                ${candidate.name.charAt(0).toUpperCase()}
            </div>
            <h2>${candidate.name}</h2>
            <p style="color: #666;">Ready to work</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <label style="font-size: 12px; font-weight: bold; color: #999;">EMAIL</label>
                <div>${candidate.email}</div>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <label style="font-size: 12px; font-weight: bold; color: #999;">PHONE</label>
                <div>${candidate.phone || "Not Provided"}</div>
            </div>
        </div>

        <div style="border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>Resume / CV</strong><br>
                <span style="font-size: 12px; color: #666;">PDF Document</span>
            </div>
            ${candidate.cvfilename ? 
                `<a href="${candidate.cvfilename}" target="_blank" class="btn btn-primary">Download CV</a>` : 
                `<span style="color: #999;">No CV Uploaded</span>`
            }
        </div>
    `;

    document.getElementById("candidateDetailsModal").style.display = "block";
}

// Close Modal Logic
document.getElementById("closeCandidateModal").onclick = () => {
    document.getElementById("candidateDetailsModal").style.display = "none";
};
    /**
     * Core Filter Logic
     * Runs every time a user types in a filter box
     */
    window.filterApplicants = () => {
        const skillFilter = document.getElementById("filter-app-skill")?.value.toLowerCase();
        const expFilter = document.getElementById("filter-app-exp")?.value;
        const locFilter = document.getElementById("filter-app-loc")?.value.toLowerCase();
        const salaryFilter = document.getElementById("filter-app-salary")?.value;
        const noticeFilter = document.getElementById("filter-app-notice")?.value.toLowerCase();
        const statusFilter = document.getElementById("filter-app-status")?.value;

        const filtered = currentApplicants.filter(app => {
            // 1. Skills (check if ANY skill matches)
            const skillsStr = (app.skills || []).join(" ").toLowerCase();
            const matchesSkill = !skillFilter || skillsStr.includes(skillFilter);

            // 2. Experience & Location & Salary & Notice
            // We search these in profile data AND screening answers (Q1/Q2/Q3) for maximum flexibility
            const allTextData = [
                app.experience, 
                app.location, 
                ...(app.applicationAnswers || [])
            ].join(" ").toLowerCase();

            const matchesExp = !expFilter || allTextData.includes(expFilter.toLowerCase());
            const matchesLoc = !locFilter || allTextData.includes(locFilter);
            const matchesSalary = !salaryFilter || allTextData.includes(salaryFilter.toLowerCase());
            const matchesNotice = !noticeFilter || allTextData.includes(noticeFilter);

            // 3. Status
            const matchesStatus = !statusFilter || app.status === statusFilter;

            return matchesSkill && matchesExp && matchesLoc && matchesStatus && matchesSalary && matchesNotice;
        });

        renderApplicantsView(filtered);
    };

    /**
     * Renders the Applicants View
     * Optimized to only update the table body on subsequent calls to prevent focus loss
     */
    function renderApplicantsView(applicantsToRender) {
        const listElement = document.getElementById("applicants-list");
        
        // 1. If filter bar doesn't exist, create the skeleton (Header + Table Structure)
        if (!document.getElementById("filter-app-skill")) {
            const filterHTML = `
                <div class="applicant-filters" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                    <h4 style="margin-top:0; margin-bottom: 10px; font-size: 1rem;"><i class="fas fa-filter"></i> Filter Candidates</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                        <input type="text" id="filter-app-skill" placeholder="Skills (e.g. Java)" onkeyup="filterApplicants()">
                        <input type="text" id="filter-app-exp" placeholder="Exp (e.g. 5)" onkeyup="filterApplicants()">
                        <input type="text" id="filter-app-loc" placeholder="Location" onkeyup="filterApplicants()">
                        <input type="text" id="filter-app-salary" placeholder="Salary" onkeyup="filterApplicants()">
                        <input type="text" id="filter-app-notice" placeholder="Notice Period" onkeyup="filterApplicants()">
                        <select id="filter-app-status" onchange="filterApplicants()" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                            <option value="">All Statuses</option>
                            <option value="applied">Applied</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>
                    <div id="applicant-count" style="margin-top: 10px; font-size: 0.85rem; color: #666;"></div>
                </div>
                <div class="table-responsive" style="overflow-x: auto;">
                    <table class="table-hover" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr id="applicant-table-headers"></tr>
                        </thead>
                        <tbody id="applicant-table-body"></tbody>
                    </table>
                </div>
            `;
            listElement.innerHTML = filterHTML;
        }

        // 2. Update Count
        document.getElementById("applicant-count").innerHTML = `Showing <strong>${applicantsToRender.length}</strong> candidates`;

        // 3. Update Headers (only if empty)
        const headerRow = document.getElementById("applicant-table-headers");
        if (headerRow.innerHTML === "") {
            const screeningHeaders = currentJobMetadata.screeningQuestions.map((q, index) => `<th>Q${index + 1}</th>`).join('');
            headerRow.innerHTML = `
                <th>Candidate</th>
                <th>Phone</th>
                <th>Skills</th>
                <th>Exp</th>
                <th>CV</th>
                ${screeningHeaders}
                <th>Status</th>
                <th>Action</th>
            `;
        }

        // 4. Update Body Rows
        const tbody = document.getElementById("applicant-table-body");
        
        if (applicantsToRender.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem;">No applicants match your filters.</td></tr>`;
        } else {
            tbody.innerHTML = applicantsToRender.map(app => {
                const getAnswer = (idx) => app.applicationAnswers && app.applicationAnswers[idx] ? app.applicationAnswers[idx] : '-';
                
                // Use currentModalJobId if app.jobId is missing from the joined data
                const jobId = app.jobId || currentModalJobId;

                return `
                <tr data-seeker-id="${app.seekerid}" style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">
                        <strong>${app.name}</strong><br>
                        <span style="font-size:0.85rem; color:#666;">${app.email}</span>
                    </td>
                    <td style="padding: 10px;">${app.phone || '-'}</td>
                    <td style="padding: 10px;">${(app.skills || []).join(", ") || '-'}</td>
                    <td style="padding: 10px;">${app.experience || '-'}</td> 
                    <td style="padding: 10px;">
                        ${app.cvfilename ? `<a href="#" class="cv-link" data-filename="${app.cvfilename}" style="color: var(--primary-color); text-decoration: underline;"><i class="fas fa-file-pdf"></i> View</a>` : '-'}
                    </td>
                    ${currentJobMetadata.screeningQuestions.map((_, i) => `<td style="padding: 10px;">${getAnswer(i)}</td>`).join('')}
                    <td style="padding: 10px;"><span class="badge badge-${app.status.toLowerCase()}">${app.status}</span></td>
                    <td class="applicant-actions" style="padding: 10px;">
                        ${app.status === 'applied' ? `
                            <button class="btn btn-primary btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${app.seekerid}" data-new-status="Shortlisted" title="Shortlist" style="margin-right: 5px;"><i class="fas fa-check"></i></button>
                            <button class="btn btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${app.seekerid}" data-new-status="Rejected" title="Reject"><i class="fas fa-times"></i></button>
                        ` : (app.status === 'Shortlisted' ? `
                            <button class="btn btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${app.seekerid}" data-new-status="Rejected">Reject</button>
                        ` : '<i style="color:#888;">Complete</i>')}
                    </td>
                </tr>
            `}).join('');
        }

        // 5. Re-attach listeners to the new HTML elements
        tbody.querySelectorAll('.cv-link').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                // Simulation of CV View - Replace with actual secure URL logic if available
                window.showStatusMessage("CV View", `Opening CV: ${e.currentTarget.dataset.filename}`, false);
            };
        });
        
        addApplicantActionListeners();
    }

    function addApplicantActionListeners() {
        document.querySelectorAll('.applicant-actions .action-btn').forEach(button => {
            button.onclick = async (e) => {
                const btn = e.currentTarget;
                const { jobId, seekerId, newStatus } = btn.dataset;
                
                // UI Feedback: Show spinner in the actions cell
                const actionsCell = btn.closest('td');
                const originalContent = actionsCell.innerHTML;
                actionsCell.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

                try {
                    await fetchApi('employer/applicants/status', 'PUT', {
                        jobId: parseInt(jobId),
                        seekerId: seekerId,
                        newStatus: newStatus
                    });
                    
                    // Update global state so filtering keeps working with new status
                    const applicantIndex = currentApplicants.findIndex(a => a.seekerid === seekerId);
                    if(applicantIndex > -1) {
                        currentApplicants[applicantIndex].status = newStatus;
                    }

                    // Re-filter/Re-render to show updated status immediately
                    // This is better than reloading from server as it preserves filter state
                    window.filterApplicants(); 
                    
                } catch (error) {
                    window.showStatusMessage("Update Failed", error.message, true);
                    actionsCell.innerHTML = originalContent; // Revert button if failed
                    addApplicantActionListeners(); // Re-attach listeners to reverted button
                }
            };
        });
    }
    // ------------------------------------------------------------------
    // 9. ADMIN LOGIC (SIMULATED)
    // ------------------------------------------------------------------
    async function initAdmin() {
        document.getElementById("total-seekers").textContent = '1,200';
        document.getElementById("total-employers").textContent = '450';
        document.getElementById("total-jobs").textContent = '98';
        document.getElementById("total-subscriptions").textContent = '15 (Simulated)';
        document.getElementById("job-seekers-list").innerHTML = "<p>Admin data is simulated. Showing mock user list.</p>";
        document.getElementById("employer-profiles-list").innerHTML = "<p>Admin data is simulated. Showing mock employer list.</p>";
    }

    // ------------------------------------------------------------------
    // 10. CHATBOT LOGIC
    // ------------------------------------------------------------------
    const chatBtn = document.getElementById('chat-icon-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatBody = document.getElementById('chat-body');
    const chatInputField = document.getElementById('chat-input-field');
    const chatSendBtn = document.getElementById('chat-send-btn');

    const appendMessage = (text, sender) => {
        const messageDiv = document.createElement('p');
        messageDiv.classList.add('chat-message');
        messageDiv.classList.add(sender === 'bot' ? 'bot-message' : 'user-message');
        messageDiv.innerHTML = text;
        chatBody.appendChild(messageDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    };

    window.guideUser = (viewName, sectionId) => {
        chatWindow.classList.add('hidden');
        showView(viewName);
        if (sectionId) {
            setTimeout(() => {
                const targetEl = document.getElementById(sectionId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    };

    const handleChatInput = () => {
        const message = chatInputField.value.trim();
        if (message === '') return;

        appendMessage(message, 'user');
        chatInputField.value = '';

        setTimeout(() => {
            const lowerMsg = message.toLowerCase();
            let botResponse = `I'm sorry, I still couldn't understand that query. I can help you navigate the site using keywords like **Domains**, **Plans**, **Dashboard**, **About Us**, or general **Support**.`;

            if (lowerMsg.includes('domain') || lowerMsg.includes('job categories')) {
                botResponse = `HireHive features opportunities in **IT & Tech**, **Sales**, and **Management**. <a href="#" onclick="window.guideUser('home', 'services'); return false;">Click here to view all domains on the page.</a>`;
            } else if (lowerMsg.includes('about') || lowerMsg.includes('who are you') || lowerMsg.includes('mission')) {
                botResponse = `We are HireHive, a modern career ecosystem connecting top talent with employers through affordable plans. <a href="#" onclick="window.guideUser('about', null); return false;">Learn more about our mission.</a>`;
            } else if (lowerMsg.includes('support') || lowerMsg.includes('help') || lowerMsg.includes('contact')) {
                botResponse = `For dedicated support or business inquiries, please visit our <a href="#" onclick="window.guideUser('contact', null); return false;">**Contact Us**</a> page.`;
            } else if (lowerMsg.includes('dashboard') || lowerMsg.includes('portal') || lowerMsg.includes('jobs')) {
                const user = getLocalUser();
                if (user) {
                    botResponse = `You are logged in as a **${user.role}**. <a href="#" onclick="window.guideUser('dashboard', null); return false;">Click here to jump straight to your Dashboard!</a>`;
                } else {
                    botResponse = `To access your dashboard, you need to log in first. Please use the **Login** or **Join the Hive** buttons.`;
                }
            } else if (lowerMsg.includes('plans') || lowerMsg.includes('pricing') || lowerMsg.includes('subscription')) {
                botResponse = `Subscription plans are only required for **Employers** to post jobs. <a href="#" onclick="window.guideUser('plans', null); return false;">Click here to see the Hive Plans.</a>`;
            }

            appendMessage(botResponse, 'bot');
        }, 1000);
    };

    if (chatBtn) {
        chatBtn.onclick = () => {
            chatWindow.classList.toggle('hidden');
            if (!chatWindow.classList.contains('hidden')) {
                chatInputField.focus();
                chatBody.scrollTop = chatBody.scrollHeight;
            }
        };
    }
    if (chatCloseBtn) chatCloseBtn.onclick = () => chatWindow.classList.add('hidden');
    if (chatSendBtn) chatSendBtn.onclick = handleChatInput;
    if (chatInputField) {
        chatInputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChatInput();
        });
    }

    // ------------------------------------------------------------------
    // 11. DEEP LINKING CHECK
    // ------------------------------------------------------------------
    // Check if user arrived via a Shared Link
    const urlParams = new URLSearchParams(window.location.search);
    const sharedJobId = urlParams.get('jobId');

    if (sharedJobId) {
        const user = getLocalUser();
        if (user) {
            // 1. Switch to Dashboard
            showView('dashboard'); 
            
            // 2. Wait a moment for jobs to load, then highlight the shared job
            setTimeout(() => {
                const targetCard = document.getElementById(`job-card-${sharedJobId}`);
                if (targetCard) {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetCard.style.border = "2px solid var(--primary-color)";
                    targetCard.style.boxShadow = "0 0 15px rgba(255, 193, 7, 0.5)";
                    window.showStatusMessage("Found the shared job! 🎯", "Here is the job you were looking for.", false);
                }
            }, 2000); 
        } else {
            window.showStatusMessage("Login Required", "Please login to see this shared job.", false);
            showForm(loginFormContainer);
        }
        // Clean URL so the ID doesn't stick if they refresh
        window.history.replaceState({}, document.title, window.location.pathname);
    }
// --- Toggle Password Visibility Logic ---
    const toggleLoginPwBtn = document.getElementById('toggleLoginPassword');
    const loginPwInput = document.getElementById('loginPassword');

    if (toggleLoginPwBtn && loginPwInput) {
        toggleLoginPwBtn.addEventListener('click', function() {
            // Check current type
            const type = loginPwInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPwInput.setAttribute('type', type);
            
            // Toggle Icon Class (Eye vs Eye-Slash)
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
    function renderJobCard(job, isApplied) {
    // Escape quotes to prevent HTML breaking in the onclick handler
    const safeTitle = (job.title || '').replace(/'/g, "\\'");
    
    // FIX: Removed the space between ? and . (job.employer?.name)
    const safeCompany = (job.employer?.name || 'Company').replace(/'/g, "\\'");

    return `
        <div class="job-card ${isApplied ? 'applied-opacity' : ''}" id="job-card-${job.id}">
            <div class="job-card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h4 style="margin: 0; padding-right: 10px;">${job.title}</h4>
                
                <button class="btn-icon share-btn" 
                    onclick="window.shareJob('${job.id}', '${safeTitle}', '${safeCompany}')"
                    title="Share this Job" style="background:none; border:none; color:var(--primary-color); cursor:pointer;">
                    <i class="fas fa-share-alt" style="font-size: 1.2rem;"></i>
                </button>
            </div>
            
            <p><i class="fas fa-building"></i> ${job.employer?.name || 'Company'}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${job.location}</p>
            
            <div class="job-card-meta" style="display: flex; gap: 15px; color: #666; font-size: 0.9rem; margin: 5px 0;">
                <span><i class="fas fa-money-bill-wave"></i> ${job.salary || 'Not Disclosed'}</span>
                <span><i class="fas fa-briefcase"></i> ${job.experience} Yrs</span>
            </div>

            <div class="skills" style="margin: 10px 0;">
                ${(job.required_skills || []).map(skill => 
                    `<span style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-right: 5px;">${skill}</span>`
                ).join('')}
            </div>

            <button class="btn btn-primary apply-btn" 
                data-id="${job.id}" 
                data-title="${job.title}" 
                ${isApplied ? 'disabled' : ''}
                style="width: 100%; margin-top: 10px;">
                ${isApplied ? 'Applied' : 'Apply Now'}
            </button>
        </div>
    `;
}
// --- NEW: Load Recent Jobs for Homepage ---
    async function loadHomepageJobs() {
        const container = document.getElementById('homepage-job-list');
        if (!container) return; // Exit if not on home page

        try {
            // Fetch from the NEW Public Route
            const response = await fetch(`${BASE_URL}/public/jobs`); 
            
            if (!response.ok) throw new Error("Failed to fetch public jobs");
            
            const jobs = await response.json();

            if (jobs.length === 0) {
                container.innerHTML = '<p>No jobs posted recently.</p>';
                return;
            }

            container.innerHTML = jobs.map(job => {
                const safeTitle = (job.title || '').replace(/'/g, "\\'");
                const safeCompany = (job.employer?.name || 'Company').replace(/'/g, "\\'");
                
                return `
                <div class="home-job-card">
                    <h4>${job.title}</h4>
                    <span class="home-job-company"><i class="fas fa-building"></i> ${job.employer?.name || 'Company'}</span>
                    
                    <div class="home-job-details">
                        <span><i class="fas fa-map-marker-alt"></i> ${job.location}</span>
                        <span><i class="fas fa-briefcase"></i> ${job.experience} Yrs</span>
                    </div>

                    <button class="btn btn-primary" onclick="triggerGuestApply('${job.id}')">
                        Apply Now
                    </button>
                </div>
                `;
            }).join('');

        } catch (error) {
            console.error("Home jobs error:", error);
            container.innerHTML = '<p>Connect to the Hive to see jobs.</p>';
        }
    }

    // --- Helper for Guest Application ---
    window.triggerGuestApply = (jobId) => {
        const user = getLocalUser();
        if (user) {
            // If logged in, go straight to dashboard job
            window.location.href = `/?jobId=${jobId}`; 
        } else {
            // If guest, force login flow via Deep Link
            // This reloads page -> Checks Deep Link -> Sees No User -> Opens Login Modal
            window.location.href = `/?jobId=${jobId}`; 
        }
    };

    // CALL THIS AT THE END OF YOUR INITIALIZATION
    loadHomepageJobs();
}); // END DOMContentLoade