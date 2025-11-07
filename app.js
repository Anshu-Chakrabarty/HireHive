// --- Frontend: app.js (FINAL CORRECTED) ---
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

            const showStatusMessage = (title, body, isError = false) => {
                const modal = document.getElementById("statusMessageModal");
                document.getElementById("statusMessageTitle").textContent = title;
                document.getElementById("statusMessageBody").textContent = body;
                if (isError) {
                    document.getElementById("statusMessageTitle").style.color = 'red';
                } else {
                    document.getElementById("statusMessageTitle").style.color = '#343a40';
                }
                modal.style.display = 'block';
            };

            const HIVE_PLANS = {
                'buzz': { name: "Buzz Plan", price: "Free", limit: 2, icon: "fas fa-bug", color: "#28a745", description: "Post 2 free job listing. Access to limited candidate applications (up to 30 resumes). Standard listing visibility for 7 days." },
                'worker': { name: "Worker Plan", price: "₹1,999 / month", limit: 5, icon: "fas fa-user-tie", color: "#007bff", description: "Post up to 5 active jobs. Access to 50 candidate resumes. Basic resume search filters." },
                'colony': { name: "Colony Plan", price: "₹4,999 / month", limit: 15, icon: "fas fa-industry", color: "#fd7e14", description: "Post up to 15 active jobs. Access to unlimited resume downloads. Advanced candidate filtering." },
                'queen': { name: "Queen Plan", price: "₹8,999 / month", limit: 30, icon: "fas fa-crown", color: "#6f42c1", description: "Post up to 30 active jobs. Access to premium candidate database. AI-powered candidate recommendations." },
                'hive_master': { name: "Hive Master Plan", price: "₹14,999 / month", limit: Infinity, icon: "fas fa-trophy", color: "#dc3545", description: "Unlimited job postings. Full candidate database access with export/download. AI-based shortlisting." },
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
                    } else if (contentType && contentType.includes("text/html")) {
                        const errorText = await response.text();
                        console.error("Backend Error (HTML Response):", errorText);
                        throw new Error("Server error. Received HTML instead of JSON. Check backend logs.");
                    }
                    if (!response.ok) {
                        throw new Error(`Request failed with status ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    console.error("Fetch API Error:", error);
                    if (error.message.includes("Unexpected token")) {
                        throw new Error("Payment Error: The server returned an invalid response (not JSON). Please check the backend logs.");
                    }
                    throw error;
                }
            }

            const getCurrentMonthJobCount = () => {
                const currentUser = getLocalUser();
                if (!currentUser || currentUser.role !== 'employer') return 0;
                return currentUser.jobpostcount || 0;
            };

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
                const viewToShow = views[viewName];

                if (viewToShow) {
                    viewToShow.classList.remove("hidden");
                    if (viewName === 'dashboard') initDashboard(filters);
                    if (viewName === 'admin') initAdmin();
                } else {
                    views['home'].classList.remove("hidden");
                    viewName = 'home';
                }

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
                    if (currentUser) {
                        const category = e.currentTarget.textContent.trim();
                        const filters = { category: category };
                        showView('dashboard', true, filters);
                    } else {
                        showForm(document.getElementById("login-form-container"));
                    }
                });
            });

            // ------------------------------------------------------------------
            // 3. AUTH & MODAL LOGIC
            // ------------------------------------------------------------------
            const modal = document.getElementById("authModal");
            const loginFormContainer = document.getElementById("login-form-container");
            const signupFormContainer = document.getElementById("signup-form-container");
            const otpFormContainer = document.getElementById("otp-form-container");
            const closeBtn = document.querySelector("#authModal .close-btn");
            const applicantsModal = document.getElementById("applicantsModal");
            const subscriptionModal = document.getElementById("subscriptionModal");
            const closeApplicantsModalBtn = document.getElementById("close-applicants-modal");
            const statusMessageModal = document.getElementById("statusMessageModal");
            const userTypeSelect = document.getElementById("userType");
            const companyNameInput = document.getElementById("signupCompanyName");
            document.querySelectorAll('.status-close-btn').forEach(btn => {
                btn.onclick = () => { statusMessageModal.style.display = 'none'; };
            });
            const switchToOtpLink = document.getElementById("switch-to-otp");
            const switchFormLink = document.getElementById("switch-form-link");
            const showForm = (formToShow) => {
                [loginFormContainer, signupFormContainer, otpFormContainer].forEach((f) => f.classList.add("hidden"));
                formToShow.classList.remove("hidden");
                modal.style.display = "block";
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
            if (closeBtn) { closeBtn.onclick = () => { modal.style.display = "none"; }; }
            if (closeApplicantsModalBtn) { closeApplicantsModalBtn.onclick = () => { applicantsModal.style.display = "none"; }; }
            document.addEventListener('click', (event) => {
                if (event.target.id === 'close-subscription-modal') {
                    subscriptionModal.style.display = "none";
                }
            });
            window.onclick = (event) => {
                if (event.target == modal) modal.style.display = "none";
                if (event.target == applicantsModal) applicantsModal.style.display = "none";
                if (event.target == subscriptionModal) subscriptionModal.style.display = "none";
                if (event.target == statusMessageModal) statusMessageModal.style.display = "none";
            };
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
                    document.getElementById("authModal").style.display = "none";
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
                    document.getElementById("authModal").style.display = "none";
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
                console.log(`Simulating OTP request for phone: ${phone}.`);
                const fakeOtp = prompt("We've 'sent' an OTP to your number. (Hint: It's 123456)");
                if (fakeOtp === "123456") {
                    console.log("OTP Verified. Simulating login.");
                    setToken('fake-otp-token');
                    const mockUser = { id: 'mock-user-1', name: 'OTP User', role: 'seeker', email: 'otp@mock.com', cvfilename: 'mock.pdf', subscriptionstatus: 'none' };
                    setLocalUser(mockUser);
                    document.getElementById("authModal").style.display = "none";
                    updateHeaderUI();
                } else {
                    console.error("Invalid OTP entered.");
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
            // 5. SUBSCRIPTION LOGIC (RAZORPAY BUG FIXED)
            // ------------------------------------------------------------------
            const showSubscriptionModal = () => {
                const user = getLocalUser();
                if (!user) return;
                const modalContent = document.querySelector("#subscriptionModal .modal-content");
                const currentPlanKey = user.subscriptionstatus || 'buzz';
                const isEmployer = user.role === 'employer';
                let planCardsHTML = `<span class="close-btn" id="close-subscription-modal">&times;</span><h2 style="margin-bottom: 1rem;">Choose Your Hive Plan</h2><div class="plans-container" style="display:flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">`;
                for (const [key, plan] of Object.entries(HIVE_PLANS)) {
                    const isCurrent = currentPlanKey === key;
                    const priceText = plan.price === 'Free' ? 'Free' : `${plan.price}`;
                    const buttonClass = isCurrent ? 'btn-secondary disabled' : 'btn-primary';
                    const buttonText = isCurrent ? 'Current Plan' : isEmployer ? (plan.price === 'Free' ? 'Select Free Plan' : 'Buy Now') : 'View Details';
                    const priceColor = plan.price === 'Free' ? plan.color : '#333';
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
                            btnElement.disabled = true;
                            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            if (planKey === 'buzz') {
                                try {
                                    const data = await fetchApi('employer/subscription', 'PUT', { newPlanKey: planKey });
                                    setLocalUser(data.user);
                                    switchEmployerView("employer-post-view");
                                    showStatusMessage("Plan Updated", `${selectedPlan.name} is now your active plan.`, false);
                                    subscriptionModal.style.display = "none";
                                    initDashboard(null);
                                } catch (error) {
                                    showStatusMessage("Plan Update Failed", error.message, true);
                                    btnElement.disabled = false;
                                    btnElement.innerHTML = 'Select Free Plan';
                                }
                                return;
                            }
                            try {
                                const { order } = await fetchApi('employer/payment/create-order', 'POST', { planKey });
                                if (!order) throw new Error("Could not create payment order.");

                                const options = {
                                    // === BUG FIX HERE ===
                                    // The key_id comes from the order object, not process.env
                                    key: order.key_id,
                                    // === END OF FIX ===

                                    amount: order.amount,
                                    currency: order.currency,
                                    name: "HireHive Subscription",
                                    description: `Payment for ${selectedPlan.name}`,
                                    order_id: order.id,
                                    handler: async function(response) {
                                        try {
                                            const verifyData = {
                                                razorpay_order_id: response.razorpay_order_id,
                                                razorpay_payment_id: response.razorpay_payment_id,
                                                razorpay_signature: response.razorpay_signature,
                                                planKey: planKey
                                            };
                                            const data = await fetchApi('employer/payment/verify-payment', 'POST', verifyData);
                                            setLocalUser(data.user);
                                            subscriptionModal.style.display = "none";
                                            showStatusMessage("Payment Successful!", data.message, false);
                                            initDashboard(null);
                                        } catch (error) {
                                            console.error("Payment verification failed:", error);
                                            showStatusMessage("Payment Failed", error.message, true);
                                        }
                                    },
                                    prefill: {
                                        name: user.name,
                                        email: user.email,
                                        contact: user.phone || ''
                                    },
                                    theme: {
                                        color: "#ffc107"
                                    },
                                    modal: {
                                        ondismiss: function() {
                                            console.log('Payment modal dismissed');
                                            btnElement.disabled = false;
                                            btnElement.innerHTML = 'Buy Now';
                                        }
                                    }
                                };
                                const rzp = new Razorpay(options);
                                rzp.on('payment.failed', function(response) {
                                    console.error("Razorpay Payment Failed:", response.error);
                                    showStatusMessage("Payment Failed", response.error.description || "An unknown error occurred.", true);
                                    btnElement.disabled = false;
                                    btnElement.innerHTML = 'Buy Now';
                                });
                                rzp.open();
                            } catch (error) {
                                console.error("Payment process failed:", error);
                                showStatusMessage("Payment Error", error.message, true);
                                btnElement.disabled = false;
                                btnElement.innerHTML = 'Buy Now';
                            }
                        });
                    }
                });
                subscriptionModal.style.display = "block";
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
                    loadJobs(filters || {});
                } else if (currentUser.role === "employer") {
                    employerDashboard.classList.remove("hidden");
                    seekerDashboard.classList.add("hidden");
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
                    document.getElementById("postNewJobBtn").onclick = () => switchEmployerView("employer-post-view");
                    switchEmployerView("employer-management-view");
                }
            }

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
                cvFilenameEl.querySelectorAll('.cv-link').forEach(link => {
                    link.onclick = (e) => {
                        e.preventDefault();
                        console.log(`Simulating download/view of CV: ${e.target.dataset.filename}.`);
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
                    }
                };
            }
            async function loadJobs(filters = {}) {
                const allJobsList = document.getElementById("all-jobs-list");
                const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");
                const appliedJobsList = document.getElementById("applied-jobs-list");
                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "Loading jobs...";
                try {
                    const filterParams = new URLSearchParams(filters).toString();
                    const jobs = await fetchApi(`seeker/jobs?${filterParams}`, 'GET');
                    const applicationData = await fetchApi('seeker/applications', 'GET');
                    const appliedJobIds = applicationData.applied.map(job => job.id);
                    const shortlistedJobIds = applicationData.shortlisted.map(job => job.id);
                    allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";
                    jobs.forEach((job) => {
                                const hasApplied = appliedJobIds.includes(job.id);
                                const isShortlisted = shortlistedJobIds.includes(job.id);
                                const isDisabled = hasApplied;
                                const applyButtonText = hasApplied ? "Applied" : "Apply Now";
                                const jobCardHTML = `
                    <div class="job-card" data-job-id="${job.id}">
                        <h4>${job.title} (${job.employer.name})</h4>
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
            if (shortlistedJobsList.innerHTML === "") shortlistedJobsList.innerHTML = "<p>No jobs match your profile yet.</p>";
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
                            const answer = prompt(`Screening Question: ${q}`);
                            if (answer === null) {
                                console.log("Application cancelled.");
                                return;
                            }
                            answers.push(answer);
                        }
                    }
                    try {
                        await fetchApi(`seeker/apply/${jobId}`, 'POST', { answers });
                        console.log("Application submitted!");
                        showStatusMessage("Application Sent", "Your application has been successfully submitted.", false);
                        loadJobs(filters);
                    } catch (error) {
                        console.error("Application failed:", error.message);
                        showStatusMessage("Application Failed", error.message, true);
                    }
                };
            });
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
            const jobFilterForm = document.getElementById("jobFilterForm");
            const resetFiltersBtn = document.getElementById("resetFiltersBtn");
            jobFilterForm.onsubmit = (e) => {
                e.preventDefault();
                const location = document.getElementById("filter-location").value.trim();
                const salary = document.getElementById("filter-salary").value.trim();
                const experience = document.getElementById("filter-experience").value;
                const category = document.getElementById("filter-category").value;
                const newFilters = {};
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
        } catch (error) {
            allJobsList.innerHTML = "<p style='color:red;'>Failed to load jobs. Please check your backend server status.</p>";
        }
    }
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

    // ------------------------------------------------------------------
    // 8. EMPLOYER DASHBOARD LOGIC (CV BUGS REMOVED)
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
        if(targetViewId) {
             document.getElementById('choosePlanTab').classList.remove('btn-primary');
        }
        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.remove("hidden");
            if (targetViewId === "employer-post-view") loadEmployerPostForm();
            if (targetViewId === "employer-management-view") loadPostedJobs();
            // loadSeekerCVs() call removed
        }
    }
    function loadEmployerPostForm() {
        const user = getLocalUser();
        const currentPlanKey = user.subscriptionstatus || 'buzz';
        const currentPlan = HIVE_PLANS[currentPlanKey];
        if (!currentPlan) {
            console.error("User has invalid plan:", currentPlanKey);
            return;
        }
        const isUnlimited = currentPlan.limit === Infinity;
        const currentJobs = user.jobpostcount || 0;
        const jobLimit = currentPlan.limit;
        const statusEl = document.getElementById("employer-subscription-status-small");
        statusEl.innerHTML = isUnlimited ?
            `<a href="#" onclick="event.preventDefault(); showSubscriptionModal();" style="color: ${currentPlan.color}">Unlimited Posts (${currentPlan.name})</a>` :
            `<a href="#" onclick="event.preventDefault(); showSubscriptionModal();" style="color: ${currentPlan.color}">${currentPlan.name}: ${currentJobs}/${jobLimit} Posts</a>`;
        const canPost = isUnlimited || currentJobs < jobLimit;
        const postJobSubmitBtn = document.getElementById("postJobSubmitBtn");
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
        jobForms[1].classList.remove("hidden");
        jobForms[2].classList.add("hidden");
        jobForms[3].classList.add("hidden");
        document.querySelectorAll(".next-step-btn").forEach((button) => {
            button.onclick = () => {
                if (!canPost) {
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
            if (screeningSelect.value === 'yes') { screeningContainer.classList.remove("hidden"); } else { screeningContainer.classList.add("hidden"); }
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
            if (q1 === "" || q2 === "") {
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
            } else if (!jobId) {
                const user = getLocalUser();
                user.jobpostcount = (user.jobpostcount || 0) + 1;
                setLocalUser(user);
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
        postedJobsList.innerHTML = "Loading posted jobs...";
        try {
            const myJobs = await fetchApi('employer/jobs', 'GET');
            postedJobsList.innerHTML = "";
            // Seeker count logic REMOVED
            if (myJobs.length === 0) {
                postedJobsList.innerHTML = "<p>You have not posted any jobs yet. Click 'Post New Job' to start.</p>";
                return;
            }
            myJobs.forEach((job) => {
                const applicantCount = job.applications[0].count;
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
            postedJobsList.innerHTML = "<p style='color:red;'>Failed to load posted jobs. Please ensure your backend is running.</p>";
        }
    }
    function editJob(jobId, jobToEdit) {
        if (!confirm(`Are you sure you want to edit the job: ${jobToEdit.title}? This will pre-fill the posting form.`)) { return; }
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
        if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) { return; }
        try {
            await fetchApi(`employer/jobs/${jobId}`, 'DELETE');
            const user = getLocalUser();
            if (user && user.jobpostcount > 0) {
                user.jobpostcount -= 1;
                setLocalUser(user);
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
        listElement.innerHTML = "Loading applicants...";
        try {
            const data = await fetchApi(`employer/applicants/${jobId}`, 'GET');
            const job = { title: data.jobTitle, screeningQuestions: data.screeningQuestions };
            const applicants = data.applicants;
            document.getElementById("applicants-job-title").textContent = job.title;
            if (applicants.length === 0) {
                listElement.innerHTML = "<p>No applicants yet.</p>";
            } else {
                const screeningHeaders = (job.screeningQuestions || []).map((q, index) => `<th>Q${index + 1} Answer</th>`).join('');
                const screeningCells = (app) => (job.screeningQuestions || []).map((q, index) => `<td>${app.applicationAnswers[index] || 'N/A'}</td>`).join('');
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
                            ` : '')}
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
                    link.onclick = (e) => { e.preventDefault(); console.log(`Simulating secure CV download/view for: ${e.target.dataset.filename}.`); };
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
                btn.closest('td').innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                try {
                    await fetchApi('employer/applicants/status', 'PUT', {
                        jobId: parseInt(jobId),
                        seekerId: seekerId,
                        newStatus: newStatus
                    });
                    const statusCell = btn.closest('tr').querySelector('.applicant-status');
                    statusCell.textContent = newStatus;
                    const actionsCell = btn.closest('td');
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
                    btn.closest('td').innerHTML = originalButtons;
                    addApplicantActionListeners();
                }
            };
        });
    }
    
    // --- "loadSeekerCVs" function completely REMOVED ---
    
    // ------------------------------------------------------------------
    // 9. ADMIN LOGIC (SIMULATED)
    // ------------------------------------------------------------------
    async function initAdmin() {
        console.warn("Admin data is simulated. No API call made.");
        document.getElementById("total-seekers").textContent = 'N/A';
        document.getElementById("total-employers").textContent = 'N/A';
        document.getElementById("total-jobs").textContent = 'N/A';
        document.getElementById("total-subscriptions").textContent = 'N/A';
        document.getElementById("job-seekers-list").innerHTML = "<p>Admin data is simulated.</p>";
        document.getElementById("employer-profiles-list").innerHTML = "<p>Admin data is simulated.</p>";
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
            console.log("Hero Search: Keywords (not used by current filter):", keywords);
            const filters = {};
            if (location) filters.location = location;
            if (experience && experience !== '0') filters.experience = experience;
            showView('dashboard', true, filters);
        });
    }

});