// --- Frontend: app.js (FINAL CODE WITH CHATBOT AND FORGOT PASSWORD) ---
document.addEventListener("DOMContentLoaded", () => {       // ------------------------------------------------------------------
                   // 1. GLOBAL CONFIGURATION & API HELPERS
                   // ------------------------------------------------------------------
                   const BASE_URL = "https://hirehive-api.onrender.com/api";

                   // Reusable token and user storage helpers (using localStorage for token, sessionStorage for user cache)
                   const getToken = () => localStorage.getItem("hirehiveToken");       const setToken = (token) => localStorage.setItem("hirehiveToken", token);       const removeToken = () => localStorage.removeItem("hirehiveToken");

                   const getLocalUser = () => JSON.parse(sessionStorage.getItem("localUser"));       const setLocalUser = (user) => {         if (user) {           sessionStorage.setItem("localUser", JSON.stringify(user));         } else {           sessionStorage.removeItem("localUser");         }       };

                   const statusMessageModal = document.getElementById("statusMessageModal");      
            document.querySelectorAll('.status-close-btn').forEach(btn => {         btn.onclick = () => { statusMessageModal.style.display = 'none'; };       });

                   const showStatusMessage = (title, body, isError = false) => {         document.getElementById("statusMessageTitle").textContent = title;        
                document.getElementById("statusMessageBody").textContent = body;         if (isError) {           document.getElementById("statusMessageTitle").style.color = 'var(--danger-color)';         } else {           document.getElementById("statusMessageTitle").style.color = 'var(--secondary-color)';         }        
                statusMessageModal.style.display = 'block';       };

                   // --- Custom Confirmation/Prompt Modals ---
                   const confirmationModal = document.getElementById("confirmationModal");       const confirmTitleEl = document.getElementById("confirmTitle");       const confirmBodyEl = document.getElementById("confirmBody");       const confirmInputEl = document.getElementById("confirmInput");       const confirmOKBtn = document.getElementById("confirmOKBtn");       const confirmCancelBtn = document.getElementById("confirmCancelBtn");

                   const showConfirmation = (title, body, isPrompt = false, okText = 'OK') => {         return new Promise((resolve) => {           confirmTitleEl.textContent = title;          
                    confirmBodyEl.textContent = body;          
                    confirmInputEl.classList.toggle('hidden', !isPrompt);          
                    confirmInputEl.value = '';          
                    confirmOKBtn.textContent = isPrompt ? 'Submit' : okText;          
                    confirmCancelBtn.textContent = isPrompt ? 'Cancel Application' : 'Cancel';          
                    confirmationModal.style.display = 'block';

                               const cleanup = (result) => {             confirmationModal.style.display = 'none';            
                        confirmOKBtn.onclick = null;            
                        confirmCancelBtn.onclick = null;            
                        resolve(result);           };

                              
                    confirmOKBtn.onclick = () => {             cleanup(isPrompt ? confirmInputEl.value.trim() : true);           };

                              
                    confirmCancelBtn.onclick = () => {             cleanup(isPrompt ? null : false);           };         });       };

                   // --- Subscription Plan Limits & Details ---
                   const HIVE_PLANS = {         'buzz': {           name: "Buzz Plan",           limit: 2,           icon: "fas fa-bug",           color: "#28a745",           price: "Free",           description: "Post 2 free job listing. Access to limited candidate applications (up to 30 resumes). Basic employer dashboard access. Email notifications for job applicants. Standard listing visibility for 7 days. Community support via email."         },          'worker': {           name: "Worker Plan",           limit: 5,           icon: "fas fa-user-tie",           color: "#007bff",           price: "₹1,999 / month",           description: "Post up to 5 active jobs. Access to 50 candidate resumes. Basic resume search filters (location, experience). Branded company profile page. Job promotion on HireHive social channels. 15-day visibility on job board. Email & chat support."         },          'colony': {           name: "Colony Plan",           limit: 15,           icon: "fas fa-industry",           color: "#fd7e14",           price: "₹4,999 / month",           description: "Post up to 15 active jobs. Access to unlimited resume downloads. Advanced candidate filtering (skills, education, salary range). Access to 'Featured Candidates' pool. Company logo on all job posts. Weekly job performance analytics. Priority placement in search results. Dedicated account manager (email only)."         },          'queen': {           name: "Queen Plan",           limit: 30,           icon: "fas fa-crown",           color: "#6f42c1",           price: "₹8,999 / month",           description: "Post up to 30 active jobs. Access to premium candidate database. AI-powered candidate recommendations. Smart applicant tracking system (ATS) dashboard. Job posts featured on partner platforms (LinkedIn, Indeed sync optional). Video interview scheduling feature. Custom career page integration (for your website). Dedicated account manager (chat & call support)."         },          'hive_master': {           name: "Hive Master Plan",           limit: Infinity,           icon: "fas fa-trophy",           color: "#dc3545",           price: "₹14,999 / month",           description: "Unlimited job postings. Full candidate database access with export/download. AI-based shortlisting & skill-matching automation. Team sub-accounts (multi-user login for HR teams). Monthly performance & hiring analytics report. Priority listing on home page & social promotions. API access for job posting integration. 24x7 premium support (call, chat & WhatsApp). Access to future beta tools (AI Resume Scoring, Auto Interview Bot)."         },        };

                  
            async function fetchApi(endpoint, method = 'GET', data = null, isFormData = false) {         const token = getToken();         const url = `${BASE_URL}/${endpoint}`;         const headers = {};         if (token) {           headers['Authorization'] = `Bearer ${token}`;         }         const config = { method, headers };         if (data) {           if (isFormData) {             config.body = data;           } else {             headers['Content-Type'] = 'application/json';            
                        config.body = JSON.stringify(data);           }         }         try {           const response = await fetch(url, config);           const contentType = response.headers.get("content-type");           if (contentType && contentType.includes("application/json")) {             const responseData = await response.json();             if (!response.ok) {               const errorMessage = responseData.error || `Request failed with status ${response.status}`;               throw new Error(errorMessage);             }             return responseData;           } else if (!response.ok) {             const errorText = await response.text();            
                        console.error(`Backend Error (${response.status}):`, errorText);             throw new Error(`Server returned status ${response.status}. Please check backend logs.`);           }           return {};         } catch (error) {           console.error("Fetch API Error:", error);           throw error;         }       }

                   const setLoading = (buttonId, isLoading, defaultText = 'Submit') => {         const btn = document.getElementById(buttonId);         if (!btn) return;         if (isLoading) {           btn.disabled = true;          
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';         } else {           btn.disabled = false;          
                    btn.textContent = defaultText;         }       };

                   // ------------------------------------------------------------------
                   // 2. DOM ELEMENTS & SPA ROUTER
                   // ------------------------------------------------------------------
                   const views = {         'home': document.getElementById("home-view"),          'dashboard': document.getElementById("dashboard-view"),          'admin': document.getElementById("admin-view"),          'about': document.getElementById("about-view"),          'contact': document.getElementById("contact-view"),          'career-growth': document.getElementById("career-growth-view"),          'plans': document.getElementById("plans-view"),        };

                   const dashboardLink = document.getElementById("dashboardLink");       const adminLink = document.getElementById("adminLink");       const loginBtn = document.getElementById("loginBtn");       const signupBtn = document.getElementById("signupBtn");       const logoutBtn = document.getElementById("logoutBtn");       const welcomeMessage = document.getElementById("welcome-message");       const menuToggle = document.getElementById('menuToggle');       const navLinks = document.getElementById('navLinks');       const employerDashboard = document.getElementById("employer-dashboard");       const googleLoginBtn = document.getElementById("googleLoginBtn");       const appMainContent = document.getElementById('app-main-content');

                   // NEW GUIDE ELEMENTS
                   const guideModal = document.getElementById('guideModal');       const guideTitle = document.getElementById('guideTitle');       const guideBody = document.getElementById('guideBody');       const guideNextBtn = document.getElementById('guideNextBtn');       const guideCloseBtns = document.querySelectorAll('.guide-close-btn');

                   // --- Balloon/Confetti Burst Helper ---
                   const triggerSuccessEffect = () => {         const colors = ['#ffc107', '#007bff', '#dc3545', '#28a745', '#ffffff'];         const container = document.createElement('div');        
                container.id = 'success-effect-container';        
                document.body.appendChild(container);

                         for (let i = 0; i < 50; i++) {           const confetti = document.createElement('div');          
                    confetti.style.width = '10px';          
                    confetti.style.height = '10px';          
                    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];          
                    confetti.style.position = 'absolute';          
                    confetti.style.left = `${Math.random() * 100}vw`;          
                    confetti.style.top = `${-10 - Math.random() * 20}vh`;          
                    confetti.style.opacity = 1;          
                    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

                              
                    confetti.animate([            { transform: `translateY(0) rotate(0deg)`, opacity: 1 },              { transform: `translateY(${window.innerHeight * 1.5}px) rotate(720deg)`, opacity: 0.1 }          ], {             duration: 2500 + Math.random() * 1000,             easing: 'ease-in-out',             delay: Math.random() * 500           });

                              
                    container.appendChild(confetti);         }

                        
                setTimeout(() => {           container.remove();         }, 4000);       };

                   // --- Guide System Logic ---
                   const GUIDE_STEPS = (role) => {         if (role === 'employer') {           return [            { title: "Welcome, New Employer! 🎉", body: "We're excited to have you! Your next step is managing your job postings. Click 'Next Tip' to see your new Dashboard." },              { title: "Post a Job", body: "Use the **'Post Job'** tab to easily list new openings. Remember to check your **Hive Plan** limits!" },              { title: "Manage Applicants", body: "The **'Manage Posted Jobs'** tab lets you track applications, view seeker profiles, and shortlist candidates." },           ];         }         return [ // Seeker flow
                              { title: "Welcome to the Hive! 🐝", body: "Your career journey starts here! First, let's complete your profile for the best job matching." },            { title: "Complete Your Profile", body: "Click **'Edit Profile'** to add your skills, education, and upload your CV. A complete profile gets noticed faster!" },            { title: "Search & Apply", body: "Use the search bar or domain links to find jobs. Your skill-matched opportunities will appear under **Shortlisted Jobs**." }        
                ];       };

                   let currentGuideStep = 0;       let guideFlow = [];

                   const showGuidePopup = (userRole) => {         guideFlow = GUIDE_STEPS(userRole);        
                currentGuideStep = 0;        
                showNextGuideStep();       };

                   const showNextGuideStep = () => {         if (currentGuideStep < guideFlow.length) {           const step = guideFlow[currentGuideStep];          
                    guideTitle.textContent = step.title;          
                    guideBody.innerHTML = step.body;          
                    guideModal.style.display = 'block';

                              
                    guideNextBtn.textContent = (currentGuideStep === guideFlow.length - 1) ? 'Start Exploring!' : 'Next Tip';          
                    currentGuideStep++;         } else {           guideModal.style.display = 'none';         }       };

                  
            guideNextBtn.onclick = showNextGuideStep;      
            guideCloseBtns.forEach(btn => btn.onclick = () => { guideModal.style.display = 'none'; });       // END Guide System Logic


                   // Initialize Mobile Menu Toggle (remains the same)
                   if (menuToggle && navLinks) {         menuToggle.addEventListener('click', () => {           navLinks.classList.toggle('active');         });        
                navLinks.querySelectorAll('a').forEach(link => {           link.addEventListener('click', () => {             if (navLinks.classList.contains('active')) {               navLinks.classList.remove('active');             }           });         });       }

                   // 💡 NEW FIX: Close Navbar Menu when clicking outside (on main content area)
                   if (appMainContent && navLinks) {         appMainContent.addEventListener('click', (event) => {           if (window.innerWidth < 992 && navLinks.classList.contains('active')) {             if (!navLinks.contains(event.target) && event.target !== menuToggle && !menuToggle.contains(event.target)) {               navLinks.classList.remove('active');             }           }         });       }


                  
            async function updateHeaderUI() {         let user = getLocalUser();         const token = getToken();        
                [loginBtn, signupBtn, logoutBtn, dashboardLink, adminLink, welcomeMessage].forEach(el => el.classList.add("hidden"));        
                welcomeMessage.textContent = "";

                         if (token) {           if (!user) {             try {               const data = await fetchApi('auth/me', 'GET');              
                            user = data.user;              
                            setLocalUser(user);             } catch (e) {               console.warn("Token expired or invalid. Logging out.", e.message);              
                            removeToken();              
                            setLocalUser(null);              
                            window.location.hash = '';              
                            updateHeaderUI();               return;             }           }          
                    logoutBtn.classList.remove("hidden");          
                    dashboardLink.classList.remove("hidden");          
                    welcomeMessage.classList.remove("hidden");          
                    welcomeMessage.textContent = `Welcome, ${user.name.split(' ')[0]}`;           if (user.role === 'admin') {             adminLink.classList.remove("hidden");           }         } else {           loginBtn.classList.remove("hidden");          
                    signupBtn.classList.remove("hidden");           if (window.location.hash.includes('google_token=') || window.location.hash.includes('error=')) {             handleGoogleAuthCallback();           }         }

                         const hash = window.location.hash.replace('#', '');         let targetView = hash || 'home';         if (token && user && (targetView === 'home' || targetView === '')) {           targetView = (user.role === 'admin') ? 'admin' : 'dashboard';         } else if (!token && (targetView === 'dashboard' || targetView === 'admin')) {           targetView = 'home';         }

                        
                showView(targetView, false, null);       }

                   const showView = (viewName, updateHash = true, filters = null) => {         Object.values(views).forEach(v => v.classList.add("hidden"));         let viewToShow = views[viewName];

                         if (!viewToShow) {           viewToShow = views['home'];          
                    viewName = 'home';         }

                        
                viewToShow.classList.remove("hidden");

                         if (viewName === 'dashboard') initDashboard(filters);         if (viewName === 'admin') initAdmin();

                         if (viewName === 'plans') loadPlansView(); // NEW: Load Plans View

                         if (updateHash) {           const hash = (viewName === 'home') ? '' : `#${viewName}`;           if (window.location.hash !== hash) {             history.pushState(null, '', hash);           }         }

                         if (!viewName.includes('home-link')) {           window.scrollTo({ top: 0, behavior: 'smooth' });         }       };

                  
            window.addEventListener('hashchange', () => {         const hash = window.location.hash.replace('#', '');         const viewName = hash || 'home';        
                updateHeaderUI(); // Re-run header update on hashchange to re-route authenticated users
                       });

                  
            document.querySelectorAll('[data-view]').forEach(el => {         el.addEventListener('click', (e) => {           const viewName = e.currentTarget.dataset.view;           if (viewName === 'home-link') {             showView('home');            
                        setTimeout(() => {               const targetEl = document.getElementById(e.currentTarget.getAttribute('href').substring(1));               if (targetEl) {                 targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });               }             }, 10);           } else {             showView(viewName);           }         });       });

                  
            logoutBtn.onclick = () => {         removeToken();        
                setLocalUser(null);        
                window.location.hash = '';        
                updateHeaderUI();       };

                  
            updateHeaderUI();

                  
            document.querySelectorAll(".opportunity-link").forEach((link) => {         link.addEventListener('click', (e) => {           e.preventDefault();           const category = e.currentTarget.querySelector('span').textContent.trim();           const currentUser = getLocalUser();

                               // 💡 FIX 1: Check if the user is NOT logged in FIRST.
                               if (!currentUser) {             showStatusMessage("Login Required", "Please log in as a Job Seeker to view and search jobs.", false);            
                        showView('home');            
                        showForm(loginFormContainer);             return;           }

                               // If logged in, route them to their dashboard with filters, regardless of role.
                               // If they are an employer, initDashboard handles routing them to the employer view.
                               const filters = { category: category };          
                    showView('dashboard', true, filters);         });       });


                   // ------------------------------------------------------------------
                   // 3. AUTH & MODAL LOGIC (PASSWORD RESET & CLOSURE FIX)
                   // ------------------------------------------------------------------
                   const authModal = document.getElementById("authModal");       const loginFormContainer = document.getElementById("login-form-container");       const signupFormContainer = document.getElementById("signup-form-container");       const forgotFormContainer = document.getElementById("forgot-form-container");       const otpFormContainer = document.getElementById("otp-form-container");       const closeAuthBtn = document.querySelector("#authModal .close-btn");       const applicantsModal = document.getElementById("applicantsModal");       const subscriptionModal = document.getElementById("subscriptionModal");       const closeApplicantsModalBtn = document.getElementById("close-applicants-modal");       const userTypeSelect = document.getElementById("userType");       const companyNameInput = document.getElementById("signupCompanyName");       const switchFormLink = document.getElementById("switch-form-link");       const forgotPasswordLink = document.getElementById("forgotPasswordLink");       const backToLoginLink = document.getElementById("backToLoginLink");


                   const showForm = (formToShow) => {        
                [loginFormContainer, signupFormContainer, forgotFormContainer, otpFormContainer].forEach((f) => f ? f.classList.add("hidden") : null);        
                formToShow.classList.remove("hidden");        
                authModal.style.display = "block";

                         // Handle switch/forgot links visibility
                         if (formToShow === loginFormContainer || formToShow === signupFormContainer) {           if (switchFormLink) {             switchFormLink.style.display = 'block';             const isLogin = formToShow === loginFormContainer;            
                        switchFormLink.textContent = isLogin ? "Need an account? Sign Up" : "Already have an account? Log In";           }           if (forgotPasswordLink) forgotPasswordLink.style.display = (formToShow === loginFormContainer) ? 'block' : 'none';         } else {           if (switchFormLink) switchFormLink.style.display = 'none';           if (forgotPasswordLink) forgotPasswordLink.style.display = 'none';         }

                         if (formToShow === signupFormContainer) {           userTypeSelect.value = 'seeker';          
                    companyNameInput.classList.add('hidden');          
                    companyNameInput.required = false;         }       };       if (loginBtn) { loginBtn.onclick = () => showForm(loginFormContainer); }       if (signupBtn) { signupBtn.onclick = () => showForm(signupFormContainer); }       if (closeAuthBtn) { closeAuthBtn.onclick = () => { authModal.style.display = "none"; }; }       if (closeApplicantsModalBtn) { closeApplicantsModalBtn.onclick = () => { applicantsModal.style.display = "none"; }; }

                   // Navigation for Forgot Password
                   if (forgotPasswordLink) { forgotPasswordLink.onclick = (e) => { e.preventDefault();          
                    showForm(forgotFormContainer); }; }       if (backToLoginLink) { backToLoginLink.onclick = (e) => { e.preventDefault();          
                    showForm(loginFormContainer); }; }


                   // Global modal close logic (remains the same)
                  
            window.onclick = (event) => {         if (event.target == authModal) authModal.style.display = "none";         if (event.target == applicantsModal) applicantsModal.style.display = "none";         if (event.target == subscriptionModal) subscriptionModal.style.display = "none";         if (event.target == statusMessageModal) statusMessageModal.style.display = "none";         if (event.target == confirmationModal) confirmationModal.style.display = "none";

                         // Chatbot specific global click logic
                         if (chatWindow && !chatWindow.classList.contains('hidden') &&           !chatWindow.contains(event.target) && event.target !== chatBtn && !chatBtn.contains(event.target)) {           // No action here, close behavior managed by chatCloseBtn
                            }       };

                   // Switch links logic (remains the same)
                   if (switchFormLink) {         switchFormLink.addEventListener('click', (e) => {           e.preventDefault();           const formContainer = signupFormContainer.classList.contains("hidden") ? signupFormContainer : loginFormContainer;          
                    showForm(formContainer);         });       }

                   if (userTypeSelect) {         userTypeSelect.addEventListener('change', () => {           if (userTypeSelect.value === 'employer') {             companyNameInput.classList.remove('hidden');            
                        companyNameInput.required = true;           } else {             companyNameInput.classList.add('hidden');            
                        companyNameInput.required = false;           }         });       }

                   // Forgot Password Submission Logic
                   if (document.getElementById("forgotPasswordForm")) {         document.getElementById("forgotPasswordForm").addEventListener("submit", async(e) => {           e.preventDefault();          
                    setLoading('submitResetBtn', true, 'Send Reset Link');           const email = document.getElementById("resetEmail").value;           try {             const data = await fetchApi('auth/forgot-password', 'POST', { email });

                                    
                        authModal.style.display = "none";            
                        showStatusMessage("Reset Link Sent", data.message, false);            
                        document.getElementById("forgotPasswordForm").reset();

                                   } catch (error) {             authModal.style.display = "none";            
                        showStatusMessage("Reset Failed", error.message, true);           } finally {             setLoading('submitResetBtn', false, 'Send Reset Link');           }         });       }


                   // Auth Submission Logic (FIXED for better error handling)
                  
            document.getElementById("signupForm").addEventListener("submit", async(e) => {         e.preventDefault();        
                setLoading('submitSignupBtn', true, 'Sign Up');         const name = document.getElementById("signupName").value;         const email = document.getElementById("signupEmail").value;         const password = document.getElementById("signupPassword").value;         const phone = document.getElementById("signupPhone").value;         const role = userTypeSelect.value;         const companyName = companyNameInput.value;         const signupData = { name, email, password, role, phone };         if (role === 'employer') {           signupData.companyName = companyName;         }         try {           const data = await fetchApi('auth/signup', 'POST', signupData);          
                    setToken(data.token);          
                    setLocalUser(data.user);

                              
                    authModal.style.display = "none"; // <<-- FIX: Close Auth Modal on success

                              
                    document.getElementById("signupForm").reset();          
                    updateHeaderUI();

                              
                    triggerSuccessEffect(); // 🎉 Balloon Burst on Signup Success
                              
                    showGuidePopup(data.user.role); // 💡 Start Guide for new users

                             } catch (error) {           console.error("Signup failed:", error.message);          
                    authModal.style.display = "none"; // <<-- FIX: Close Auth Modal on failure
                               if (error.message.includes('already exists')) {             showStatusMessage("Account Exists", "A user with this email already exists. Please log in.", true);            
                        showForm(loginFormContainer);           } else {             showStatusMessage("Registration Failed", error.message, true);           }         } finally {           setLoading('submitSignupBtn', false, 'Sign Up');         }       });

                  
            document.getElementById("loginForm").addEventListener("submit", async(e) => {         e.preventDefault();        
                setLoading('submitLoginBtn', true, 'Login');         const email = document.getElementById("loginEmail").value;         const password = document.getElementById("loginPassword").value;         try {           const data = await fetchApi('auth/login', 'POST', { email, password });          
                    setToken(data.token);          
                    setLocalUser(data.user);

                              
                    authModal.style.display = "none"; // <<-- FIX: Close Auth Modal on success

                              
                    document.getElementById("loginForm").reset();          
                    updateHeaderUI();

                              
                    triggerSuccessEffect(); // 🎉 Balloon Burst on Login Success

                             } catch (error) {           console.error("Login failed:", error.message);          
                    authModal.style.display = "none"; // <<-- FIX: Close Auth Modal on failure
                              
                    showStatusMessage("Login Failed", error.message.includes('credentials') ? error.message : "Invalid email or password. Please try again.", true);         } finally {           setLoading('submitLoginBtn', false, 'Login');         }       });


                   // ------------------------------------------------------------------
                   // NEW: GOOGLE OAUTH FLOW HANDLER (remains robust)
                   // ------------------------------------------------------------------
                   if (googleLoginBtn) {         googleLoginBtn.addEventListener('click', () => {           // Note: Auth modal closes when redirecting to Google, so no manual closure needed here.
                               window.location.href = `${BASE_URL}/auth/google/login`;         });       }

                  
            async function handleGoogleAuthCallback() {         const hash = window.location.hash;         const urlParams = new URLSearchParams(hash.substring(1));         const token = urlParams.get('google_token');         const error = urlParams.get('error');

                        
                history.pushState("", document.title, window.location.pathname + window.location.search);

                         if (error) {           authModal.style.display = "none"; // <<-- FIX: Close Auth Modal after callback failure
                              
                    showStatusMessage("Google Sign-In Failed", `Authentication was cancelled or failed. Error: ${error}`, true);           return;         }

                         if (token) {           setToken(token);           try {             const userData = await fetchApi('auth/me', 'GET');            
                        setLocalUser(userData.user);            
                        updateHeaderUI();            
                        authModal.style.display = "none"; // <<-- FIX: Close Auth Modal after successful user fetch
                                    
                        triggerSuccessEffect(); // 🎉 Balloon Burst on Google Login Success
                                   } catch (e) {             removeToken();            
                        authModal.style.display = "none"; // <<-- FIX: Close Auth Modal after token/user failure
                                    
                        showStatusMessage("Sign In Error", "Could not retrieve user data after Google authentication.", true);           }         }       }       // ------------------------------------------------------------------


                   // ------------------------------------------------------------------
                   // 4. CONTACT FORM LOGIC 
                   // ------------------------------------------------------------------
                   const contactForm = document.querySelector(".contact-form");       if (contactForm) {         contactForm.addEventListener('submit', async(e) => {           e.preventDefault();          
                    setLoading('contactSubmitBtn', true, 'Send Message');           const name = document.getElementById("contact-name").value;           const email = document.getElementById("contact-email").value;           const message = document.getElementById("contact-message").value;           try {             await fetchApi('contact', 'POST', { name, email, message });            
                        showStatusMessage("Message Sent!", "Thank you for contacting HireHive. We will get back to you shortly.", false);            
                        contactForm.reset();           } catch (error) {             console.error("Contact form submission failed:", error.message);            
                        showStatusMessage("Submission Failed", error.message, true);           } finally {             setLoading('contactSubmitBtn', false, 'Send Message');           }         });       }

                   // ------------------------------------------------------------------
                   // 5. SUBSCRIPTION LOGIC & PLANS VIEW
                   // ------------------------------------------------------------------
                   const loadPlansView = () => {         const staticPlanDisplay = document.getElementById("static-plan-display");         if (!staticPlanDisplay) return;

                        
                staticPlanDisplay.innerHTML = '';         const user = getLocalUser();         const isEmployer = user && user.role === 'employer';         const currentPlanKey = user ? (user.subscriptionstatus || 'buzz') : 'none';

                         for (const [key, plan] of Object.entries(HIVE_PLANS)) {           const isCurrent = currentPlanKey === key;           const priceText = plan.price;           const buttonText = isCurrent ? 'Current Plan' : isEmployer ? 'Select Plan (Demo)' : 'Sign Up to Select';           const buttonClass = isCurrent ? 'btn-secondary disabled' : 'btn-primary';           const priceColor = key === 'buzz' ? plan.color : '#333';

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
                    staticPlanDisplay.appendChild(planCard);         }

                         // Attach modal functionality to select buttons on the main page
                        
                document.querySelectorAll('#plans-view .select-plan-btn').forEach(btn => {           if (isEmployer && !btn.disabled) {             btn.addEventListener('click', () => {               // Trigger modal with simulation message
                                           showStatusMessage("Subscription Simulation", `You are simulating the purchase of the ${HIVE_PLANS[btn.dataset.planKey].name}. Click 'Select Plan' in the dashboard to confirm the plan change.`, false);             });           } else if (!user) {             btn.addEventListener('click', () => {               showForm(signupFormContainer);             });           }         });       };             const showSubscriptionModal = () => {         const user = getLocalUser();         if (!user || user.role !== 'employer') return;         const modalContent = document.querySelector("#subscriptionModal .modal-content");         const currentPlanKey = user.subscriptionstatus || 'buzz';         const isEmployer = user.role === 'employer';

                         let planCardsHTML = `<span class="close-btn" id="close-subscription-modal">&times;</span><h2 style="margin-bottom: 1rem;">Choose Your Hive Plan</h2><p>Your Current Plan: <strong style="color: ${HIVE_PLANS[currentPlanKey].color}">${HIVE_PLANS[currentPlanKey].name}</strong></p><div class="plans-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1.5rem;">`;

                         for (const [key, plan] of Object.entries(HIVE_PLANS)) {           const isCurrent = currentPlanKey === key;           const priceText = plan.price;           const buttonClass = isCurrent ? 'btn-secondary disabled' : 'btn-primary';           const buttonText = isCurrent ? 'Current Plan' : 'Select Plan (Demo)';           const priceColor = key === 'buzz' ? plan.color : '#333';

                              
                    planCardsHTML += `
                <div class="subscription-card" style="border: 2px solid ${isCurrent ? plan.color : '#ccc'}; padding: 1rem; border-radius: 8px; text-align: center;">
                    <h3 style="color:${plan.color}; font-size:1.3rem;"><i class="${plan.icon}"></i> ${plan.name}</h3>
                    <p style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem; color: ${priceColor};">${priceText}</p>
                    <p style="font-size: 0.8rem; margin-bottom: 1rem; color: #666; height: 100px; overflow-y: hidden;">${plan.description.split('. ').join('.<br/>')}</p>
                    <button class="btn ${buttonClass} select-plan-btn" data-plan-key="${key}" ${isCurrent || !isEmployer ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            `;         }        
                planCardsHTML += `</div>`;        
                modalContent.innerHTML = planCardsHTML;

                        
                document.getElementById("close-subscription-modal").onclick = () => { subscriptionModal.style.display = "none"; };

                        
                modalContent.querySelectorAll('.select-plan-btn').forEach(btn => {           if (isEmployer && !btn.disabled) {             btn.addEventListener('click', async(e) => {               const planKey = e.currentTarget.dataset.planKey;               const selectedPlan = HIVE_PLANS[planKey];               const btnElement = e.currentTarget;               const originalText = btnElement.textContent;

                                          
                            btnElement.disabled = true;              
                            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                                           try {                 const data = await fetchApi('employer/subscription', 'PUT', { newPlanKey: planKey });                
                                setLocalUser(data.user);                
                                switchEmployerView("employer-management-view");                
                                showStatusMessage("Plan Updated", `${selectedPlan.name} is now your active plan.`, false);                
                                subscriptionModal.style.display = "none";                
                                initDashboard(null);               } catch (error) {                 showStatusMessage("Plan Update Failed", error.message, true);                
                                btnElement.disabled = false;                
                                btnElement.innerHTML = originalText;               }             });           }         });        
                subscriptionModal.style.display = "block";       };      
            window.showSubscriptionModal = showSubscriptionModal;

                   // ------------------------------------------------------------------
                   // 6. DASHBOARD LOGIC (FIXED FILTER INITIALIZATION)
                   // ------------------------------------------------------------------
                  
            function initDashboard(filters = null) {         const currentUser = getLocalUser();         if (!currentUser) {           showView('home', true, null);           return;         }         const seekerDashboard = document.getElementById("seeker-dashboard");         const employerDashboard = document.getElementById("employer-dashboard");

                         if (currentUser.role === "seeker") {           seekerDashboard.classList.remove("hidden");          
                    employerDashboard.classList.add("hidden");          
                    loadSeekerProfileForm();

                               const filterKeywordsEl = document.getElementById("filter-keywords");

                               if (filters) {             if (filterKeywordsEl) filterKeywordsEl.value = filters.keywords || '';            
                        document.getElementById("filter-location").value = filters.location || '';            
                        document.getElementById("filter-experience").value = filters.experience || '0';            
                        document.getElementById("filter-category").value = filters.category || '';           } else {             document.getElementById("jobFilterForm").reset();             if (filterKeywordsEl) filterKeywordsEl.value = '';           }

                              
                    document.querySelectorAll(".job-filter-btn").forEach(b => b.classList.remove('btn-primary'));          
                    document.querySelector(".job-filter-btn[data-filter='all']").classList.add('btn-primary');          
                    document.querySelectorAll(".job-view-section").forEach(section => section.classList.add('hidden'));          
                    document.getElementById('shortlisted-jobs').classList.remove('hidden');          
                    document.getElementById('all-jobs').classList.remove('hidden');          
                    document.getElementById('applied-jobs').classList.add('hidden');

                              
                    loadJobs(filters || {});         } else if (currentUser.role === "employer") {           employerDashboard.classList.remove("hidden");          
                    seekerDashboard.classList.add("hidden");          
                    switchEmployerView("employer-management-view");         }       }

                   // ------------------------------------------------------------------
                   // 7. SEEKER DASHBOARD & PROFILE LOGIC 
                   // ------------------------------------------------------------------
                  
            async function loadSeekerProfileForm() {         const currentUser = getLocalUser();         const seekerJobView = document.getElementById("seeker-job-view");         const seekerProfileView = document.getElementById("seeker-profile-view");

                        
                document.getElementById("seeker-name").value = currentUser.name || "";        
                document.getElementById("seeker-email").value = currentUser.email || "";        
                document.getElementById("seeker-skills").value = (currentUser.skills || []).join(", ");        
                document.getElementById("seeker-education").value = currentUser.education || "";

                         let completionScore = 0;         const totalChecks = 4;         if (currentUser.name && currentUser.name.trim() !== '') completionScore++;         if (currentUser.email && currentUser.email.trim() !== '') completionScore++;         if (currentUser.education && currentUser.education.trim() !== '') completionScore++;         if (currentUser.cvfilename && currentUser.cvfilename.trim() !== '') completionScore++;

                         const percentage = Math.round((completionScore / totalChecks) * 100);        
                document.getElementById("profileCompletionBar").style.width = percentage + "%";        
                document.getElementById("profileCompletionText").textContent = percentage + "% Complete";

                         const cvFilenameEl = document.getElementById("cv-filename");         if (currentUser.cvfilename) {           cvFilenameEl.innerHTML = `Uploaded: ${currentUser.cvfilename} (<a href="#" class="cv-link" data-filename="${currentUser.cvfilename}">View/Download</a>)`;         } else {           cvFilenameEl.textContent = "No CV uploaded.";         }

                         // CV download simulation (now uses the actual name from the user object)
                        
                cvFilenameEl.querySelectorAll('.cv-link').forEach(link => {           link.onclick = (e) => {             e.preventDefault();            
                        showStatusMessage("CV View/Download", `Simulating download/view of CV: ${e.target.dataset.filename}.`, false);           };         });

                         const editProfileSidebarBtn = document.getElementById("editProfileSidebarBtn");         if (editProfileSidebarBtn) {           editProfileSidebarBtn.onclick = () => {             document.getElementById("seeker-profile-view").classList.remove('hidden');            
                        document.getElementById("seeker-job-view").classList.add('hidden');            
                        loadSeekerProfileForm();           };         }

                        
                document.getElementById("profile-form").onsubmit = async(e) => {           e.preventDefault();           const saveBtn = e.target.querySelector('button[type="submit"]');          
                    setLoading(saveBtn.id || 'profileSaveBtn', true, 'Save Profile');

                               const name = document.getElementById("seeker-name").value;           const skills = document.getElementById("seeker-skills").value;           const education = document.getElementById("seeker-education").value;           const cvFile = document.getElementById("cv-upload").files[0];

                               const formData = new FormData();          
                    formData.append('name', name);          
                    formData.append('education', education);          
                    formData.append('skills', skills);           if (cvFile) {             formData.append('cvFile', cvFile);           }

                               try {             const data = await fetchApi('seeker/profile', 'PUT', formData, true);            
                        setLocalUser(data.user);            
                        console.log("Profile updated!");            
                        showStatusMessage("Profile Updated", "Your profile has been saved successfully.", false);            
                        seekerJobView.classList.remove('hidden');            
                        seekerProfileView.classList.add('hidden');            
                        loadSeekerProfileForm();           } catch (error) {             console.error("Profile update failed:", error.message);            
                        showStatusMessage("Profile Update Failed", error.message, true);           } finally {             setLoading(saveBtn.id || 'profileSaveBtn', false, 'Save Profile');           }         };       }

                  
            async function loadJobs(filters = {}) {         const allJobsList = document.getElementById("all-jobs-list");         const shortlistedJobsList = document.getElementById("shortlisted-jobs-list");         const appliedJobsList = document.getElementById("applied-jobs-list");        
                allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading jobs...</p>';

                         try {           const filterParams = new URLSearchParams(filters).toString();           const jobs = await fetchApi(`seeker/jobs?${filterParams}`, 'GET');           const applicationData = await fetchApi('seeker/applications', 'GET');

                               const appliedJobIds = applicationData.applied.map(job => job.id);           const shortlistedJobDetails = applicationData.shortlisted;

                              
                    allJobsList.innerHTML = shortlistedJobsList.innerHTML = appliedJobsList.innerHTML = "";

                              
                    jobs.forEach((job) => {                 const hasApplied = appliedJobIds.includes(job.id);                 const isDisabled = hasApplied;                 const applyButtonText = hasApplied ? "Applied" : "Apply Now";

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
                if (shortlistedJobDetails.some(j => j.id === job.id)) shortlistedJobsList.innerHTML += jobCardHTML; 
                if (hasApplied) appliedJobsList.innerHTML += jobCardHTML;
            });

            if (shortlistedJobsList.innerHTML === "") shortlistedJobsList.innerHTML = "<p>No skill-matched or shortlisted jobs found yet.</p>";
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
                        e.target.textContent = 'Apply Now';
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

    // Dynamically insert keywords field into filter widget
    const filterKeywordsEl = document.createElement('input');
    filterKeywordsEl.type = 'text';
    filterKeywordsEl.id = 'filter-keywords';
    filterKeywordsEl.placeholder = 'Keywords, Title, Company';

    const keywordsLabel = document.createElement('label');
    keywordsLabel.htmlFor = 'filter-keywords';
    keywordsLabel.textContent = 'Keywords';

    const filterLocationEl = document.getElementById("filter-location");
    if(filterLocationEl) {
        filterLocationEl.closest('form').insertBefore(filterKeywordsEl, filterLocationEl.closest('form').firstChild);
        filterLocationEl.closest('form').insertBefore(keywordsLabel, filterKeywordsEl);
    }

    jobFilterForm.onsubmit = (e) => {
        e.preventDefault();
        const keywords = document.getElementById("filter-keywords")?.value;
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
        const filterKeywordsEl = document.getElementById("filter-keywords");
        if (filterKeywordsEl) filterKeywordsEl.value = '';
        loadJobs({});
    };

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
                    showStatusMessage("Error", "Could not fetch job details for editing.", true);
                }
            };
        });
        document.querySelectorAll(".delete-job-btn").forEach((button) => {
            button.onclick = (e) => { e.preventDefault(); deleteJob(parseInt(e.currentTarget.dataset.jobId)); };
        });

        switchEmployerView("employer-job-view-details");
    }

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

            // --- FIX: View Job Details Listener ---
            document.querySelectorAll(".job-card").forEach((card) => {
                card.onclick = async (e) => {
                    // Only trigger if the click wasn't on an action button
                    if (!e.target.closest('.job-actions')) {
                        const jobId = parseInt(card.dataset.jobId);
                        
                        try {
                            const jobDetails = await fetchApi(`employer/jobs/${jobId}`, 'GET');
                            showJobDetailsView(jobDetails);
                        } catch (error) {
                            showStatusMessage("Error", "Could not fetch job details.", true);
                        }
                    }
                };
            });
            // END FIX

            document.querySelectorAll(".view-applicants-btn").forEach((button) => {
                button.onclick = (e) => { e.preventDefault(); showApplicantsModal(parseInt(e.currentTarget.dataset.jobId)); };
            });
            document.querySelectorAll(".edit-job-btn").forEach((button) => {
                button.onclick = async (e) => {
                    e.preventDefault();
                    const jobId = parseInt(e.currentTarget.dataset.jobId);
                    try {
                        const jobToEdit = await fetchApi(`employer/jobs/${jobId}`, 'GET');
                        editJob(jobId, jobToEdit);
                    } catch (error) {
                        showStatusMessage("Error", "Could not fetch job details for editing.", true);
                    }
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
        
        document.getElementById("jobStep1Form").classList.remove("hidden");
        document.getElementById("jobStep2Form").classList.add("hidden");
        document.getElementById("jobStep3Form").classList.add("hidden");

        switchEmployerView("employer-post-view");
    }

    async function deleteJob(jobId) {
        const result = await showConfirmation(`Confirm Deletion`, "Are you sure you want to delete this job? This action cannot be undone.", false, 'Yes, Delete It');
        if (!result) { return; }

        try {
            const response = await fetchApi(`employer/jobs/${jobId}`, 'DELETE');
            
            if (response && response.user) {
                setLocalUser(response.user);
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
    // 10. HERO SEARCH BAR LOGIC (REMOVED FROM HOME PAGE)
    // ------------------------------------------------------------------
    // Removed homeSearchBarForm logic since the element is no longer in index.html

    // ------------------------------------------------------------------
    // 11. CHATBOT INTERFACE LOGIC (SIMULATED & FULLY FUNCTIONAL)
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
        messageDiv.innerHTML = text; // Use innerHTML for links/bold text
        chatBody.appendChild(messageDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    };
    
    // Function to guide user and scroll to section
    const guideUser = (viewName, sectionId) => {
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
                botResponse = `Subscription plans are only required for **Employers** to post jobs and access resumes. Job seekers can use the site for free! <a href="#" onclick="window.guideUser('plans', null); return false;">Click here to see the Hive Plans.</a>`;
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

    if (chatCloseBtn) {
        chatCloseBtn.onclick = () => {
            chatWindow.classList.add('hidden');
        };
    }

    if (chatSendBtn) {
        chatSendBtn.onclick = handleChatInput;
    }

    if (chatInputField) {
        chatInputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleChatInput();
            }
        });
    }

    // Make guide functions globally available for inline HTML clicks (e.g., from bot links)
    window.guideUser = guideUser;
    window.showView = showView;
    window.getLocalUser = getLocalUser; 

});