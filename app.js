document.addEventListener("DOMContentLoaded", () => {
            // ---- MOBILE MENU TOGGLE LOGIC ---
            const menuToggle = document.getElementById('menuToggle');
            const navLinks = document.getElementById('navLinks');

            if (menuToggle && navLinks) {
                menuToggle.addEventListener('click', () => {
                    navLinks.classList.toggle('active');
                });

                // Close menu after clicking a link (important for single-page apps)
                navLinks.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => {
                        if (navLinks.classList.contains('active')) {
                            navLinks.classList.remove('active');
                        }
                    });
                });
            }
            // ---------------------------------

            // ---- DATABASE INITIALIZATION ----
            if (!localStorage.getItem("hirehiveDB")) {
                const db = {
                    users: [],
                    jobs: [],
                    applications: [],
                    currentUser: null,
                };
                localStorage.setItem("hirehiveDB", JSON.stringify(db));
            }

            // ---- HELPERS ----
            const getDb = () => JSON.parse(localStorage.getItem("hirehiveDB"));
            const saveDb = (db) => localStorage.setItem("hirehiveDB", JSON.stringify(db));

            // Helper to simulate current month's job count
            const getCurrentMonthJobCount = (employerId) => {
                const db = getDb();
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                return db.jobs.filter(job =>
                    job.employerId === employerId &&
                    new Date(job.postedDate) >= startOfMonth
                ).length;
            };


            // ---- SPA ROUTER / VIEW MANAGER ----
            const homeView = document.getElementById("home-view");
            const dashboardView = document.getElementById("dashboard-view");
            const adminView = document.getElementById("admin-view");
            const aboutView = document.getElementById("about-view");
            const contactView = document.getElementById("contact-view");

            const views = {
                'home': homeView,
                'dashboard': dashboardView,
                'admin': adminView,
                'about': aboutView,
                'contact': contactView,
            };

            const dashboardLink = document.getElementById("dashboardLink");
            const adminLink = document.getElementById("adminLink");
            const loginBtn = document.getElementById("loginBtn");
            const signupBtn = document.getElementById("signupBtn");
            const logoutBtn = document.getElementById("logoutBtn");
            const welcomeMessage = document.getElementById("welcome-message");
            const seekerDashboard = document.getElementById("seeker-dashboard");
            const employerDashboard = document.getElementById("employer-dashboard");
            const postJobSubmitBtn = document.getElementById("postJobSubmitBtn");

            // Employer View elements
            const employerPostView = document.getElementById("employer-post-view");
            const employerManagementView = document.getElementById("employer-management-view");
            const viewManagementBtn = document.getElementById("viewManagementBtn");
            const postNewJobBtn = document.getElementById("postNewJobBtn");

            // NEW Seeker View elements
            const seekerJobView = document.getElementById("seeker-job-view");
            const seekerProfileView = document.getElementById("seeker-profile-view");
            const editProfileBtn = document.getElementById("editProfileBtn");
            const backToJobsBtn = document.getElementById("backToJobsBtn");
            const jobFilterBtns = document.querySelectorAll(".job-filter-btn");
            const jobViewSections = document.querySelectorAll(".job-view-section");


            const showView = (viewName, updateHash = true) => {
                // Hide all views
                Object.values(views).forEach(v => v.classList.add("hidden"));

                // Get the view element
                const viewToShow = views[viewName];
                if (viewToShow) {
                    viewToShow.classList.remove("hidden");
                    // Execute view-specific initialization logic
                    if (viewName === 'dashboard') initDashboard();
                    if (viewName === 'admin') initAdmin();
                }

                // Update URL hash for Back button support
                if (updateHash) {
                    const hash = (viewName === 'home') ? '' : `#${viewName}`;
                    // Use pushState to manage history for navigation, but only if the hash changes
                    if (window.location.hash !== hash) {
                        history.pushState(null, '', hash);
                    }
                }

                // Scroll to top when switching views (unless it's a home-link anchor)
                if (!viewName.includes('home-link')) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };

            // --- Hash Routing Listener (Enables Browser Back Button) ---
            window.addEventListener('hashchange', () => {
                const hash = window.location.hash.replace('#', '');
                const viewName = hash || 'home';

                // Check if the hash corresponds to a valid view and load it without pushing state again
                if (views[viewName]) {
                    showView(viewName, false);
                } else {
                    // Default to home if hash is invalid
                    showView('home', true);
                }
            });


            // --- GLOBAL UI / AUTH MANAGEMENT (FIXED LOGIC) ---
            const updateHeaderUI = () => {
                const db = getDb();
                const user = db.currentUser;

                // Reset visibility of auth buttons
                [loginBtn, signupBtn, logoutBtn, dashboardLink, adminLink, welcomeMessage].forEach(el => el.classList.add("hidden"));
                welcomeMessage.textContent = "";

                if (user) {
                    // Logged In: Show user specific controls
                    logoutBtn.classList.remove("hidden");
                    dashboardLink.classList.remove("hidden");
                    welcomeMessage.classList.remove("hidden");
                    welcomeMessage.textContent = `Welcome, ${user.name}`;

                    if (user.type === 'admin') {
                        adminLink.classList.remove("hidden");
                    }
                } else {
                    // Logged Out: Show public controls
                    loginBtn.classList.remove("hidden");
                    signupBtn.classList.remove("hidden");
                }

                // Load the appropriate view based on current state
                const hash = window.location.hash.replace('#', '');
                let targetView = hash || 'home';

                if (user) {
                    // If logged in, prioritize dashboard/admin if the current hash is home or empty
                    if (targetView === 'home' || targetView === '') {
                        targetView = (user.type === 'admin') ? 'admin' : 'dashboard';
                    }
                }

                showView(targetView, false);
            };

            // --- Initial setup and navigation listeners ---
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
                const db = getDb();
                db.currentUser = null;
                saveDb(db);
                // Clear hash and reload UI, triggering default to home
                window.location.hash = '';
                updateHeaderUI();
            };

            // Initialize UI and view based on state
            updateHeaderUI();


            // --- MODAL LOGIC (for all pages) ---
            const modal = document.getElementById("authModal");
            const applicantsModal = document.getElementById("applicantsModal");
            const loginFormContainer = document.getElementById("login-form-container");
            const signupFormContainer = document.getElementById("signup-form-container");
            const otpFormContainer = document.getElementById("otp-form-container");
            const closeBtn = document.querySelector(".close-btn");

            const showForm = (formToShow) => {
                [loginFormContainer, signupFormContainer, otpFormContainer].forEach(
                    (f) => f.classList.add("hidden")
                );
                formToShow.classList.remove("hidden");
                modal.style.display = "block";
            };

            loginBtn.onclick = () => showForm(loginFormContainer);
            signupBtn.onclick = () => showForm(signupFormContainer);
            closeBtn.onclick = () => { modal.style.display = "none"; };
            // Close modal via window click only for auth modal
            window.onclick = (event) => {
                if (event.target == modal) modal.style.display = "none";
                if (event.target == applicantsModal) applicantsModal.style.display = "none";
            };

            document.getElementById("switch-form-link").onclick = (e) => {
                e.preventDefault();
                showForm(
                    signupFormContainer.classList.contains("hidden") ?
                    signupFormContainer :
                    loginFormContainer
                );
            };
            document.getElementById("switch-to-otp").onclick = (e) => {
                e.preventDefault();
                showForm(otpFormContainer);
            };

            // --- OPPORTUNITY CLICK (LOGIN GATE) ---
            document.querySelectorAll(".opportunity-link").forEach((link) => {
                link.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (getDb().currentUser) {
                        showView('dashboard');
                    } else {
                        showForm(loginFormContainer);
                    }
                });
            });

            // --- AUTH LOGIC (Signup, Login, OTP) ---
            document.getElementById("signupForm").addEventListener("submit", (e) => {
                e.preventDefault();
                const db = getDb();
                const email = document.getElementById("signupEmail").value;
                const userType = document.getElementById("userType").value;

                if (db.users.find((u) => u.email === email)) {
                    alert("User with this email already exists!");
                    return;
                }

                let subscriptionStatus = { active: false, plan: "none" };
                if (userType === 'employer') {
                    subscriptionStatus = { active: false, plan: "basic" };
                }

                const newUser = {
                    id: Date.now(),
                    name: document.getElementById("signupName").value,
                    email: email,
                    phone: document.getElementById("signupPhone").value,
                    type: userType,
                    skills: [],
                    education: "",
                    cvFileName: "",
                    subscription: subscriptionStatus,
                };

                if (email === "admin@hirehive.com") newUser.type = "admin";

                db.users.push(newUser);
                db.currentUser = newUser;
                saveDb(db);
                alert("Signup successful! Redirecting to dashboard...");
                modal.style.display = "none";
                updateHeaderUI();
            });

            document.getElementById("loginForm").addEventListener("submit", (e) => {
                e.preventDefault();
                const db = getDb();
                const user = db.users.find(
                    (u) => u.email === document.getElementById("loginEmail").value
                );
                if (user) {
                    db.currentUser = user;
                    saveDb(db);
                    alert("Login successful! Redirecting to dashboard...");
                    modal.style.display = "none";
                    updateHeaderUI();
                } else {
                    alert("User not found!");
                }
            });

            document.getElementById("otpForm").addEventListener("submit", (e) => {
                e.preventDefault();
                const db = getDb();
                const user = db.users.find(
                    (u) => u.phone === document.getElementById("otpPhone").value
                );
                if (user) {
                    const fakeOtp = prompt("We've 'sent' an OTP to your number. (Hint: It's 123456)");
                    if (fakeOtp === "123456") {
                        db.currentUser = user;
                        saveDb(db);
                        alert("Login successful!");
                        modal.style.display = "none";
                        updateHeaderUI();
                    } else {
                        alert("Invalid OTP!");
                    }
                } else {
                    alert("User with this phone number not found!");
                }
            });

            // --- SUBSCRIPTION LOGIC (For Employers) ---
            document.getElementById("upgradeToPremiumBtn").onclick = () => {
                const db = getDb();
                if (!db.currentUser || db.currentUser.type !== "employer") {
                    alert("Only Employers can upgrade their subscription.");
                    return;
                }

                setTimeout(() => {
                    alert("Payment successful! Your Premium Employer subscription is now active.");
                    const userIndex = db.users.findIndex((u) => u.id === db.currentUser.id);
                    db.users[userIndex].subscription = { active: true, plan: "premium" };
                    db.currentUser = db.users[userIndex];
                    saveDb(db);
                    showEmployerPostView(); // Reload post view to update status
                }, 1000);
            };

            // ==============================================
            // DASHBOARD LOGIC 
            // ==============================================
            function initDashboard() {
                const currentUser = getDb().currentUser;

                if (!currentUser || currentUser.type === 'admin') return;

                if (currentUser.type === "seeker") {
                    seekerDashboard.classList.remove("hidden");
                    employerDashboard.classList.add("hidden");
                    showSeekerJobView(); // Default to job view
                } else if (currentUser.type === "employer") {
                    employerDashboard.classList.remove("hidden");
                    seekerDashboard.classList.add("hidden");
                    // Default employer view to Post/Subscription view
                    showEmployerPostView();

                    // Add listeners for view switching
                    viewManagementBtn.onclick = showEmployerManagementView;
                    postNewJobBtn.onclick = showEmployerPostView;
                }
            }

            // --- SEEKER VIEW SWITCHERS ---
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
            backToJobsBtn.onclick = showSeekerJobView; // Now handles the back action

            // --- Job Filter Logic ---
            jobFilterBtns.forEach(btn => {
                btn.onclick = (e) => {
                    // Reset all buttons
                    jobFilterBtns.forEach(b => b.classList.remove('btn-primary'));
                    e.target.classList.add('btn-primary');

                    const filterType = e.target.dataset.filter;

                    jobViewSections.forEach(section => {
                        section.classList.add('hidden');
                    });

                    if (filterType === 'all') {
                        document.getElementById('all-jobs').classList.remove('hidden');
                        document.getElementById('shortlisted-jobs').classList.remove('hidden');
                    } else if (filterType === 'shortlisted') {
                        document.getElementById('shortlisted-jobs').classList.remove('hidden');
                    } else if (filterType === 'applied') {
                        document.getElementById('applied-jobs').classList.remove('hidden');
                    }
                };
            });

            function loadSeekerProfileForm() {
                const db = getDb();
                const currentUser = db.currentUser;
                document.getElementById("seeker-name").value = currentUser.name;
                document.getElementById("seeker-email").value = currentUser.email;
                document.getElementById("seeker-skills").value = currentUser.skills.join(", ");
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
                        alert(`Simulating download/view of CV: ${e.target.dataset.filename}. (In a real application, this would fetch the file from the server.)`);
                    };
                });


                document.getElementById("profile-form").onsubmit = (e) => {
                    e.preventDefault();
                    const db = getDb();
                    const userIndex = db.users.findIndex((u) => u.id === currentUser.id);
                    db.users[userIndex].name = document.getElementById("seeker-name").value;
                    db.users[userIndex].skills = document.getElementById("seeker-skills").value.split(",").map((s) => s.trim()).filter(Boolean);
                    db.users[userIndex].education = document.getElementById("seeker-education").value;

                    const cvFile = document.getElementById("cv-upload").files[0];
                    if (cvFile) {
                        db.users[userIndex].cvFileName = cvFile.name;
                    }

                    db.currentUser = db.users[userIndex];
                    saveDb(db);
                    alert("Profile updated!");
                    showSeekerJobView(); // Go back to job view after saving
                };
            }

            function loadJobs() {
                const db = getDb();
                const allJobsList = document.getElementById("all-jobs-list");
                const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");
                const appliedJobsList = document.getElementById("applied-jobs-list");

                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";

                const seekerSkills = db.currentUser.skills.map((s) => s.toLowerCase());

                db.jobs.forEach((job) => {
                            const hasApplied = db.applications.some(
                                (app) => app.jobId === job.id && app.seekerId === db.currentUser.id
                            );

                            // Shortlisted Logic: Job meets at least ONE of the seeker's skills
                            const isShortlisted = job.requiredSkills.map((s) => s.toLowerCase()).some((skill) => seekerSkills.includes(skill));

                            const isDisabled = hasApplied;
                            const applyButtonText = hasApplied ? "Applied" : "Apply Now";

                            const jobCardHTML = `
                <div class="job-card" data-job-id="${job.id}">
                    <h4>${job.title}</h4>
                    <p><i class="fas fa-map-marker-alt"></i> ${job.location} | <i class="fas fa-briefcase"></i> ${job.experience} | <i class="fas fa-money-bill-wave"></i> ${job.salary}</p>
                    <p>${job.description.substring(0, 100)}...</p>
                    <div class="skills">${job.requiredSkills.map((s) => `<span>${s}</span>`).join("")}</div>
                    <button class="btn apply-btn btn-primary" ${isDisabled ? "disabled" : ""}>
                        ${applyButtonText}
                    </button>
                </div>`;
            
            allJobsList.innerHTML += jobCardHTML;
            
            if (isShortlisted) shortlistedJobsList.innerHTML += jobCardHTML;
            if (hasApplied) appliedJobsList.innerHTML += jobCardHTML;
        });

        // Ensure applied/shortlisted lists show "No jobs" message if empty
        if (shortlistedJobsList.innerHTML === "") shortlistedJobsList.innerHTML = "<p>No jobs match your profile yet.</p>";
        if (appliedJobsList.innerHTML === "") appliedJobsList.innerHTML = "<p>You have not applied to any jobs yet.</p>";


        document.querySelectorAll(".apply-btn").forEach(
            (button) =>
                (button.onclick = (e) => {
                    const jobId = parseInt(e.target.closest(".job-card").dataset.jobId);
                    const db = getDb();
                    db.applications.push({
                        jobId,
                        seekerId: db.currentUser.id,
                        status: "applied",
                    });
                    saveDb(db);
                    
                    // Update UI immediately (reload jobs to update all views)
                    loadJobs();
                    alert("Application submitted!");
                })
        );
        
        // Ensure default view (All Jobs) is active on load
        // This is done once after loading jobs to set the default filter view
        const defaultFilterBtn = document.querySelector('.job-filter-btn[data-filter="all"]');
        if (!defaultFilterBtn.classList.contains('btn-primary')) {
            defaultFilterBtn.click();
        }
    }

    // --- EMPLOYER VIEW SWITCHERS ---
    function showEmployerPostView() {
        employerPostView.classList.remove("hidden");
        employerManagementView.classList.add("hidden");
        loadEmployerPostForm(); 
    }
    
    function showEmployerManagementView() {
        employerManagementView.classList.remove("hidden");
        employerPostView.classList.add("hidden");
        loadPostedJobs(); 
        document.getElementById("seeker-count").textContent = getDb().users.filter((u) => u.type === "seeker").length;
    }


    function loadEmployerPostForm() {
        const db = getDb();
        const currentUser = db.currentUser;
        
        const isPremium = currentUser.subscription.active;
        const currentJobs = getCurrentMonthJobCount(currentUser.id);
        const jobLimit = isPremium ? Infinity : 5;

        // Update Employer Subscription UI
        document.getElementById("employer-plan-title").textContent = isPremium ? "Premium Employer Plan" : "Basic Employer Plan";
        
        if (isPremium) {
            document.getElementById("employer-plan-limit").textContent = `Unlimited job posts active.`;
            document.getElementById("upgradeToPremiumBtn").classList.add("hidden");
        } else {
            document.getElementById("employer-plan-limit").textContent = `You have posted ${currentJobs} of ${jobLimit} jobs this month.`;
            document.getElementById("upgradeToPremiumBtn").classList.remove("hidden");
        }

        // --- Multi-Step Form Logic Setup ---
        let newJobData = {};

        const jobForms = {
            1: document.getElementById("jobStep1Form"),
            2: document.getElementById("jobStep2Form"),
            3: document.getElementById("jobStep3Form"),
        };

        const canPost = currentJobs < jobLimit || isPremium;
        
        // Disable post button/form if limit is reached
        if (!canPost) {
            postJobSubmitBtn.disabled = true;
            postJobSubmitBtn.textContent = "Limit Reached (Upgrade)";
        } else {
            postJobSubmitBtn.disabled = false;
            postJobSubmitBtn.textContent = "Post Job Now";
        }
        
        // Reset to Step 1 on load
        jobForms[1].classList.remove("hidden");
        jobForms[2].classList.add("hidden");
        jobForms[3].classList.add("hidden");
        
        document.querySelectorAll(".next-step-btn").forEach((button) => {
            button.onclick = () => {
                if (!canPost) {
                    alert("Your job posting limit has been reached. Please upgrade to the Premium Plan to post more jobs this month.");
                    return;
                }
                const currentStep = parseInt(button.dataset.step);
                const currentForm = jobForms[currentStep];

                if (!currentForm.checkValidity()) {
                    currentForm.reportValidity();
                    return;
                }

                if (currentStep === 1) {
                    newJobData.title = document.getElementById("job-title").value;
                    newJobData.category = document.getElementById("job-category").value;
                    newJobData.location = document.getElementById("job-location").value;
                } else if (currentStep === 2) {
                    newJobData.experience = document.getElementById("job-experience").value;
                    newJobData.salary = document.getElementById("job-salary").value;
                    newJobData.requiredSkills = document.getElementById("job-skills").value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
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

        document.getElementById("jobStep3Form").onsubmit = (e) => {
            e.preventDefault();

            if (!canPost) {
                 alert("Your job posting limit has been reached. Please upgrade to the Premium Plan.");
                 return;
            }

            newJobData.noticePeriod = document.getElementById("job-notice-period").value;
            newJobData.description = document.getElementById("job-description").value;

            const finalJob = {
                id: Date.now(),
                postedDate: new Date().toISOString(),
                employerId: currentUser.id,
                ...newJobData,
            };

            const db = getDb();
            db.jobs.push(finalJob);
            saveDb(db);
            alert("Job posted successfully! Redirecting to management view.");

            e.target.reset();
            
            showEmployerManagementView(); 
        };
    }

    function loadPostedJobs() {
        const db = getDb();
        const postedJobsList = document.getElementById("posted-jobs-list");
        postedJobsList.innerHTML = "";
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const myRecentJobs = db.jobs.filter(
            (job) => job.employerId === db.currentUser.id && new Date(job.postedDate) > sevenDaysAgo
        );

        if (myRecentJobs.length === 0) {
            postedJobsList.innerHTML = "<p>You have no jobs posted in the last 7 days.</p>";
            return;
        }
        
        myRecentJobs.forEach((job) => {
            const applicantCount = db.applications.filter((app) => app.jobId === job.id).length;
            postedJobsList.innerHTML += `<div class="job-card"><h4>${job.title}</h4><p>Applicants: ${applicantCount}</p><button class="btn btn-primary view-applicants-btn" data-job-id="${job.id}">View Applicants</button></div>`;
        });
        
        document.querySelectorAll(".view-applicants-btn").forEach(
            (button) =>
                (button.onclick = (e) =>
                    showApplicantsModal(parseInt(e.target.dataset.jobId)))
        );
    }

    // --- RENDER APPLICANTS IN TABLE FORMAT ---
    function showApplicantsModal(jobId) {
        const db = getDb();
        const job = db.jobs.find((j) => j.id === jobId);
        const applicants = db.applications
            .filter((app) => app.jobId === jobId)
            .map((app) => db.users.find((u) => u.id === app.seekerId));
        
        const listElement = document.getElementById("applicants-list");
        document.getElementById("applicants-job-title").textContent = job.title;
        
        if (applicants.length === 0) {
            listElement.innerHTML = "<p>No applicants yet.</p>";
        } else {
            const tableRows = applicants.map(app => `
                <tr>
                    <td>${app.name}</td>
                    <td>${app.email}</td>
                    <td>${app.phone || 'N/A'}</td>
                    <td>${app.skills.join(", ") || 'N/A'}</td>
                    <td>${app.education || 'N/A'}</td>
                    <td>
                        ${app.cvFileName 
                            ? `<a href="#" class="cv-link" data-filename="${app.cvFileName}">${app.cvFileName}</a>`
                            : 'N/A'}
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
                                <th>Education</th>
                                <th>CV</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Re-attach CV link handlers
             listElement.querySelectorAll('.cv-link').forEach(link => {
                link.onclick = (e) => {
                    e.preventDefault();
                    // Simulate file access/download
                    alert(`Simulating secure CV download/view for: ${e.target.dataset.filename}. (In a real application, this would fetch the file from the server.)`);
                };
            });
        }
            
        applicantsModal.style.display = "block";
        document.getElementById("close-applicants-modal").onclick = () => {
            applicantsModal.style.display = "none";
        };
    }

    // ==============================================
    // ADMIN LOGIC (initAdmin)
    // ==============================================
    function initAdmin() {
        const db = getDb();
        
        if (!db.currentUser || db.currentUser.type !== 'admin') {
            updateHeaderUI();
            return;
        }
        
        document.getElementById("total-seekers").textContent = db.users.filter((u) => u.type === "seeker").length;
        document.getElementById("total-employers").textContent = db.users.filter((u) => u.type === "employer").length;
        document.getElementById("total-jobs").textContent = db.jobs.length;
        document.getElementById("total-subscriptions").textContent = db.users.filter((u) => u.subscription.active).length; 

        // Load Seekers List
        const seekersListContainer = document.getElementById("job-seekers-list");
        const seekers = db.users.filter((u) => u.type === "seeker");
        if (seekers.length > 0) {
            seekersListContainer.innerHTML = `<ul>${seekers.map(
                (seeker) => `<li>${seeker.name} (${seeker.email}) - <a href="#" class="view-profile" data-userid="${seeker.id}">View Profile</a></li>`
            ).join("")}</ul>`;
        } else {
            seekersListContainer.innerHTML = "<p>No job seekers have registered yet.</p>";
        }

        // Load Employers List
        const employersListContainer = document.getElementById("employer-profiles-list");
        const employers = db.users.filter((u) => u.type === "employer");
        if (employers.length > 0) {
            employersListContainer.innerHTML = `<ul>${employers.map(
                (employer) => `<li>${employer.name} (${employer.email}) - <a href="#" class="view-profile" data-userid="${employer.id}">View Details</a></li>`
            ).join("")}</ul>`;
        } else {
            employersListContainer.innerHTML = "<p>No employers have registered yet.</p>";
        }

        // Add event listeners for View Profile links
        document.querySelectorAll(".view-profile").forEach(
            (link) =>
                (link.onclick = (e) => {
                    e.preventDefault();
                    const userProfile = db.users.find((u) => u.id === parseInt(e.target.dataset.userid));
                    alert(
                        `${userProfile.type.toUpperCase()} Profile:\nName: ${userProfile.name}\nEmail: ${userProfile.email}\nPhone: ${userProfile.phone || "N/A"}\nPlan: ${userProfile.subscription.active ? 'Premium' : 'Basic'}\nSkills: ${userProfile.skills.join(", ") || 'N/A'}\nCV: ${userProfile.cvFileName || 'N/A'}`
                    );
                })
        );
    }
});