// --- Frontend: app.js (REPLACE ENTIRE FILE) ---
document.addEventListener("DOMContentLoaded", () => {
            // ------------------------------------------------------------------
            // 1. GLOBAL CONFIGURATION & TOKEN MANAGEMENT
            // ------------------------------------------------------------------
            // IMPORTANT: REPLACE THIS with your LIVE Render domain URL
            const BASE_URL = "https://hirehive-api.onrender.com/api";

            const getToken = () => localStorage.getItem("hirehiveToken");
            const setToken = (token) => localStorage.setItem("hirehiveToken", token);
            const removeToken = () => localStorage.removeItem("hirehiveToken");

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
                        throw new Error(errorMessage);
                    }

                    return responseData;
                } catch (error) {
                    console.error("API Error:", error.message);
                    alert(`Error: ${error.message}`);
                    throw error;
                }
            }


            // ------------------------------------------------------------------
            // 2. BACKEND SIMULATION HELPERS 
            // ------------------------------------------------------------------
            if (!localStorage.getItem("hirehiveDB")) {
                const db = {
                    users: [],
                    jobs: [],
                    applications: [],
                    currentUser: null,
                };
                localStorage.setItem("hirehiveDB", JSON.stringify(db));
            }

            const getDb = () => JSON.parse(localStorage.getItem("hirehiveDB"));
            const saveDb = (db) => localStorage.setItem("hirehiveDB", JSON.stringify(db));

            const getLocalUser = () => getDb().currentUser;
            const setLocalUser = (user) => {
                const db = getDb();
                db.currentUser = user;
                saveDb(db);
            };

            const getCurrentMonthJobCount = () => {
                const db = getDb();
                const currentUser = getLocalUser();
                if (!currentUser || currentUser.role !== 'employer') return 0;

                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                return db.jobs.filter(job =>
                    job.employerId === currentUser.id &&
                    new Date(job.postedDate) >= startOfMonth
                ).length;
            };


            // ------------------------------------------------------------------
            // 3. SPA ROUTER / VIEW MANAGER & MOBILE MENU 
            // ------------------------------------------------------------------
            const views = {
                'home': document.getElementById("home-view"),
                'dashboard': document.getElementById("dashboard-view"),
                'admin': document.getElementById("admin-view"),
                'about': document.getElementById("about-view"),
                'contact': document.getElementById("contact-view"),
                'career-growth': document.getElementById("career-growth-view"), // NEW VIEW REGISTERED
            };

            const dashboardLink = document.getElementById("dashboardLink");
            const adminLink = document.getElementById("adminLink");
            const loginBtn = document.getElementById("loginBtn");
            const signupBtn = document.getElementById("signupBtn");
            const logoutBtn = document.getElementById("logoutBtn");
            const welcomeMessage = document.getElementById("welcome-message");
            const seekerDashboard = document.getElementById("seeker-dashboard");
            const employerDashboard = document.getElementById("employer-dashboard");

            const employerPostView = document.getElementById("employer-post-view");
            const employerManagementView = document.getElementById("employer-management-view");
            const employerSeekerView = document.getElementById("employer-seeker-view");
            const employerNavTabs = document.getElementById("employer-nav-tabs");

            const seekerJobView = document.getElementById("seeker-job-view");
            const seekerProfileView = document.getElementById("seeker-profile-view");
            const editProfileBtn = document.getElementById("editProfileBtn");
            const backToJobsBtn = document.getElementById("backToJobsBtn");
            const jobFilterBtns = document.querySelectorAll(".job-filter-btn");
            const jobViewSections = document.querySelectorAll(".job-view-section");

            // --- MOBILE MENU TOGGLE LOGIC ---
            const menuToggle = document.getElementById('menuToggle');
            const navLinks = document.getElementById('navLinks');

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
                    welcomeMessage.textContent = `Welcome, ${user.name}`;

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
                        showForm(loginFormContainer);
                    }
                });
            });

            // ------------------------------------------------------------------
            // 4. AUTH & MODAL LOGIC 
            // ------------------------------------------------------------------
            const modal = document.getElementById("authModal");
            const loginFormContainer = document.getElementById("login-form-container");
            const signupFormContainer = document.getElementById("signup-form-container");
            const otpFormContainer = document.getElementById("otp-form-container");
            const closeBtn = document.querySelector("#authModal .close-btn");
            const applicantsModal = document.getElementById("applicantsModal");
            const subscriptionModal = document.getElementById("subscriptionModal");
            const closeApplicantsModalBtn = document.getElementById("close-applicants-modal");
            const closeSubscriptionModalBtn = document.getElementById("close-subscription-modal");

            const showForm = (formToShow) => {
                [loginFormContainer, signupFormContainer, otpFormContainer].forEach((f) => f.classList.add("hidden"));
                formToShow.classList.remove("hidden");
                modal.style.display = "block";
            };

            loginBtn.onclick = () => showForm(loginFormContainer);
            signupBtn.onclick = () => showForm(signupFormContainer);
            closeBtn.onclick = () => { modal.style.display = "none"; };
            closeApplicantsModalBtn.onclick = () => { applicantsModal.style.display = "none"; };
            closeSubscriptionModalBtn.onclick = () => { subscriptionModal.style.display = "none"; };

            window.onclick = (event) => {
                if (event.target == modal) modal.style.display = "none";
                if (event.target == applicantsModal) applicantsModal.style.display = "none";
                if (event.target == subscriptionModal) subscriptionModal.style.display = "none";
            };

            document.getElementById("switch-form-link").onclick = (e) => {
                e.preventDefault();
                showForm(signupFormContainer.classList.contains("hidden") ? signupFormContainer : loginFormContainer);
            };
            document.getElementById("switch-to-otp").onclick = (e) => {
                e.preventDefault();
                showForm(otpFormContainer);
            };

            // --- API SIGNUP ---
            document.getElementById("signupForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                const email = document.getElementById("signupEmail").value;
                const password = 'Password123';
                const role = document.getElementById("userType").value;
                const name = document.getElementById("signupName").value;
                const phone = document.getElementById("signupPhone").value;

                try {
                    const data = await fetchApi('auth/signup', 'POST', { name, email, password, role, phone });

                    setToken(data.token);
                    setLocalUser(data.user);

                    modal.style.display = "none";
                    updateHeaderUI();
                } catch (error) {
                    // Error is handled by fetchApi helper
                }
            });

            // --- API LOGIN ---
            document.getElementById("loginForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                const email = document.getElementById("loginEmail").value;
                const password = 'Password123'; // Simulated password

                try {
                    const data = await fetchApi('auth/login', 'POST', { email, password });

                    setToken(data.token);
                    setLocalUser(data.user);

                    modal.style.display = "none";
                    updateHeaderUI();
                } catch (error) {
                    // Error is handled by fetchApi helper
                }
            });

            // --- API OTP LOGIN (Simulated) ---
            document.getElementById("otpForm").addEventListener("submit", async(e) => {
                e.preventDefault();
                const phone = document.getElementById("otpPhone").value;

                const db = getDb();
                const user = db.users.find((u) => u.phone === phone);

                if (user) {
                    const fakeOtp = prompt("We've 'sent' an OTP to your number. (Hint: It's 123456)");
                    if (fakeOtp === "123456") {
                        setToken('fake-otp-token');
                        setLocalUser(user);
                        modal.style.display = "none";
                        updateHeaderUI();
                    } else {
                        alert("Invalid OTP!");
                    }
                } else {
                    alert("User with this phone number not found!");
                }
            });

            // --- SUBSCRIPTION LOGIC UPDATE (5-Tier Plans UI) ---
            const showSubscriptionModal = () => {
                const user = getLocalUser();
                if (!user || user.role !== "employer") return;

                const modalContent = document.querySelector("#subscriptionModal .modal-content");

                let planCardsHTML = `<span class="close-btn" id="close-subscription-modal">&times;</span><h2 style="margin-bottom: 1rem;">Choose Your Hive Plan</h2><div class="plans-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1.5rem;">`;

                for (const [key, plan] of Object.entries(HIVE_PLANS)) {
                    const isCurrent = user.subscription_status === key;
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

                        // --- SIMULATED UPGRADE/DOWNGRADE ---
                        if (planKey === 'buzz') {
                            // Downgrade logic simulation
                            alert(`Selected ${selectedPlan.name}. Your job count has been reset to 0/${selectedPlan.limit} for the month.`);
                            subscriptionModal.style.display = "none";
                            updateHeaderUI();
                        } else {
                            alert(`Redirecting to Stripe for payment of ${selectedPlan.name} (${selectedPlan.price}).`);
                            // In a real app, you would redirect to the Stripe Checkout Session URL here.
                        }
                    });
                });

                subscriptionModal.style.display = "block";
            };

            window.showSubscriptionModal = showSubscriptionModal;

            // ------------------------------------------------------------------
            // 5. DASHBOARD ENTRY POINT
            // ------------------------------------------------------------------
            function initDashboard() {
                const currentUser = getLocalUser();

                if (currentUser.role === "seeker") {
                    seekerDashboard.classList.remove("hidden");
                    employerDashboard.classList.add("hidden");
                    showSeekerJobView();
                } else if (currentUser.role === "employer") {
                    employerDashboard.classList.remove("hidden");
                    seekerDashboard.classList.add("hidden");

                    employerNavTabs.querySelectorAll('.employer-tab-btn').forEach(btn => {
                        btn.onclick = (e) => {
                            const target = e.target.dataset.viewTarget;
                            switchEmployerView(target);
                        };
                    });

                    document.getElementById("postNewJobBtn").onclick = () => switchEmployerView("employer-post-view");
                    switchEmployerView("employer-management-view");
                }
            }

            // ------------------------------------------------------------------
            // 6. SEEKER DASHBOARD (MIGRATED TO API)
            // ------------------------------------------------------------------
            const showSeekerProfileView = () => {
                seekerProfileView.classList.remove('hidden');
                seekerJobView.classList.add('hidden');
                loadSeekerProfileForm();
            };

            const showSeekerJobView = () => {
                seekerJobView.classList.remove('hidden');
                seekerProfileView.classList.add('hidden');
                loadJobs();
            };

            editProfileBtn.onclick = showSeekerProfileView;
            backToJobsBtn.onclick = showSeekerJobView;

            // --- SEEKER PROFILE LOAD/SAVE (API) ---
            async function loadSeekerProfileForm() {
                const currentUser = getLocalUser();

                document.getElementById("seeker-name").value = currentUser.name || "";
                document.getElementById("seeker-email").value = currentUser.email || "";
                document.getElementById("seeker-skills").value = (currentUser.skills || []).join(", ");
                document.getElementById("seeker-education").value = currentUser.education || "";

                const cvFilenameEl = document.getElementById("cv-filename");
                if (currentUser.cvFileName) {
                    cvFilenameEl.innerHTML = `Uploaded: ${currentUser.cvFileName} (<a href="#" class="cv-link" data-filename="${currentUser.cvFileName}">View/Download</a>)`;
                } else {
                    cvFilenameEl.textContent = "No CV uploaded.";
                }

                cvFilenameEl.querySelectorAll('.cv-link').forEach(link => {
                    link.onclick = (e) => {
                        e.preventDefault();
                        alert(`Simulating download/view of CV: ${e.target.dataset.filename}.`);
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
                        alert("Profile updated!");
                        showSeekerJobView();
                    } catch (error) {
                        // Error handled by fetchApi
                    }
                };
            }

            // --- JOB BOARD LOAD (API) ---
            async function loadJobs() {
                const allJobsList = document.getElementById("all-jobs-list");
                const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");
                const appliedJobsList = document.getElementById("applied-jobs-list");
                const currentUser = getLocalUser();

                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "Loading jobs...";

                try {
                    const jobs = await fetchApi('seeker/jobs', 'GET');

                    const db = getDb();
                    const seekerApplications = db.applications.filter(app => app.seekerId === currentUser.id);

                    allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";
                    const seekerSkills = (currentUser.skills || []).map((s) => s.toLowerCase());

                    jobs.forEach((job) => {
                                const hasApplied = seekerApplications.some((app) => app.jobId === job.id);
                                const isShortlisted = job.requiredSkills.map((s) => s.toLowerCase()).some((skill) => seekerSkills.includes(skill));

                                const isDisabled = hasApplied;
                                const applyButtonText = hasApplied ? "Applied" : "Apply Now";

                                const jobCardHTML = `
                <div class="job-card" data-job-id="${job.id}">
                    <h4>${job.title} (${job.employer.name})</h4>
                    <p><i class="fas fa-map-marker-alt"></i> ${job.location} | <i class="fas fa-briefcase"></i> ${job.experience} | <i class="fas fa-money-bill-wave"></i> ${job.salary}</p>
                    <p>${job.description.substring(0, 100)}...</p>
                    <div class="skills">${job.requiredSkills.map((s) => `<span>${s}</span>`).join("")}</div>
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

                    if (job.screeningQuestions && job.screeningQuestions.length > 0) {
                        alert("This job requires screening questions before application.");
                        for (const q of job.screeningQuestions) {
                            const answer = prompt(q);
                            if (answer === null) {
                                alert("Application cancelled.");
                                return;
                            }
                            answers.push(answer);
                        }
                    }

                    try {
                        await fetchApi(`seeker/apply/${jobId}`, 'POST', { answers });
                        
                        const db = getDb();
                        db.applications.push({jobId, seekerId: currentUser.id, status: "applied", answers: answers});
                        saveDb(db); 
                        
                        alert("Application submitted!");
                        loadJobs();
                    } catch (error) {
                        // Error handled by fetchApi
                    }
                };
            });

            const defaultFilterBtn = document.querySelector('.job-filter-btn[data-filter="all"]');
            if (defaultFilterBtn && !defaultFilterBtn.classList.contains('btn-primary')) {
                defaultFilterBtn.click();
            }

        } catch (error) {
            allJobsList.innerHTML = "<p style='color:red;'>Failed to load jobs. Please check your backend server status.</p>";
        }
    }


    // ------------------------------------------------------------------
    // 7. EMPLOYER DASHBOARD (MIGRATED TO API)
    // ------------------------------------------------------------------
    function switchEmployerView(targetViewId) {
        [employerPostView, employerManagementView, employerSeekerView].forEach(view => {
            view.classList.add("hidden");
        });

        employerNavTabs.querySelectorAll('.employer-tab-btn').forEach(btn => {
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

    // --- JOB POST/UPDATE FORM (API) ---
    function loadEmployerPostForm() {
        const user = getLocalUser();
        
        // Use user's actual subscription status for plan lookup
        const currentPlanKey = user.subscription_status || 'buzz';
        const currentPlan = HIVE_PLANS[currentPlanKey];
        
        const isUnlimited = currentPlan.limit === Infinity;
        const currentJobs = getCurrentMonthJobCount(); 
        const jobLimit = currentPlan.limit;

        const statusEl = document.getElementById("employer-subscription-status-small");
        
        // Update UI based on new tiers 
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

        const screeningSelect = document.getElementById("add-screening-questions");
        const screeningContainer = document.getElementById("screening-questions-container");

        screeningContainer.classList.add("hidden");
        screeningSelect.value = "no";
        document.getElementById("sq1").value = "";
        document.getElementById("sq2").value = "";
        document.getElementById("sq3").value = "";
        
        screeningSelect.onchange = () => {
            if (screeningSelect.value === 'yes') {
                screeningContainer.classList.remove("hidden");
            } else {
                screeningContainer.classList.add("hidden");
            }
        };
        
        const jobForms = {
            1: document.getElementById("jobStep1Form"),
            2: document.getElementById("jobStep2Form"),
            3: document.getElementById("jobStep3Form"),
        };

        jobForms[1].classList.remove("hidden");
        jobForms[2].classList.add("hidden");
        jobForms[3].classList.add("hidden");

        document.querySelectorAll(".next-step-btn").forEach((button) => {
            button.onclick = () => {
                if (!canPost) {
                    alert(`Your ${currentPlan.name} limit has been reached. Please upgrade to post more jobs.`);
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
    }

    // --- API JOB POST/UPDATE HANDLER ---
    async function handleJobPost(e, jobId = null) {
        e.preventDefault();

        const jobData = {
            title: document.getElementById("job-title").value,
            category: document.getElementById("job-category").value,
            location: document.getElementById("job-location").value,
            experience: document.getElementById("job-experience").value,
            salary: document.getElementById("job-salary").value,
            ctc: document.getElementById("job-current-ctc").value,
            requiredSkills: document.getElementById("job-skills").value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            description: document.getElementById("job-description").value,
            noticePeriod: document.getElementById("job-notice-period").value,
        };

        const screeningQ = [];
        if (document.getElementById("add-screening-questions").value === 'yes') {
            const q1 = document.getElementById("sq1").value.trim();
            const q2 = document.getElementById("sq2").value.trim();
            const q3 = document.getElementById("sq3").value.trim();
            
            if (q1 === "" || q2 === "") {
                alert("Question 1 and Question 2 are mandatory.");
                return;
            }
            if (q1) screeningQ.push(q1);
            if (q2) screeningQ.push(q2);
            if (q3) screeningQ.push(q3);
        }
        jobData.screeningQuestions = screeningQ;

        try {
            if (jobId) {
                await fetchApi(`employer/jobs/${jobId}`, 'PUT', jobData);
                alert("Job updated successfully! Redirecting to management view.");
            } else {
                const data = await fetchApi('employer/jobs', 'POST', jobData);
                
                const db = getDb();
                db.jobs.push(data.job);
                saveDb(db);

                alert("Job posted successfully! Redirecting to management view.");
            }
            
            document.getElementById("jobStep3Form").reset();
            loadEmployerPostForm();
            switchEmployerView("employer-management-view");
        } catch (error) {
            // Error handled by fetchApi
        }
    }


    // --- POSTED JOBS LOAD (API) ---
    async function loadPostedJobs() {
        const postedJobsList = document.getElementById("posted-jobs-list");
        postedJobsList.innerHTML = "Loading posted jobs...";
        
        try {
            const myJobs = await fetchApi('employer/jobs', 'GET');
            postedJobsList.innerHTML = "";

            const totalSeekerCount = "N/A (Fetch from separate admin API)"; 
            document.getElementById("seeker-count").textContent = totalSeekerCount; 

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
                            <span class="job-posted-date"> | Posted: ${new Date(job.postedDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                `;
            });

            document.querySelectorAll(".view-applicants-btn").forEach((button) => {
                button.onclick = (e) => {
                    e.preventDefault();
                    showApplicantsModal(parseInt(e.currentTarget.dataset.jobId));
                };
            });
            
            document.querySelectorAll(".edit-job-btn").forEach((button) => {
                button.onclick = (e) => {
                    e.preventDefault();
                    editJob(parseInt(e.currentTarget.dataset.jobId), myJobs.find(j => j.id === parseInt(e.currentTarget.dataset.jobId)));
                };
            });

            document.querySelectorAll(".delete-job-btn").forEach((button) => {
                button.onclick = (e) => {
                    e.preventDefault();
                    deleteJob(parseInt(e.currentTarget.dataset.jobId));
                };
            });

        } catch (error) {
            postedJobsList.innerHTML = "<p style='color:red;'>Failed to load posted jobs. Please ensure your backend is running.</p>";
        }
    }

    // --- JOB EDIT PRE-FILL ---
    function editJob(jobId, jobToEdit) {
        if (!confirm(`Are you sure you want to edit the job: ${jobToEdit.title}? This will pre-fill the posting form.`)) {
            return;
        }

        document.getElementById("job-title").value = jobToEdit.title || '';
        document.getElementById("job-category").value = jobToEdit.category || '';
        document.getElementById("job-location").value = jobToEdit.location || '';
        document.getElementById("job-experience").value = jobToEdit.experience || '';
        document.getElementById("job-salary").value = jobToEdit.salary || '';
        document.getElementById("job-current-ctc").value = jobToEdit.ctc || '';
        document.getElementById("job-skills").value = (jobToEdit.requiredSkills || []).join(", ");
        document.getElementById("job-description").value = jobToEdit.description || '';
        document.getElementById("job-notice-period").value = jobToEdit.noticePeriod || '';

        const screeningSelect = document.getElementById("add-screening-questions");
        const screeningContainer = document.getElementById("screening-questions-container");
        const questions = jobToEdit.screeningQuestions || [];

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

    // --- JOB DELETE (API) ---
    async function deleteJob(jobId) {
        if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
            return;
        }

        try {
            await fetchApi(`employer/jobs/${jobId}`, 'DELETE');
            
            const db = getDb();
            db.jobs = db.jobs.filter(job => job.id !== jobId);
            saveDb(db);

            alert("Job successfully deleted.");
            loadPostedJobs();
        } catch (error) {
            // Error handled by fetchApi
        }
    }

    // --- RENDER APPLICANTS MODAL (API) ---
    async function showApplicantsModal(jobId) {
        const listElement = document.getElementById("applicants-list");
        listElement.innerHTML = "Loading applicants...";

        try {
            const data = await fetchApi(`employer/applicants/${jobId}`, 'GET');
            const job = { title: "Applicants for Job", screeningQuestions: data.screeningQuestions };
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
                            ${app.cvFileName 
                                ? `<a href="#" class="cv-link" data-filename="${app.cvFileName}">View/Download</a>`
                                : 'N/A'}
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
                    link.onclick = (e) => {
                        e.preventDefault();
                        alert(`Simulating secure CV download/view for: ${e.target.dataset.filename}.`);
                    };
                });
            }
            applicantsModal.style.display = "block";
        } catch (error) {
            listElement.innerHTML = "<p style='color:red;'>Failed to load applicants.</p>";
        }
    }

    // --- SEEKER CV LOAD (API) ---
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
                        <div class="skills">${(seeker.skills || []).map(s => `<span>${s}</span>`).join('')}</div>
                        <a href="#" class="btn btn-primary view-cv-details" data-userid="${seeker.id}">View Details & CV</a>
                    </div>
                `).join('');

                listContainer.querySelectorAll('.view-cv-details').forEach(link => {
                    link.onclick = (e) => {
                        e.preventDefault();
                        const seekerId = parseInt(e.target.dataset.userid);
                        const seeker = allSeekers.find(u => u.id === seekerId);

                        alert(
                            `SEEKER PROFILE:\n` +
                            `Name: ${seeker.name}\n` +
                            `Email: ${seeker.email}\n` +
                            `Phone: ${seeker.phone || 'N/A'}\n` +
                            `Skills: ${seeker.skills.join(", ") || 'N/A'}\n` +
                            `Education: ${seeker.education || 'N/A'}\n` +
                            `CV: ${seeker.cvFileName || 'Not Uploaded'}\n\n`
                        );
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
            listContainer.innerHTML = "<p style='color:red;'>Failed to load talent pool data. Check your backend and employer role.</p>";
        }
    }
    
    // ------------------------------------------------------------------
    // 8. ADMIN LOGIC (API)
    // ------------------------------------------------------------------
    function initAdmin() {
        const db = getDb();
        
        document.getElementById("total-seekers").textContent = db.users.filter((u) => u.role === "seeker").length;
        document.getElementById("total-employers").textContent = db.users.filter((u) => u.role === "employer").length;
        document.getElementById("total-jobs").textContent = db.jobs.length;
        document.getElementById("total-subscriptions").textContent = db.users.filter((u) => u.subscription.active).length;

        const seekersListContainer = document.getElementById("job-seekers-list");
        const seekers = db.users.filter((u) => u.role === "seeker");
        if (seekers.length > 0) {
            seekersListContainer.innerHTML = `<ul>${seekers.map(
                (seeker) => `<li>${seeker.name} (${seeker.email}) - <a href="#" class="view-profile" data-userid="${seeker.id}">View Profile</a></li>`
            ).join("")}</ul>`;
        } else {
            seekersListContainer.innerHTML = "<p>No job seekers have registered yet.</p>";
        }

        const employersListContainer = document.getElementById("employer-profiles-list");
        const employers = db.users.filter((u) => u.role === "employer");
        if (employers.length > 0) {
            employersListContainer.innerHTML = `<ul>${employers.map(
                (employer) => `<li>${employer.name} (${employer.email}) - <a href="#" class="view-profile" data-userid="${employer.id}">View Details</a></li>`
            ).join("")}</ul>`;
        } else {
            employersListContainer.innerHTML = "<p>No employers have registered yet.</p>";
        }

        document.querySelectorAll(".view-profile").forEach(
            (link) =>
            (link.onclick = (e) => {
                e.preventDefault();
                const userProfile = db.users.find((u) => u.id === parseInt(e.target.dataset.userid));
                alert(
                    `${userProfile.role.toUpperCase()} Profile:\nName: ${userProfile.name}\nEmail: ${userProfile.email}\nPlan: ${userProfile.subscription.active ? 'Premium' : 'Basic'}`
                );
            })
        );
    }
});