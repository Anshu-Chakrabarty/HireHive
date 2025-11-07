// --- Frontend: app.js (FINAL RAZORPAY COMMENTED OUT) ---
document.addEventListener("DOMContentLoaded", () => {
            // ------------------------------------------------------------------
            // 1. GLOBAL CONFIGURATION & API HELPERS
            // ------------------------------------------------------------------
            const BASE_URL = "https://hirehive-api.onrender.com/api";

            // Reusable token and user storage helpers (using localStorage for token, sessionStorage for user cache)
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
            document.querySelectorAll('.status-close-btn').forEach(btn => {
                btn.onclick = () => { statusMessageModal.style.display = 'none'; };
            });

            const showStatusMessage = (title, body, isError = false) => {
                document.getElementById("statusMessageTitle").textContent = title;
                document.getElementById("statusMessageBody").textContent = body;
                if (isError) {
                    document.getElementById("statusMessageTitle").style.color = 'red';
                } else {
                    document.getElementById("statusMessageTitle").style.color = '#343a40';
                }
                statusMessageModal.style.display = 'block';
            };

            // --- Custom Confirmation/Prompt Modals (Replacing browser's blocking dialogs) ---
            const confirmationModal = document.getElementById("confirmationModal");
            const confirmTitleEl = document.getElementById("confirmTitle");
            const confirmBodyEl = document.getElementById("confirmBody");
            const confirmInputEl = document.getElementById("confirmInput");
            const confirmOKBtn = document.getElementById("confirmOKBtn");
            const confirmCancelBtn = document.getElementById("confirmCancelBtn");

            /**
             * Shows an asynchronous confirmation or prompt modal, replacing browser's blocking dialogs.
             */
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
                        cleanup(isPrompt ? null : false); // Return null for prompt cancellation
                    };
                });
            };

            // --- Subscription Plan Limits & Details (Prices REMOVED) ---
            const HIVE_PLANS = {
                'buzz': { name: "Buzz Plan", limit: 2, icon: "fas fa-bug", color: "#28a745", description: "Post 2 free job listing. Access to limited candidate applications." },
                'worker': { name: "Worker Plan", limit: 5, icon: "fas fa-user-tie", color: "#007bff", description: "Post up to 5 active jobs. Access to 50 candidate resumes." },
                'colony': { name: "Colony Plan", limit: 15, icon: "fas fa-industry", color: "#fd7e14", description: "Post up to 15 active jobs. Access to unlimited resume downloads." },
                'queen': { name: "Queen Plan", limit: 30, icon: "fas fa-crown", color: "#6f42c1", description: "Post up to 30 active jobs. Access to premium candidate database." },
                'hive_master': { name: "Hive Master Plan", limit: Infinity, icon: "fas fa-trophy", color: "#dc3545", description: "Unlimited job postings. Full candidate database access." },
            };

            async function fetchApi(endpoint, method = 'GET', data = null, isFormData = false) {
                const token = getToken();
                const url = `${BASE_URL}/${endpoint}`;
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const config = { method, headers };
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
                        console.error("Backend Error:", errorText);
                        throw new Error(`Server returned status ${response.status}. Check backend logs.`);
                    }
                    return {};
                } catch (error) {
                    console.error("Fetch API Error:", error);
                    if (error.message.includes("Unexpected token") || error.message.includes("JSON.parse")) {
                        throw new Error("Server returned an invalid response. Please check the backend configuration.");
                    }
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
            };

            const dashboardLink = document.getElementById("dashboardLink");
            const adminLink = document.getElementById("adminLink");
            const loginBtn = document.getElementById("loginBtn");
            const signupBtn = document.getElementById("signupBtn");
            const logoutBtn = document.getElementById("logoutBtn");
            const welcomeMessage = document.getElementById("welcome-message");
            const menuToggle = document.getElementById('menuToggle');
            const navLinks = document.getElementById('navLinks');
            const employerDashboard = document.getElementById("employer-dashboard");

            // Initialize Mobile Menu Toggle
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

            async function updateHeaderUI() {
                let user = getLocalUser();
                const token = getToken();
                [loginBtn, signupBtn, logoutBtn, dashboardLink, adminLink, welcomeMessage].forEach(el => el.classList.add("hidden"));
                welcomeMessage.textContent = "";

                if (token) {
                    if (!user) {
                        try {
                            const data = await fetchApi('auth/me', 'GET');
                            user = data.user;
                            setLocalUser(user);
                        } catch (e) {
                            console.warn("Token expired or invalid. Logging out.", e.message);
                            removeToken();
                            setLocalUser(null);
                            window.location.hash = '';
                            updateHeaderUI();
                            return;
                        }
                    }
                    logoutBtn.classList.remove("hidden");
                    dashboardLink.classList.remove("hidden");
                    welcomeMessage.classList.remove("hidden");
                    welcomeMessage.textContent = `Welcome, ${user.name.split(' ')[0]}`;
                    if (user.role === 'admin') {
                        adminLink.classList.remove("hidden");
                    }
                } else {
                    loginBtn.classList.remove("hidden");
                    signupBtn.classList.remove("hidden");
                    setLocalUser(null);
                }

                const hash = window.location.hash.replace('#', '');
                let targetView = hash || 'home';
                if (token && user && (targetView === 'home' || targetView === '')) {
                    targetView = (user.role === 'admin') ? 'admin' : 'dashboard';
                } else if (!token && (targetView === 'dashboard' || targetView === 'admin')) {
                    targetView = 'home';
                }

                showView(targetView, false, null);
            }

            const showView = (viewName, updateHash = true, filters = null) => {
                Object.values(views).forEach(v => v.classList.add("hidden"));
                let viewToShow = views[viewName];

                if (!viewToShow) {
                    viewToShow = views['home'];
                    viewName = 'home';
                }

                viewToShow.classList.remove("hidden");

                if (viewName === 'dashboard') initDashboard(filters);
                if (viewName === 'admin') initAdmin();


                if (updateHash) {
                    const hash = (viewName === 'home') ? '' : `#${viewName}`;
                    if (window.location.hash !== hash) {
                        history.pushState(null, '', hash);
                    }
                }

                if (!viewName.includes('home-link')) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };

            window.addEventListener('hashchange', () => {
                const hash = window.location.hash.replace('#', '');
                const viewName = hash || 'home';
                showView(viewName, false, null);
            });

            document.querySelectorAll('[data-view]').forEach(el => {
                el.addEventListener('click', (e) => {
                    const view = el.dataset.view;
                    if (view === 'home-link') {
                        e.preventDefault();
                        showView('home');
                        setTimeout(() => document.getElementById('services').scrollIntoView({ behavior: 'smooth' }), 0);
                        return;
                    }
                    if (view && views[view]) {
                        e.preventDefault();
                        showView(view, true, null);
                    }
                });
            });

            logoutBtn.onclick = () => {
                removeToken();
                setLocalUser(null);
                window.location.hash = '';
                updateHeaderUI();
            };

            updateHeaderUI();

            document.querySelectorAll(".opportunity-link").forEach((link) => {
                link.addEventListener("click", (e) => {
                    e.preventDefault();
                    const currentUser = getLocalUser();
                    if (currentUser && currentUser.role === 'seeker') {
                        const category = e.currentTarget.textContent.trim();
                        const filters = { category: category };
                        showView('dashboard', true, filters);
                    } else if (currentUser && currentUser.role === 'employer') {
                        showStatusMessage("Employer Action", "You are an Employer. Access your dashboard to manage jobs.", false);
                        showView('dashboard');
                    } else {
                        showStatusMessage("Login Required", "Please log in or sign up as a Job Seeker to view opportunities.", false);
                        showForm(document.getElementById("login-form-container"));
                    }
                });
            });

            // ------------------------------------------------------------------
            // 3. AUTH & MODAL LOGIC (Simplified)
            // ------------------------------------------------------------------
            const authModal = document.getElementById("authModal");
            const loginFormContainer = document.getElementById("login-form-container");
            const signupFormContainer = document.getElementById("signup-form-container");
            const otpFormContainer = document.getElementById("otp-form-container");
            const closeAuthBtn = document.querySelector("#authModal .close-btn");
            const applicantsModal = document.getElementById("applicantsModal");
            const subscriptionModal = document.getElementById("subscriptionModal");
            const closeApplicantsModalBtn = document.getElementById("close-applicants-modal");
            const userTypeSelect = document.getElementById("userType");
            const companyNameInput = document.getElementById("signupCompanyName");
            const switchToOtpLink = document.getElementById("switch-to-otp");
            const switchFormLink = document.getElementById("switch-form-link");

            const showForm = (formToShow) => {
                [loginFormContainer, signupFormContainer, otpFormContainer].forEach((f) => f.classList.add("hidden"));
                formToShow.classList.remove("hidden");
                authModal.style.display = "block";
                const isLogin = formToShow === loginFormContainer;
                if (switchFormLink) {
                    switchFormLink.textContent = isLogin ?
                        "Need an account? Sign Up" :
                        "Already have an account? Log In";
                }
                if (formToShow === signupFormContainer) {
                    userTypeSelect.value = 'seeker';
                    companyNameInput.classList.add('hidden');
                    companyNameInput.required = false;
                }
            };
            if (loginBtn) { loginBtn.onclick = () => showForm(loginFormContainer); }
            if (signupBtn) { signupBtn.onclick = () => showForm(signupFormContainer); }
            if (closeAuthBtn) { closeAuthBtn.onclick = () => { authModal.style.display = "none"; }; }
            if (closeApplicantsModalBtn) { closeApplicantsModalBtn.onclick = () => { applicantsModal.style.display = "none"; }; }

            // Global modal close logic
            window.onclick = (event) => {
                if (event.target == authModal) authModal.style.display = "none";
                if (event.target == applicantsModal) applicantsModal.style.display = "none";
                if (event.target == subscriptionModal) subscriptionModal.style.display = "none";
                if (event.target == statusMessageModal) statusMessageModal.style.display = "none";
                if (event.target == confirmationModal) confirmationModal.style.display = "none";
            };

            // Switch links logic
            if (switchFormLink) {
                switchFormLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const formContainer = signupFormContainer.classList.contains("hidden") ? signupFormContainer : loginFormContainer;
                    showForm(formContainer);
                });
            }
            if (switchToOtpLink) {
                switchToOtpLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showForm(otpFormContainer);
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

            // Auth Submission Logic
            document.getElementById("signupForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                setLoading('submitSignupBtn', true, 'Sign Up');
                const name = document.getElementById("signupName").value;
                const email = document.getElementById("signupEmail").value;
                const password = document.getElementById("signupPassword").value;
                const phone = document.getElementById("signupPhone").value;
                const role = userTypeSelect.value;
                const companyName = companyNameInput.value;
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
                    showStatusMessage("Welcome to the Hive!", "Your account has been successfully created.", false);
                } catch (error) {
                    console.error("Signup failed:", error.message);
                    if (error.message.includes('exists')) {
                        showStatusMessage("Account Exists", "A user with this email already exists. Please log in.", true);
                        showForm(loginFormContainer);
                    } else {
                        showStatusMessage("Registration Failed", error.message, true);
                    }
                } finally {
                    setLoading('submitSignupBtn', false, 'Sign Up');
                }
            });

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
                    console.log("Login successful!");
                } catch (error) {
                    console.error("Login failed:", error.message);
                    showStatusMessage("Login Failed", "Invalid email or password. Please try again.", true);
                } finally {
                    setLoading('submitLoginBtn', false, 'Login');
                }
            });

            document.getElementById("otpForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                setLoading('submitOtpBtn', true, 'Send OTP');
                const phone = document.getElementById("otpPhone").value;

                const fakeOtp = await showConfirmation("Enter OTP", `We've 'sent' an OTP to ${phone}. (Hint: It's 123456).`, true);

                if (fakeOtp === "123456") {
                    console.log("OTP Verified. Simulating login.");
                    setToken('fake-otp-token');
                    const mockUser = { id: 'mock-user-1', name: 'OTP User', role: 'seeker', email: 'otp@mock.com', cvfilename: 'mock.pdf', subscriptionstatus: 'none' };
                    setLocalUser(mockUser);
                    authModal.style.display = "none";
                    updateHeaderUI();
                } else if (fakeOtp !== null) {
                    showStatusMessage("OTP Failed", "Invalid OTP entered.", true);
                }

                setLoading('submitOtpBtn', false, 'Send OTP');
            });

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
                        showStatusMessage("Message Sent!", "Thank you for contacting HireHive. We will get back to you shortly.", false);
                        contactForm.reset();
                    } catch (error) {
                        console.error("Contact form submission failed:", error);
                        showStatusMessage("Submission Failed", "There was an error sending your message. Please try again.", true);
                    } finally {
                        setLoading('contactSubmitBtn', false, 'Send Message');
                    }
                });
            }

            // ------------------------------------------------------------------
            // 5. SUBSCRIPTION LOGIC (PAYMENT COMMENTED OUT)
            // ------------------------------------------------------------------
            const showSubscriptionModal = () => {
                const user = getLocalUser();
                if (!user) return;
                const modalContent = document.querySelector("#subscriptionModal .modal-content");
                const currentPlanKey = user.subscriptionstatus || 'buzz';
                const isEmployer = user.role === 'employer';

                let planCardsHTML = `<span class="close-btn" id="close-subscription-modal">&times;</span><h2 style="margin-bottom: 1rem;">Choose Your Hive Plan</h2><p>Your Current Plan: <strong style="color: ${HIVE_PLANS[currentPlanKey].color}">${HIVE_PLANS[currentPlanKey].name}</strong></p><div class="plans-container" style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">`;

                for (const [key, plan] of Object.entries(HIVE_PLANS)) {
                    const isCurrent = currentPlanKey === key;
                    const priceText = key === 'buzz' ? 'Free' : `₹X,XXX / month (Demo)`; // Demo price text
                    const buttonClass = isCurrent ? 'btn-secondary disabled' : 'btn-primary';
                    const buttonText = isCurrent ? 'Current Plan' : isEmployer ? (key === 'buzz' ? 'Select Free Plan' : 'Demo Purchase') : 'View Details';
                    const priceColor = key === 'buzz' ? plan.color : '#333';

                    planCardsHTML += `
                <div class="subscription-card" style="border: 2px solid ${isCurrent ? plan.color : '#ccc'};">
                    <h3 style="color:${plan.color}; font-size:1.3rem;"><i class="${plan.icon}"></i> ${plan.name}</h3>
                    <p style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem; color: ${priceColor};">${priceText}</p>
                    <p style="font-size: 0.8rem; margin-bottom: 1rem; color: #666;">${plan.description}</p>
                    <button class="btn ${buttonClass} select-plan-btn" data-plan-key="${key}" ${isCurrent || !isEmployer ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            `;
                }
                planCardsHTML += `</div>`;
                modalContent.innerHTML = planCardsHTML;

                document.getElementById("close-subscription-modal").onclick = () => { subscriptionModal.style.display = "none"; };

                modalContent.querySelectorAll('.select-plan-btn').forEach(btn => {
                    if (isEmployer && !btn.disabled) {
                        btn.addEventListener('click', async(e) => {
                            const planKey = e.currentTarget.dataset.planKey;
                            const selectedPlan = HIVE_PLANS[planKey];
                            const btnElement = e.currentTarget;
                            const originalText = btnElement.textContent;

                            btnElement.disabled = true;
                            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                            if (planKey === 'buzz') {
                                // Activate Free Plan
                                try {
                                    const data = await fetchApi('employer/subscription', 'PUT', { newPlanKey: planKey });
                                    setLocalUser(data.user);
                                    switchEmployerView("employer-management-view");
                                    showStatusMessage("Plan Updated", `${selectedPlan.name} is now your active plan.`, false);
                                    subscriptionModal.style.display = "none";
                                    initDashboard(null);
                                } catch (error) {
                                    showStatusMessage("Plan Update Failed", error.message, true);
                                    btnElement.disabled = false;
                                    btnElement.innerHTML = originalText;
                                }
                                return;
                            }

                            // --- PAID PLAN ACTIVATION (SIMULATION - RAZORPAY COMMENTED OUT) ---
                            try {
                                // SIMULATION: Assume successful payment and update the plan
                                // All paid plans use the same PUT route for updating the plan state
                                const data = await fetchApi('employer/subscription', 'PUT', { newPlanKey: planKey });

                                setLocalUser(data.user);
                                subscriptionModal.style.display = "none";
                                showStatusMessage("Demo Purchase Successful!", `The ${selectedPlan.name} is now active. Your job post count has been reset.`, false);
                                initDashboard(null);

                            } catch (error) {
                                showStatusMessage("Demo Purchase Failed", error.message, true);
                                btnElement.disabled = false;
                                btnElement.innerHTML = originalText;
                            }
                            // --- END SIMULATION ---
                        });
                    }
                });
                subscriptionModal.style.display = "block";
            };
            window.showSubscriptionModal = showSubscriptionModal;

            // ------------------------------------------------------------------
            // 6. DASHBOARD LOGIC (EVENT LISTENERS MOVED FOR EFFICIENCY)
            // ------------------------------------------------------------------

            function initDashboard(filters = null) {
                const currentUser = getLocalUser();
                if (!currentUser) {
                    showView('home', true, null);
                    return;
                }
                const seekerDashboard = document.getElementById("seeker-dashboard");
                const employerDashboard = document.getElementById("employer-dashboard");

                if (currentUser.role === "seeker") {
                    seekerDashboard.classList.remove("hidden");
                    employerDashboard.classList.add("hidden");
                    loadSeekerProfileForm();
                    if (filters) {
                        document.getElementById("filter-location").value = filters.location || '';
                        document.getElementById("filter-experience").value = filters.experience || '0';
                        document.getElementById("filter-category").value = filters.category || '';
                    } else {
                        document.getElementById("jobFilterForm").reset();
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

            // Initialize Employer Tab listeners once
            document.querySelectorAll('#employer-dashboard .job-filter-nav button').forEach(btn => {
                btn.onclick = (e) => {
                    const targetViewId = e.target.dataset.viewTarget;
                    if (e.target.id === 'choosePlanTab') {
                        e.preventDefault();
                        document.querySelectorAll('#employer-dashboard .job-filter-nav button').forEach(b => b.classList.remove('btn-primary'));
                        e.target.classList.add('btn-primary');
                        showSubscriptionModal();
                    } else if (targetViewId) {
                        switchEmployerView(targetViewId);
                    }
                };
            });

            // Other Seeker Dashboard button handlers
            document.getElementById("editProfileBtn").onclick = () => {
                document.getElementById("seeker-profile-view").classList.remove('hidden');
                document.getElementById("seeker-job-view").classList.add('hidden');
                loadSeekerProfileForm();
            };
            document.getElementById("backToJobsBtn").onclick = () => {
                document.getElementById("seeker-job-view").classList.remove('hidden');
                document.getElementById("seeker-profile-view").classList.add('hidden');
                loadJobs({});
            };

            // Initialize Seeker Job Filter Buttons
            const jobFilterBtns = document.querySelectorAll(".job-filter-btn");
            const jobViewSections = document.querySelectorAll(".job-view-section");
            jobFilterBtns.forEach(btn => {
                btn.onclick = (e) => {
                    const filter = e.target.dataset.filter;
                    jobFilterBtns.forEach(b => b.classList.remove('btn-primary'));
                    e.target.classList.add('btn-primary');
                    jobViewSections.forEach(section => section.classList.add('hidden'));

                    if (filter === 'all') {
                        document.getElementById('shortlisted-jobs').classList.remove('hidden');
                        document.getElementById('all-jobs').classList.remove('hidden');
                    } else if (filter === 'shortlisted') {
                        document.getElementById('shortlisted-jobs').classList.remove('hidden');
                    } else if (filter === 'applied') {
                        document.getElementById('applied-jobs').classList.remove('hidden');
                    }
                };
            });


            // ------------------------------------------------------------------
            // 7. SEEKER DASHBOARD & PROFILE LOGIC
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

                // CV download simulation
                cvFilenameEl.querySelectorAll('.cv-link').forEach(link => {
                    link.onclick = (e) => {
                        e.preventDefault();
                        showStatusMessage("Download Simulated", `Simulating download/view of CV: ${e.target.dataset.filename}. In a real app, this would trigger a secure file download.`, false);
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
                        console.log("Profile updated!");
                        showStatusMessage("Profile Updated", "Your profile has been saved successfully.", false);
                        seekerJobView.classList.remove('hidden');
                        seekerProfileView.classList.add('hidden');
                        loadSeekerProfileForm();
                    } catch (error) {
                        console.error("Profile update failed:", error.message);
                        showStatusMessage("Profile Update Failed", error.message, true);
                    } finally {
                        setLoading(saveBtn.id || 'profileSaveBtn', false, 'Save Profile');
                    }
                };
            }

            async function loadJobs(filters = {}) {
                const allJobsList = document.getElementById("all-jobs-list");
                const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");
                const appliedJobsList = document.getElementById("applied-jobs-list");
                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading jobs...</p>';

                try {
                    const filterParams = new URLSearchParams(filters).toString();
                    const jobs = await fetchApi(`seeker/jobs?${filterParams}`, 'GET');
                    const applicationData = await fetchApi('seeker/applications', 'GET');

                    const appliedJobIds = applicationData.applied.map(job => job.id);
                    const shortlistedJobDetails = applicationData.shortlisted;

                    allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";

                    jobs.forEach((job) => {
                                const hasApplied = appliedJobIds.includes(job.id);
                                const isShortlisted = shortlistedJobDetails.some(j => j.id === job.id);

                                const isDisabled = hasApplied;
                                const applyButtonText = hasApplied ? "Applied" : "Apply Now";

                                const jobCardHTML = `
                    <div class="job-card" data-job-id="${job.id}">
                        <h4>${job.title} (${job.employer?.name || 'Unknown Company'})</h4> 
                        <p><i class="fas fa-map-marker-alt"></i> ${job.location} | <i class="fas fa-briefcase"></i> ${job.experience} | <i class="fas fa-money-bill-wave"></i> ${job.salary}</p>
                        <p>${job.description.substring(0, 100)}...</p>
                        <div class="skills">${(job.required_skills || []).map((s) => `<span>${s}</span>`).join("")}</div>
                        <button class="btn apply-btn btn-primary" data-job-id="${job.id}" ${isDisabled ? "disabled" : ""}>
                            ${applyButtonText}
                        </button>
                    </div>`;

                allJobsList.innerHTML += jobCardHTML;
                if (isShortlisted) shortlistedJobsList.innerHTML += jobCardHTML;
                if (hasApplied) appliedJobsList.innerHTML += jobCardHTML;
            });

            if (shortlistedJobsList.innerHTML === "") shortlistedJobsList.innerHTML = "<p>No skill-matched jobs found yet.</p>";
            if (appliedJobsList.innerHTML === "") appliedJobsList.innerHTML = "<p>You have not applied to any jobs yet.</p>";
            if (allJobsList.innerHTML === "" && Object.keys(filters).length > 0) {
                 allJobsList.innerHTML = "<p>No jobs match your current filters. Try a broader search!</p>";
            } else if (allJobsList.innerHTML === "") {
                 allJobsList.innerHTML = "<p>No jobs are currently available. Check back soon!</p>";
            }

            document.querySelectorAll(".apply-btn:not([disabled])").forEach((button) => {
                button.onclick = async (e) => {
                    const jobId = parseInt(e.target.dataset.jobId);
                    const job = jobs.find(j => j.id === jobId);
                    let answers = [];

                    if (job.screening_questions && job.screening_questions.length > 0) {
                        for (const q of job.screening_questions) {
                            const answer = await showConfirmation("Screening Question", q, true);
                            
                            if (answer === null) {
                                console.log("Application cancelled by user.");
                                return;
                            }
                            if (answer.trim() === '') {
                                showStatusMessage("Required Answer", "The screening question requires an answer. Application cancelled.", true);
                                return;
                            }
                            answers.push(answer);
                        }
                    }
                    
                    try {
                        e.target.disabled = true;
                        e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';

                        await fetchApi(`seeker/apply/${jobId}`, 'POST', { answers });
                        console.log("Application submitted!");
                        showStatusMessage("Application Sent", "Your application has been successfully submitted.", false);
                        loadJobs(filters);
                    } catch (error) {
                        console.error("Application failed:", error.message);
                        showStatusMessage("Application Failed", error.message, true);
                    } finally {
                        e.target.disabled = false;
                        e.target.innerHTML = 'Apply Now';
                    }
                };
            });
        } catch (error) {
            allJobsList.innerHTML = `<p style='color:red;'>Failed to load jobs: ${error.message}</p>`;
        }
    }

    // Seeker Filter Form Submission
    const jobFilterForm = document.getElementById("jobFilterForm");
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    jobFilterForm.onsubmit = (e) => {
        e.preventDefault();
        const keywords = document.getElementById("home-search-keywords")?.value;
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

    resetFiltersBtn.onclick = () => {
        jobFilterForm.reset();
        loadJobs({});
    };

    // ------------------------------------------------------------------
    // 8. EMPLOYER DASHBOARD LOGIC 
    // ------------------------------------------------------------------
    function switchEmployerView(targetViewId) {
        document.querySelectorAll("#employer-dashboard .full-screen-view").forEach(view => {
            view.classList.add("hidden");
        });
        document.querySelectorAll('#employer-dashboard .job-filter-nav button').forEach(btn => {
            if (btn.dataset.viewTarget === targetViewId) {
                btn.classList.add('btn-primary');
            } else if (btn.id !== 'choosePlanTab') {
                btn.classList.remove('btn-primary');
            }
        });
        document.getElementById('choosePlanTab').classList.remove('btn-primary');
        
        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.remove("hidden");
            if (targetViewId === "employer-post-view") loadEmployerPostForm();
            if (targetViewId === "employer-management-view") loadPostedJobs();
        }
    }
    document.getElementById("postNewJobBtn").onclick = () => switchEmployerView("employer-post-view");

    function loadEmployerPostForm() {
        const user = getLocalUser();
        const currentPlanKey = user.subscriptionstatus || 'buzz';
        const currentPlan = HIVE_PLANS[currentPlanKey] || HIVE_PLANS['buzz'];
        
        const isUnlimited = currentPlan.limit === Infinity;
        const currentJobs = user.jobpostcount || 0;
        const jobLimit = currentPlan.limit;
        const statusEl = document.getElementById("employer-subscription-status-small");
        
        statusEl.innerHTML = isUnlimited ?
            `<a href="#" onclick="event.preventDefault(); showSubscriptionModal();" style="color: ${currentPlan.color}">Unlimited Posts (${currentPlan.name})</a>` :
            `<a href="#" onclick="event.preventDefault(); showSubscriptionModal();" style="color: ${currentPlan.color}">${currentPlan.name}: ${currentJobs}/${jobLimit} Posts</a>`;

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

        const jobForms = { 1: document.getElementById("jobStep1Form"), 2: document.getElementById("jobStep2Form"), 3: document.getElementById("jobStep3Form"), };

        document.querySelectorAll(".next-step-btn").forEach((button) => {
            button.onclick = () => {
                if (!canPost) {
                    showStatusMessage("Post Limit Reached", "Upgrade your Hive Plan to post more jobs!", true);
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
                showStatusMessage("Missing Questions", "Screening Question 1 and 2 are mandatory. Please fill them out or select 'No'.", true);
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

            console.log(`Job ${jobId ? 'updated' : 'posted'} successfully!`);
            showStatusMessage("Success!", `Job has been successfully ${jobId ? 'updated' : 'posted'}.`, false);
            
            document.getElementById("jobStep3Form").reset();
            document.getElementById("jobStep1Form").reset();
            document.getElementById("jobStep2Form").reset();
            
            switchEmployerView("employer-management-view");
        } catch (error) {
            console.error("Job operation failed:", error.message);
            showStatusMessage("Job Operation Failed", error.message, true);
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

            document.querySelectorAll(".view-applicants-btn").forEach((button) => {
                button.onclick = (e) => { e.preventDefault(); showApplicantsModal(parseInt(e.currentTarget.dataset.jobId)); };
            });
            document.querySelectorAll(".edit-job-btn").forEach((button) => {
                button.onclick = (e) => {
                    e.preventDefault();
                    const jobId = parseInt(e.currentTarget.dataset.jobId);
                    const jobToEdit = myJobs.find(j => j.id === jobId);
                    if (jobToEdit) editJob(jobId, jobToEdit);
                };
            });
            document.querySelectorAll(".delete-job-btn").forEach((button) => {
                button.onclick = (e) => { e.preventDefault(); deleteJob(parseInt(e.currentTarget.dataset.jobId)); };
            });

        } catch (error) {
            postedJobsList.innerHTML = `<p style='color:red;'>Failed to load posted jobs: ${error.message}</p>`;
        }
    }

    async function editJob(jobId, jobToEdit) {
        const result = await showConfirmation(`Edit Job: ${jobToEdit.title}`, "Are you sure you want to edit this job? This will pre-fill the posting form.", false, 'Edit Now');
        if (!result) { return; } 

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
        
        switchEmployerView("employer-post-view");
    }

    async function deleteJob(jobId) {
        const result = await showConfirmation("Confirm Deletion", "Are you sure you want to delete this job? This action cannot be undone.", false, 'Yes, Delete It');
        if (!result) { return; }

        try {
            const response = await fetchApi(`employer/jobs/${jobId}`, 'DELETE');
            
            if (response && response.user) {
                setLocalUser(response.user); // Update local job count
            }
            
            console.log("Job successfully deleted.");
            showStatusMessage("Job Deleted", "The job has been permanently removed.", false);
            loadPostedJobs();
        } catch (error) {
            console.error("Deletion failed:", error.message);
            showStatusMessage("Deletion Failed", error.message, true);
        }
    }

    async function showApplicantsModal(jobId) {
        const listElement = document.getElementById("applicants-list");
        listElement.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading applicants...</p>';
        
        try {
            const data = await fetchApi(`employer/applicants/${jobId}`, 'GET');
            const job = { title: data.jobTitle, screeningQuestions: data.screeningQuestions };
            const applicants = data.applicants;
            
            document.getElementById("applicants-job-title").textContent = job.title;

            if (applicants.length === 0) {
                listElement.innerHTML = "<p>No applicants yet.</p>";
            } else {
                const screeningHeaders = (job.screeningQuestions || []).map((q, index) => `<th>Q${index + 1} Answer</th>`).join('');
                const screeningCells = (app) => (job.screeningQuestions || []).map((q, index) => `<td>${app.applicationAnswers?.[index] || 'N/A'}</td>`).join('');
                
                const tableRows = applicants.map(app => `
                    <tr data-seeker-id="${app.seekerid}">
                        <td>${app.name}</td>
                        <td>${app.email}</td>
                        <td>${app.phone || 'N/A'}</td>
                        <td>${(app.skills || []).join(", ") || 'N/A'}</td>
                        <td>
                            ${app.cvfilename ? `<a href="#" class="cv-link" data-filename="${app.cvfilename}">View/Download</a>` : 'N/A'}
                        </td>
                        ${screeningCells(app)}
                        <td class="applicant-status">${app.status}</td>
                        <td class="applicant-actions">
                            ${app.status === 'applied' ? `
                                <button class="btn btn-primary btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${app.seekerid}" data-new-status="Shortlisted">Shortlist</button>
                                <button class="btn btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${app.seekerid}" data-new-status="Rejected">Reject</button>
                            ` : (app.status === 'Shortlisted' ? `
                                <button class="btn btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${app.seekerid}" data-new-status="Rejected">Reject</button>
                            ` : '<i>Action taken</i>')}
                        </td>
                    </tr>
                `).join('');

                listElement.innerHTML = `
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Skills</th>
                                    <th>CV</th>
                                    ${screeningHeaders}
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                `;

                listElement.querySelectorAll('.cv-link').forEach(link => {
                    link.onclick = (e) => { 
                        e.preventDefault(); 
                        showStatusMessage("Download Simulated", `Simulating secure CV download/view for: ${e.target.dataset.filename}.`, false);
                    };
                });

                addApplicantActionListeners();
            }
            applicantsModal.style.display = "block";
        } catch (error) {
            listElement.innerHTML = `<p style='color:red;'>Failed to load applicants: ${error.message}</p>`;
        }
    }

    function addApplicantActionListeners() {
        document.querySelectorAll('.applicant-actions .action-btn').forEach(button => {
            button.onclick = async (e) => {
                const btn = e.currentTarget;
                const { jobId, seekerId, newStatus } = btn.dataset;
                
                const actionsCell = btn.closest('td');
                actionsCell.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; 

                try {
                    await fetchApi('employer/applicants/status', 'PUT', {
                        jobId: parseInt(jobId),
                        seekerId: seekerId,
                        newStatus: newStatus
                    });
                    
                    const statusCell = btn.closest('tr').querySelector('.applicant-status');
                    statusCell.textContent = newStatus;
                    
                    if(newStatus === 'Shortlisted') {
                        actionsCell.innerHTML = `<button class="btn btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${seekerId}" data-new-status="Rejected">Reject</button>`;
                        addApplicantActionListeners();
                    } else {
                        actionsCell.innerHTML = '<i>Action taken</i>';
                    }
                } catch (error) {
                    console.error("Failed to update status:", error);
                    showStatusMessage("Update Failed", error.message, true);
                    
                    const originalButtons = `
                        <button class="btn btn-primary btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${seekerId}" data-new-status="Shortlisted">Shortlist</button>
                        <button class="btn btn-small action-btn" data-job-id="${jobId}" data-seeker-id="${seekerId}" data-new-status="Rejected">Reject</button>
                    `;
                    actionsCell.innerHTML = originalButtons;
                    addApplicantActionListeners();
                }
            };
        });
    }
    
    // ------------------------------------------------------------------
    // 9. ADMIN LOGIC (SIMULATED)
    // ------------------------------------------------------------------
    async function initAdmin() {
        console.warn("Admin data is simulated. No API call made.");
        document.getElementById("total-seekers").textContent = '1,200';
        document.getElementById("total-employers").textContent = '450';
        document.getElementById("total-jobs").textContent = '98';
        document.getElementById("total-subscriptions").textContent = '15 (Simulated)';
        document.getElementById("job-seekers-list").innerHTML = "<p>Admin data is simulated. Showing mock user list.</p>";
        document.getElementById("employer-profiles-list").innerHTML = "<p>Admin data is simulated. Showing mock employer list.</p>";
    }

    // ------------------------------------------------------------------
    // 10. HERO SEARCH BAR LOGIC
    // ------------------------------------------------------------------
    const homeSearchBarForm = document.getElementById("homeSearchBarForm");
    if (homeSearchBarForm) {
        homeSearchBarForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentUser = getLocalUser();
            if (!currentUser) {
                showStatusMessage("Login Required", "Please log in as a Job Seeker to search jobs.", false);
                showForm(loginFormContainer);
                return;
            }
            if (currentUser.role !== 'seeker') {
                showView('dashboard', true, null);
                return;
            }

            const keywords = document.getElementById("home-search-keywords").value;
            const experience = document.getElementById("home-search-experience").value;
            const location = document.getElementById("home-search-location").value;

            const filters = {};
            if (keywords) filters.keywords = keywords;
            if (location) filters.location = location;
            if (experience && experience !== '0') filters.experience = experience;
            
            showView('dashboard', true, filters);
        });
    }

});