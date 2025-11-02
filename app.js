// --- Frontend: app.js (FINAL CORRECTED) ---
document.addEventListener("DOMContentLoaded", () => {
            // ------------------------------------------------------------------
            // 1. GLOBAL CONFIGURATION & API HELPERS
            // ------------------------------------------------------------------
            const BASE_URL = "https://hirehive-api.onrender.com/api";

            const getToken = () => localStorage.getItem("hirehiveToken");
            const setToken = (token) => localStorage.setItem("hirehiveToken", token);
            const removeToken = () => localStorage.removeItem("hirehiveToken");

            // Use sessionStorage for currentUser data persistence within the session
            const getLocalUser = () => JSON.parse(sessionStorage.getItem("localUser"));
            const setLocalUser = (user) => {
                if (user) {
                    sessionStorage.setItem("localUser", JSON.stringify(user));
                } else {
                    sessionStorage.removeItem("localUser");
                }
            };

            // Helper function for showing status messages
            const showStatusMessage = (title, body, isError = false) => {
                const modal = document.getElementById("statusMessageModal");
                document.getElementById("statusMessageTitle").textContent = title;
                document.getElementById("statusMessageBody").textContent = body;

                if (isError) {
                    document.getElementById("statusMessageTitle").style.color = 'red';
                } else {
                    document.getElementById("statusMessageTitle").style.color = '#343a40'; // Secondary color
                }
                modal.style.display = 'block';
            };

            // --- SUBSCRIPTION PLAN DATA ---
            const HIVE_PLANS = {
                'buzz': { name: "Buzz Plan", price: "Free", limit: 2, icon: "fas fa-bug", color: "#28a745", description: "Post 2 free job listing. Access to limited candidate applications (up to 30 resumes). Standard listing visibility for 7 days." },
                'worker': { name: "Worker Plan", price: "₹1,999 / month", limit: 5, icon: "fas fa-user-tie", color: "#007bff", description: "Post up to 5 active jobs. Access to 50 candidate resumes. Basic resume search filters." },
                'colony': { name: "Colony Plan", price: "₹4,999 / month", limit: 15, icon: "fas fa-industry", color: "#fd7e14", description: "Post up to 15 active jobs. Access to unlimited resume downloads. Advanced candidate filtering." },
                'queen': { name: "Queen Plan", price: "₹8,999 / month", limit: 30, icon: "fas fa-crown", color: "#6f42c1", description: "Post up to 30 active jobs. Access to premium candidate database. AI-powered candidate recommendations." },
                'hive_master': { name: "Hive Master Plan", price: "₹14,999 / month", limit: Infinity, icon: "fas fa-trophy", color: "#dc3545", description: "Unlimited job postings. Full candidate database access with export/download. AI-based shortlisting." },
            };

            // --- API Fetch Helper (Handles Authentication) ---
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
                        delete config.headers['Content-Type'];
                    } else {
                        headers['Content-Type'] = 'application/json';
                        config.body = JSON.stringify(data);
                    }
                }

                try {
                    const response = await fetch(url, config);
                    const responseData = await response.json();

                    if (!response.ok) {
                        const errorMessage = responseData.error || `Request failed with status ${response.status}`;
                        console.error("API Error:", errorMessage);
                        throw new Error(errorMessage);
                    }

                    return responseData;
                } catch (error) {
                    throw error;
                }
            }

            // Helper uses the database field name 'jobpostcount'
            const getCurrentMonthJobCount = () => {
                const currentUser = getLocalUser();
                if (!currentUser || currentUser.role !== 'employer') return 0;
                return currentUser.jobpostcount || 0;
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

            // ... [Other dashboard elements] ...

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

            function updateHeaderUI() {
                const user = getLocalUser();
                const token = getToken();

                [loginBtn, signupBtn, logoutBtn, dashboardLink, adminLink, welcomeMessage].forEach(el => el.classList.add("hidden"));
                welcomeMessage.textContent = "";

                if (token && user) {
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

                if (token && user) {
                    if (targetView === 'home' || targetView === '') {
                        targetView = (user.role === 'admin') ? 'admin' : 'dashboard';
                    }
                }
                showView(targetView, false);
            }

            const showView = (viewName, updateHash = true) => {
                Object.values(views).forEach(v => v.classList.add("hidden"));
                const viewToShow = views[viewName];
                if (viewToShow) {
                    viewToShow.classList.remove("hidden");
                    if (viewName === 'dashboard') initDashboard();
                    if (viewName === 'admin') initAdmin();
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
                if (views[viewName]) {
                    showView(viewName, false);
                } else {
                    showView('home', true);
                }
            });

            document.querySelectorAll('[data-view]').forEach(el => {
                el.addEventListener('click', (e) => {
                    const view = el.dataset.view;
                    if (view === 'home-link') {
                        e.preventDefault();
                        showView('home');
                        document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
                        return;
                    }

                    if (view && views[view]) {
                        e.preventDefault();
                        showView(view);
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
                    if (getToken()) {
                        showView('dashboard');
                    } else {
                        showForm(document.getElementById("login-form-container"));
                    }
                });
            });

            // ------------------------------------------------------------------
            // 3. AUTH & MODAL LOGIC (FIXED PASSWORD SUBMISSION & UI FEEDBACK)
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

            // Close listener for status message modal
            document.querySelectorAll('.status-close-btn').forEach(btn => {
                btn.onclick = () => { statusMessageModal.style.display = 'none'; };
            });

            const switchToOtpLink = document.getElementById("switch-to-otp");
            const switchFormLink = document.getElementById("switch-form-link");


            const showForm = (formToShow) => {
                [loginFormContainer, signupFormContainer, otpFormContainer].forEach((f) => f.classList.add("hidden"));
                formToShow.classList.remove("hidden");
                modal.style.display = "block";

                // FIX: Update switch link text dynamically for better UX
                const isLogin = formToShow === loginFormContainer;
                if (switchFormLink) {
                    switchFormLink.textContent = isLogin ?
                        "Need an account? Sign Up" :
                        "Already have an account? Log In";
                }
            };

            // --- Loading State Helper ---
            const setLoading = (buttonId, isLoading, defaultText = 'Submit') => {
                const btn = document.getElementById(buttonId);
                if (!btn) return;

                if (isLoading) {
                    btn.disabled = true;
                    // Use Font Awesome Honeybee icon for surfing symbol
                    btn.innerHTML = '<i class="fas fa-hive fa-spin"></i> Surfing...';
                } else {
                    btn.disabled = false;
                    btn.textContent = defaultText;
                }
            };


            if (loginBtn) {
                loginBtn.onclick = () => showForm(loginFormContainer);
            }
            if (signupBtn) {
                signupBtn.onclick = () => showForm(signupFormContainer);
            }
            if (closeBtn) {
                closeBtn.onclick = () => { modal.style.display = "none"; };
            }
            if (closeApplicantsModalBtn) {
                closeApplicantsModalBtn.onclick = () => { applicantsModal.style.display = "none"; };
            }
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

            // --- API SIGNUP (FIXED) ---
            document.getElementById("signupForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                setLoading('submitSignupBtn', true, 'Sign Up');

                const name = document.getElementById("signupName").value;
                const email = document.getElementById("signupEmail").value;
                const password = document.getElementById("signupPassword").value;
                const phone = document.getElementById("signupPhone").value;
                const role = document.getElementById("userType").value;

                try {
                    const data = await fetchApi('auth/signup', 'POST', { name, email, password, role, phone });

                    // --- ON SUCCESS ---
                    setToken(data.token);
                    setLocalUser(data.user);
                    document.getElementById("authModal").style.display = "none";
                    updateHeaderUI();
                    console.log("Signup successful!");
                    showStatusMessage("Welcome to the Hive!", "Your account has been successfully created.", false);

                } catch (error) {
                    console.error("Signup failed:", error.message);
                    // Check for 409 error (User already exists)
                    if (error.message.includes('exists')) {
                        showStatusMessage(
                            "Account Exists",
                            "It looks like you already have an account. Please proceed to the Login screen.",
                            true
                        );
                        showForm(loginFormContainer); // Redirect to login form inside modal
                    } else {
                        showStatusMessage("Registration Failed", error.message, true);
                    }
                } finally {
                    setLoading('submitSignupBtn', false, 'Sign Up');
                }
            });

            // --- API LOGIN (FIXED) ---
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
                    updateHeaderUI();
                    console.log("Login successful!");
                } catch (error) {
                    console.error("Login failed:", error.message);
                    showStatusMessage("Login Failed", "Invalid email or password. Please try again.", true);
                } finally {
                    setLoading('submitLoginBtn', false, 'Login');
                }
            });

            // --- API OTP LOGIN (Simulated) ---
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

            // --- SUBSCRIPTION LOGIC (Uses correct DB field names) ---
            const showSubscriptionModal = () => {
                const user = getLocalUser();
                if (!user || user.role !== "employer") return;

                const modalContent = document.querySelector("#subscriptionModal .modal-content");

                // Uses the database field name 'subscriptionstatus'
                const currentPlanKey = user.subscriptionstatus || 'buzz';
                const currentPlan = HIVE_PLANS[currentPlanKey];

                let planCardsHTML = `<span class="close-btn" id="close-subscription-modal">&times;</span><h2 style="margin-bottom: 1rem;">Choose Your Hive Plan</h2><div class="plans-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1.5rem;">`;

                for (const [key, plan] of Object.entries(HIVE_PLANS)) {
                    const isCurrent = currentPlanKey === key;
                    const priceText = plan.price === 'Free' ? 'Free' : `${plan.price}`;
                    const buttonClass = isCurrent ? 'btn-secondary disabled' : 'btn-primary';
                    const buttonText = isCurrent ? 'Current Plan' : `Select ${plan.price === 'Free' ? 'Free' : 'Upgrade'}`;
                    const priceColor = plan.price === 'Free' ? plan.color : '#333';

                    planCardsHTML += `
                <div class="subscription-card" style="border: 2px solid ${isCurrent ? plan.color : '#ccc'};">
                    <h3 style="color:${plan.color}; font-size:1.3rem;"><i class="${plan.icon}"></i> ${plan.name}</h3>
                    <p style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem; color: ${priceColor};">${priceText}</p>
                    <p style="font-size: 0.8rem; margin-bottom: 1rem; height: 3rem; overflow: hidden; color: #666;">${plan.description}</p>
                    <button class="btn ${buttonClass} select-plan-btn" data-plan-key="${key}" ${isCurrent ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            `;
                }
                planCardsHTML += `</div>`;
                modalContent.innerHTML = planCardsHTML;

                document.getElementById("close-subscription-modal").onclick = () => { subscriptionModal.style.display = "none"; };

                modalContent.querySelectorAll('.select-plan-btn').forEach(btn => {
                    btn.addEventListener('click', async(e) => {
                        const planKey = e.currentTarget.dataset.planKey;
                        const selectedPlan = HIVE_PLANS[planKey];

                        if (planKey === 'buzz') {
                            const user = getLocalUser();
                            user.subscriptionstatus = planKey; // 'subscriptionstatus'
                            user.jobpostcount = 0; // 'jobpostcount'
                            setLocalUser(user);

                            switchEmployerView("employer-post-view");
                            console.log(`Selected ${selectedPlan.name}. Job count reset to 0/${selectedPlan.limit}.`);
                            showStatusMessage("Plan Updated", `${selectedPlan.name} is now your active plan.`, false);
                            subscriptionModal.style.display = "none";
                            updateHeaderUI();
                        } else {
                            console.log(`Redirecting to payment for ${selectedPlan.name} (${selectedPlan.price}).`);
                        }
                    });
                });

                subscriptionModal.style.display = "block";
            };

            window.showSubscriptionModal = showSubscriptionModal;

            // ------------------------------------------------------------------
            // 4. DASHBOARD LOGIC (Uses correct DB field names)
            // ------------------------------------------------------------------
            function initDashboard() {
                const currentUser = getLocalUser();
                const seekerDashboard = document.getElementById("seeker-dashboard");
                const employerDashboard = document.getElementById("employer-dashboard");

                if (currentUser.role === "seeker") {
                    seekerDashboard.classList.remove("hidden");
                    employerDashboard.classList.add("hidden");
                    loadJobs(); // Calls loadJobs, which shows job view
                } else if (currentUser.role === "employer") {
                    employerDashboard.classList.remove("hidden");
                    seekerDashboard.classList.add("hidden");

                    document.querySelectorAll('#employer-dashboard .job-filter-nav button').forEach(btn => {
                        btn.onclick = (e) => {
                            const target = e.target.dataset.viewTarget;
                            switchEmployerView(target);
                        };
                    });

                    document.getElementById("postNewJobBtn").onclick = () => switchEmployerView("employer-post-view");
                    switchEmployerView("employer-management-view");
                }
            }

            // --- SEEKER PROFILE LOAD/SAVE (Uses correct DB field names) ---
            async function loadSeekerProfileForm() {
                const currentUser = getLocalUser();
                const seekerJobView = document.getElementById("seeker-job-view");
                const seekerProfileView = document.getElementById("seeker-profile-view");

                document.getElementById("seeker-name").value = currentUser.name || "";
                document.getElementById("seeker-email").value = currentUser.email || "";
                document.getElementById("seeker-skills").value = (currentUser.skills || []).join(", ");
                document.getElementById("seeker-education").value = currentUser.education || "";

                const cvFilenameEl = document.getElementById("cv-filename");
                // Uses the database field name 'cvfilename'
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
                    } catch (error) {
                        console.error("Profile update failed:", error.message);
                        showStatusMessage("Profile Update Failed", error.message, true);
                    }
                };
            }
            document.getElementById("editProfileBtn").onclick = () => {
                document.getElementById("seeker-profile-view").classList.remove('hidden');
                document.getElementById("seeker-job-view").classList.add('hidden');
                loadSeekerProfileForm();
            };
            document.getElementById("backToJobsBtn").onclick = () => {
                document.getElementById("seeker-job-view").classList.remove('hidden');
                document.getElementById("seeker-profile-view").classList.add('hidden');
                loadJobs();
            };

            // --- JOB BOARD LOAD (Uses correct DB field names) ---
            async function loadJobs() {
                const allJobsList = document.getElementById("all-jobs-list");
                const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");
                const appliedJobsList = document.getElementById("applied-jobs-list");
                const currentUser = getLocalUser();

                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "Loading jobs...";

                try {
                    const jobs = await fetchApi('seeker/jobs', 'GET');

                    // NOTE: Mock application check since a single API call for job status isn't integrated
                    const mockApplications = [
                        { jobid: 2, seekerid: currentUser.id, status: 'applied', answers: ['Yes', '30 days'] },
                        { jobid: 4, seekerid: currentUser.id, status: 'applied', answers: ['No', '60 days'] }
                    ];

                    allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";
                    const seekerSkills = (currentUser.skills || []).map((s) => s.toLowerCase());

                    jobs.forEach((job) => {
                                const hasApplied = mockApplications.some((app) => app.jobid === job.id && app.seekerid === currentUser.id);
                                const isShortlisted = (job.required_skills || []).map((s) => s.toLowerCase()).some((skill) => seekerSkills.includes(skill));

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

            document.querySelectorAll(".apply-btn:not([disabled])").forEach((button) => {
                button.onclick = async (e) => {
                    const jobId = parseInt(e.target.dataset.jobId);
                    const job = jobs.find(j => j.id === jobId);
                    let answers = [];
                    if (job.screening_questions && job.screening_questions.length > 0) {
                        console.log("This job requires screening questions before application.");
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
                        loadJobs(); // Re-load to update UI status
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

        } catch (error) {
            allJobsList.innerHTML = "<p style='color:red;'>Failed to load jobs. Please check your backend server status.</p>";
        }
    }

    // --- EMPLOYER DASHBOARD LOGIC (Uses correct DB field names) ---
    function switchEmployerView(targetViewId) {
        document.querySelectorAll("#employer-dashboard .full-screen-view").forEach(view => {
            view.classList.add("hidden");
        });

        document.querySelectorAll('#employer-dashboard .job-filter-nav button').forEach(btn => {
            if (btn.dataset.viewTarget === targetViewId) {
                btn.classList.add('btn-primary');
            } else {
                btn.classList.remove('btn-primary');
            }
        });

        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.remove("hidden");
            if (targetViewId === "employer-post-view") loadEmployerPostForm();
            if (targetViewId === "employer-management-view") loadPostedJobs();
            if (targetViewId === "employer-seeker-view") loadSeekerCVs();
        }
    }

    function loadEmployerPostForm() {
        const user = getLocalUser();
        
        // Uses the database field names
        const currentPlanKey = user.subscriptionstatus || 'buzz'; 
        const currentPlan = HIVE_PLANS[currentPlanKey];
        const isUnlimited = currentPlan.limit === Infinity;
        const currentJobs = user.jobpostcount || 0; 
        const jobLimit = currentPlan.limit;

        const statusEl = document.getElementById("employer-subscription-status-small");
        
        statusEl.innerHTML = isUnlimited
            ? `<a href="#" onclick="event.preventDefault(); showSubscriptionModal();" style="color: ${currentPlan.color}">Unlimited Posts (${currentPlan.name})</a>`
            : `<a href="#" onclick="event.preventDefault(); showSubscriptionModal();" style="color: ${currentPlan.color}">${currentPlan.name}: ${currentJobs}/${jobLimit} Posts</a>`;

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
        
        const jobForms = {
            1: document.getElementById("jobStep1Form"), 2: document.getElementById("jobStep2Form"), 3: document.getElementById("jobStep3Form"),
        };
        jobForms[1].classList.remove("hidden"); jobForms[2].classList.add("hidden"); jobForms[3].classList.add("hidden");

        document.querySelectorAll(".next-step-btn").forEach((button) => {
            button.onclick = () => {
                if (!canPost) {
                    console.log(`Your ${currentPlan.name} limit has been reached.`);
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
            if (screeningSelect.value === 'yes') { screeningContainer.classList.remove("hidden"); } 
            else { screeningContainer.classList.add("hidden"); }
        };
    }

    async function handleJobPost(e, jobId = null) {
        e.preventDefault();
        const postJobSubmitBtn = document.getElementById('postJobSubmitBtn');
        setLoading('postJobSubmitBtn', true, jobId ? 'Save Changes & Update Job' : 'Review & Post Job');
        
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
            if (q1 === "" || q2 === "") { console.error("Question 1 and 2 are mandatory."); setLoading('postJobSubmitBtn', false, postJobSubmitBtn.textContent); return; }
            if (q1) screeningQ.push(q1); if (q2) screeningQ.push(q2); if (q3) screeningQ.push(q3);
        }
        jobData.screeningQuestions = screeningQ;

        try {
            const response = await fetchApi(`employer/jobs${jobId ? '/' + jobId : ''}`, jobId ? 'PUT' : 'POST', jobData);
            
            // FIX: Ensure 'user' object is valid before updating local storage to prevent crash
            if (response && response.job && response.job.user) { 
                setLocalUser(response.job.user); 
            } else {
                 console.warn("API did not return updated user object. Check backend response format.");
            }
            
            console.log(`Job ${jobId ? 'updated' : 'posted'} successfully!`);
            showStatusMessage("Success!", `Job has been successfully ${jobId ? 'updated' : 'posted'}.`, false);
            
            document.getElementById("jobStep3Form").reset();
            switchEmployerView("employer-management-view");

        } catch (error) {
            console.error("Job operation failed:", error.message);
            showStatusMessage("Job Operation Failed", error.message, true);
        } finally {
            setLoading('postJobSubmitBtn', false, postJobSubmitBtn.textContent);
        }
    }

    async function loadPostedJobs() {
        const postedJobsList = document.getElementById("posted-jobs-list");
        postedJobsList.innerHTML = "Loading posted jobs...";
        
        try {
            const myJobs = await fetchApi('employer/jobs', 'GET');
            postedJobsList.innerHTML = "";
            const totalSeekerCount = "N/A (Admin API needed)"; 
            document.getElementById("seeker-count").textContent = totalSeekerCount; 

            if (myJobs.length === 0) {
                postedJobsList.innerHTML = "<p>You have not posted any jobs yet. Click 'Post New Job' to start.</p>";
                return;
            }

            myJobs.forEach((job) => {
                const applicantCount = job.applications[0].count;
                // Uses the database field name 'posteddate'
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
        // Uses the database field names
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
                    <tr>
                        <td>${app.name}</td>
                        <td>${app.email}</td>
                        <td>${app.phone || 'N/A'}</td>
                        <td>${(app.skills || []).join(", ") || 'N/A'}</td>
                        <td>
                            ${
                                app.cvfilename 
                                ? `<a href="#" class="cv-link" data-filename="${app.cvfilename}">View/Download</a>`
                                : 'N/A'
                            }
                        </td>
                        ${screeningCells(app)}
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
            }
            applicantsModal.style.display = "block";
        } catch (error) {
            listElement.innerHTML = `<p style='color:red;'>Failed to load applicants: ${error.message}</p>`;
        }
    }

    async function loadSeekerCVs() {
        const listContainer = document.getElementById("seeker-cv-list");
        listContainer.innerHTML = "Loading talent pool data...";
        
        try {
            const allSeekers = await fetchApi('employer/seekers', 'GET');
            const categoryFilter = document.getElementById("seeker-filter-category");
            const skillFilter = document.getElementById("seeker-filter-skill");

            const renderCVs = (seekers) => {
                if (seekers.length === 0) {
                    listContainer.innerHTML = "<p>No job seekers match your current filter requirements. Try a broader search!</p>";
                    return;
                }

                listContainer.innerHTML = seekers.map(seeker => `
                    <div class="seeker-cv-card" data-seeker-id="${seeker.id}">
                        <h4>${seeker.name}</h4>
                        <p><strong>Education:</strong> ${seeker.education || 'N/A'}</p>
                        <div class="skills">${(seeker.skills || []).map((s) => `<span>${s}</span>`).join("")}</div>
                        <a href="#" class="btn btn-primary view-cv-details" data-userid="${seeker.id}">View Details & CV</a>
                    </div>
                `).join('');

                listContainer.querySelectorAll('.view-cv-details').forEach(link => {
                    link.onclick = (e) => {
                        e.preventDefault();
                        const seekerId = e.target.dataset.userid;
                        const seeker = allSeekers.find(u => u.id === seekerId);
                        console.log(`SEEKER PROFILE: Name: ${seeker.name}, CV: ${seeker.cvfilename || 'Not Uploaded'}`);
                    };
                });
            };

            const applyFilters = () => {
                const selectedCategory = categoryFilter.value;
                const skillText = skillFilter.value.toLowerCase().trim();

                let filteredSeekers = allSeekers;

                if (skillText.length > 0) {
                    filteredSeekers = filteredSeekers.filter(seeker =>
                        (seeker.skills || []).some(s => s.toLowerCase().includes(skillText))
                    );
                }

                if (selectedCategory !== 'all') {
                    const categoryKeywords = {
                        'IT & Tech': ['javascript', 'react', 'python', 'developer', 'software', 'cloud'],
                        'Marketing & Finance': ['marketing', 'finance', 'accounting', 'seo', 'excel', 'audit'],
                        'Manufacturing': ['mechanical', 'engineer', 'production', 'supply', 'quality', 'cad'],
                        'Hospitality': ['hotel', 'chef', 'service', 'front desk', 'f&b'],
                        'Sales': ['sales', 'b2b', 'account', 'crm'],
                        'Management': ['manager', 'leadership', 'operations', 'project', 'hr'],
                    };

                    filteredSeekers = filteredSeekers.filter(seeker => {
                        const seekerSkillsLower = (seeker.skills || []).map(s => s.toLowerCase());
                        return categoryKeywords[selectedCategory].some(keyword => 
                            seekerSkillsLower.some(skill => skill.includes(keyword))
                        );
                    });
                }
                renderCVs(filteredSeekers);
            };

            categoryFilter.onchange = applyFilters;
            skillFilter.oninput = applyFilters; 
            applyFilters();
        } catch (error) {
            listContainer.innerHTML = `<p style='color:red;'>Failed to load talent pool data: ${error.message}. Check your backend and employer role.</p>`;
        }
    }
    
    // ------------------------------------------------------------------
    // 5. ADMIN LOGIC (SIMULATED)
    // ------------------------------------------------------------------
    function initAdmin() {
        const getMockDb = () => JSON.parse(localStorage.getItem("hirehiveDB") || '{"users": [], "jobs": []}');
        const db = getMockDb();
        
        document.getElementById("total-seekers").textContent = db.users.filter((u) => u.role === "seeker").length;
        document.getElementById("total-employers").textContent = db.users.filter((u) => u.role === "employer").length;
        document.getElementById("total-jobs").textContent = db.jobs.length;
        document.getElementById("total-subscriptions").textContent = db.users.filter((u) => u.subscription && u.subscription.active).length;

        const seekersListContainer = document.getElementById("job-seekers-list");
        const seekers = db.users.filter((u) => u.role === "seeker");
        if (seekers.length > 0) {
            seekersListContainer.innerHTML = `<ul>${seekers.map((seeker) => `<li>${seeker.name} (${seeker.email}) - <a href="#" class="view-profile" data-userid="${seeker.id}">View Profile</a></li>`).join("")}</ul>`;
        } else {
            seekersListContainer.innerHTML = "<p>No job seekers have registered yet.</p>";
        }

        const employersListContainer = document.getElementById("employer-profiles-list");
        const employers = db.users.filter((u) => u.role === "employer");
        if (employers.length > 0) {
            employersListContainer.innerHTML = `<ul>${employers.map((employer) => `<li>${employer.name} (${employer.email}) - <a href="#" class="view-profile" data-userid="${employer.id}">View Details</a></li>`).join("")}</ul>`;
        } else {
            employersListContainer.innerHTML = "<p>No employers have registered yet.</p>";
        }

        document.querySelectorAll(".view-profile").forEach(
            (link) =>
            (link.onclick = (e) => {
                e.preventDefault();
                const userProfile = db.users.find((u) => u.id === e.target.dataset.userid);
                console.log(`${userProfile.role.toUpperCase()} Profile:\nName: ${userProfile.name}\nEmail: ${userProfile.email}\nPlan: ${userProfile.subscription?.active ? 'Premium' : 'Basic'}`);
            })
        );
    }
});