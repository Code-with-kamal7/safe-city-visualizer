import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, onSnapshot, collection, query, where, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyCKY8-POZL9Rh74HI6PGIhLBqaC8TOv_Jg",
    authDomain: "mysafecityweb-d61c1.firebaseapp.com",
    projectId: "mysafecityweb-d61c1",
    storageBucket: "mysafecityweb-d61c1.firebasestorage.app",
    messagingSenderId: "941405502641",
    appId: "1:941405502641:web:9d9db054a8158b5be27690"
  };

// ✅ FIX 1: appId ko firebaseConfig.projectId se set karo
const appId = firebaseConfig.projectId; // Value is 'mysafecityapp'

// ✅ FIX 2: Mocking ko bypass rakho
const IS_FIREBASE_MOCKED = false;
// ... (rest of the code is fine)

// --- GLOBAL STATE ---
let db, auth;
let isAuthReady = false;
let map; 
let zoneMarkers = {};
let chatHistory = [];
let isChatProcessing = false;
let currentRegisteringUser = null; 

// --- DATA STRUCTURES (Required for map/prediction on index.html) ---
const zoneGeocodes = {
    "Bhopal-Core": { lat: 23.2599, lon: 77.4126, name: "Bhopal" },
    "Indore-Commercial": { lat: 22.7196, lon: 75.8577, name: "Indore" },
    "Jabalpur-Residential": { lat: 23.1815, lon: 79.9867, name: "Jabalpur" },
    "Gwalior-Outskirts": { lat: 26.2183, lon: 78.1828, name: "Gwalior" },
    "Ujjain-Religious": { lat: 23.1765, lon: 75.7885, name: "Ujjain" },
    "Sagar-University": { lat: 23.8389, lon: 78.7378, name: "Sagar" },
    "Rewa-Vindhya": { lat: 24.5300, lon: 81.2800, name: "Rewa" },
    "Khajuraho-Tourist": { lat: 24.8310, lon: 79.9190, name: "Khajuraho" },
    "Satna-Industrial": { lat: 24.5872, lon: 80.8351, name: "Satna" },
    "Hoshangabad-Riverine": { lat: 22.7592, lon: 77.7196, name: "Hoshangabad" },
    "Chhindwara-Southern": { lat: 22.0526, lon: 78.9388, name: "Chhindwara" },
    "Ratlam-Western": { lat: 23.3323, lon: 75.0433, name: "Ratlam" },
    "Dewas-Industrial": { lat: 22.9606, lon: 76.0526, name: "Dewas" },
    "Singrauli-Energy": { lat: 24.1818, lon: 82.6800, name: "Singrauli" },
    "Shivpuri-Northern": { lat: 25.4373, lon: 77.6534, name: "Shivpuri" },
    "Khandwa-SouthWest": { lat: 21.8286, lon: 76.3533, name: "Khandwa" },
};

const riskData = {
    "Bhopal-Core": {
        "Day (06:00-18:00)": { level: "Medium", emoji: '🟠', msg: "High traffic aur market areas mein theft aur pickpocketing ka risk hai.", tips: ["Keep purse/phone secure in crowded places.", "Avoid talking on phone near main roads."] },
        "Evening (18:00-22:00)": { level: "HIGH", emoji: '🔴', msg: "Bazar band hone ke baad isolation aur crime ka risk badh jaata hai.", tips: ["Do not walk alone in the Old City after 9 PM.", "Use police patrol numbers if needed."] },
        "Night (22:00-06:00)": { level: "HIGH", emoji: '🔴', msg: "Raat mein police presence kam hoti hai; isolation aur vehicle theft ka risk.", tips: ["Use verified ride-sharing services.", "Avoid shortcuts through deserted colonies.", "Share your live location with family/friends."] }
    },
    "Indore-Commercial": {
        "Day (06:00-18:00)": { level: "Low-Medium", emoji: '🟡', msg: "Din mein rush hour mein minor theft ka risk.", tips: ["Be mindful of your bag/backpack in buses and crowded markets."] },
        "Evening (18:00-22:00)": { level: "CRITICAL", emoji: '🚨', msg: "CRITICAL Risk. Bheed aur late-night commercial activity ke kaaran snatching aur fraud ka sabse zyaada risk.", tips: ["Travel in groups near Vijay Nagar.", "Keep valuables hidden and secure.", "Immediately report suspicious vehicles."] },
        "Night (22:00-06:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Pockets of isolation around malls and commercial centers.", tips: ["Ensure your vehicle is parked in a supervised lot.", "Do not stop for unknown vehicles/persons."] }
    },
    "Jabalpur-Residential": {
        "Day (06:00-18:00)": { level: "LOW", emoji: '🟢', msg: "Quiet residential area, low overall risk.", tips: ["Normal daily precautions apply."] },
        "Evening (18:00-22:00)": { level: "Medium", emoji: '🟠', msg: "Park aur main roads par petty crime ka halka risk.", tips: ["Keep windows and doors locked, even when home.", "Avoid long solitary walks near the perimeter."] },
        "Night (22:00-06:00)": { level: "Low-Medium", emoji: '🟡', msg: "Generally safe, but be alert near isolated blocks.", tips: ["Ensure street lights are functional on your route."] }
    },
    "Gwalior-Outskirts": {
        "Day (06:00-18:00)": { level: "LOW", emoji: '🟢', msg: "Daytime safety is high, mostly agricultural/low-density traffic.", tips: ["Watch out for heavy farm vehicle traffic."] },
        "Evening (18:00-22:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Roads becomes dark and isolated quickly after sunset.", tips: ["Do not use this route after 8 PM unless absolutely necessary.", "Ensure your vehicle's fuel/tires are checked beforehand."] },
        "Night (22:00-06:00)": { level: "CRITICAL", emoji: '🚨', msg: "CRITICAL Risk. High risk for highway/road robberies and accidents due to darkness.", tips: ["ABSOLUTELY AVOID NIGHT TRAVEL.", "Use the nearest well-lit, patrolled highway (if available).", "Travel with two or more vehicles."] }
    },
    "Ujjain-Religious": {
        "Day (06:00-18:00)": { level: "Medium", emoji: '🟠', msg: "Bheed-bhad aur religious sites par pickpocketing/snatching ka darr.", tips: ["Keep valuables locked in the hotel/car.", "Be wary of con artists near temples."] },
        "Evening (18:00-22:00)": { level: "HIGH", emoji: '🔴', msg: "Kshipra river ke ghats aur isolated temple premises par jyaada risk.", tips: ["Avoid solitary walks on river banks after sunset.", "Travel in groups."] },
        "Night (22:00-06:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "City outskirts aur highway exits par high-risk.", tips: ["Use only registered taxis."] }
    },
    "Sagar-University": {
        "Day (06:00-18:00)": { level: "Low-Medium", emoji: '🟡', msg: "Normal city traffic, minor theft around markets.", tips: ["Keep bag close in crowded market areas."] },
        "Evening (18:00-22:00)": { level: "Medium", emoji: '🟠', msg: "University campus perimeter aur hostels ke paas isolation aur petty crime.", tips: ["Ensure hostel gates are secured.", "Use proper lighting on less busy roads."] },
        "Night (22:00-06:00)": { level: "HIGH", emoji: '🔴', msg: "Raat mein city roads aur hostel ke aas-paas vehicle theft aur harassment ka risk.", tips: ["Avoid unnecessary late-night travel, especially alone."] }
    },
    "Rewa-Vindhya": {
        "Day (06:00-18:00)": { level: "LOW", emoji: '🟢', msg: "Generally peaceful region, low crime rate during the day.", tips: ["Standard road safety precautions."] },
        "Evening (18:00-22:00)": { level: "Medium", emoji: '🟠', msg: "Bus stands aur rural highway junction points par halka risk.", tips: ["Be alert at bus and railway stations.", "Avoid strangers offering drinks."] },
        "Night (22:00-06:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Vindhya region ke isolated roads par highway robbery ka risk badh jaata hai.", tips: ["Do not drive alone on state highways at night.", "Stop only at well-known, busy dhabas."] }
    },
    "Khajuraho-Tourist": {
        "Day (06:00-18:00)": { level: "Low-Medium", emoji: '🟡', msg: "Tourist zone mein pickpocketing aur fraud ka risk.", tips: ["Keep travel documents secure.", "Only hire government-certified guides."] },
        "Evening (18:00-22:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Light and Sound show ke baad hotel area ke bahar isolation.", tips: ["Use hotels' transport service.", "Avoid interacting with aggressive touts."] },
        "Night (22:00-06:00)": { level: "CRITICAL", emoji: '🚨', msg: "Raat mein Khajuraho aur Chhatarpur ke beech ke roads highly isolated hote hain.", tips: ["ABSOLUTELY AVOID NIGHT TRAVEL outside the main town.", "Ensure hotel security is strict."] }
    },
    "Satna-Industrial": {
        "Day (06:00-18:00)": { level: "Medium", emoji: '🟠', msg: "Industrial areas aur truck routes par minor theft aur traffic issues.", tips: ["Avoid solitary roads near factories.", "Secure cargo if transporting."] },
        "Evening (18:00-22:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Bus/railway station aur highway junctions par night-time crime ka risk.", tips: ["Be extra cautious at Satna Railway Station after dark."] },
        "Night (22:00-06:00)": { level: "HIGH", emoji: '🔴', msg: "Night shifts ke dauran isolation aur highway crimes ka darr.", tips: ["Do not travel alone on NH 75/7.", "Verify any lift offers."] }
    },
    "Hoshangabad-Riverine": {
        "Day (06:00-18:00)": { level: "LOW", emoji: '🟢', msg: "Narmada ghats par safety achhi hai, mostly tourists/local crowd.", tips: ["Watch belongings near crowded ghats."] },
        "Evening (18:00-22:00)": { level: "Medium", emoji: '🟠', msg: "River bank areas mein isolation aur petty crime ka risk badhta hai.", tips: ["Avoid poorly lit sections of the embankment after 7 PM."] },
        "Night (22:00-06:00)": { level: "Medium", emoji: '🟠', msg: "Generally calm, but be cautious on bridges and bypass roads.", tips: ["Keep car doors locked on peripheral roads."] }
    },
    "Chhindwara-Southern": {
        "Day (06:00-18:00)": { level: "LOW", emoji: '🟢', msg: "Peaceful region, low crime rate.", tips: ["Standard daily precautions."] },
        "Evening (18:00-22:00)": { level: "Low-Medium", emoji: '🟡', msg: "Central market area mein halka bheed-bhad ka risk.", tips: ["Mind your wallet in the main bazaar."] },
        "Night (22:00-06:00)": { level: "Medium", emoji: '🟠', msg: "Rural outskirts aur forest areas ke paas isolation.", tips: ["Do not venture into forest areas after dark."] }
    },
    "Ratlam-Western": {
        "Day (06:00-18:00)": { level: "Medium", emoji: '🟠', msg: "Railway junction aur Mandi areas mein pickpocketing ka risk.", tips: ["Secure luggage at the railway station."] },
        "Evening (18:00-22:00)": { level: "HIGH", emoji: '🔴', msg: "Gujarat border se nikalne waale highways aur junction points par high-risk.", tips: ["Avoid late-night highway travel.", "Ensure vehicle security."] },
        "Night (22:00-06:00)": { level: "CRITICAL", emoji: '🚨', msg: "CRITICAL Risk. Western MP border par organized crime aur smuggling ka darr.", tips: ["ABSOLUTELY AVOID isolated highway rest stops.", "Travel only during daylight hours."] }
    },
    "Dewas-Industrial": {
        "Day (06:00-18:00)": { level: "Medium", emoji: '🟠', msg: "Industrial zone mein heavy traffic aur minor theft ka risk.", tips: ["Avoid carrying large cash.", "Be cautious of heavy vehicle movement."] },
        "Evening (18:00-22:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Industrial outskirts par isolation aur late-night crime ka darr.", tips: ["Travel with colleagues.", "Ensure proper security on industrial premises."] },
        "Night (22:00-06:00)": { level: "HIGH", emoji: '🔴', msg: "Night shifts ke dauran crime rates badh jaate hain.", tips: ["Keep emergency contacts ready.", "Avoid walking alone in dark areas."] }
    },
    "Singrauli-Energy": {
        "Day (06:00-18:00)": { level: "Low-Medium", emoji: '🟡', msg: "Energy corridor mein din mein safety theek hai.", tips: ["Follow road safety rules near coal plants."] },
        "Evening (18:00-22:00)": { level: "Medium", emoji: '🟠', msg: "Mining aur industrial areas ke bahar petty crime.", tips: ["Be wary of quick financial schemes."] },
        "Night (22:00-06:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Isolated mining settlements aur roads par high crime risk.", tips: ["Absolutely minimize travel at night.", "Ensure communication devices are charged."] }
    },
    "Shivpuri-Northern": {
        "Day (06:00-18:00)": { level: "LOW", emoji: '🟢', msg: "Northern MP mein safety achhi hai.", tips: ["Enjoy the scenery."] },
        "Evening (18:00-22:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "NH-46 aur NH-27 junctions par highway crime ka darr.", tips: ["Avoid late-night stops on the highway.", "Check tire pressure and fuel."] },
        "Night (22:00-06:00)": { level: "HIGH", emoji: '🔴', msg: "Highway robbery ka risk sabse zyaada.", tips: ["Travel in convoy if possible.", "Do not stop for unknown distress signals."] }
    },
    "Khandwa-SouthWest": {
        "Day (06:00-18:00)": { level: "Medium", emoji: '🟠', msg: "Railway traffic aur border areas mein theft ka risk.", tips: ["Guard baggage carefully at the station."] },
        "Evening (18:00-22:00)": { level: "Medium-HIGH", emoji: '🔥', msg: "Maharashtra border ke paas police checks aur road crime badh jaate hain.", tips: ["Carry valid identification.", "Avoid arguments with local groups."] },
        "Night (22:00-06:00)": { level: "HIGH", emoji: '🔴', msg: "Highway crime at the border crossing is a risk.", tips: ["Take bypass roads if available.", "Ensure vehicle security."] }
    }
};


// --- DOM Elements (Unified Check) ---
const D = {
    // Shared Elements
    alertContainer: document.getElementById('alertContainer'),
    // Index.html elements
    authModal: document.getElementById('authModal'),
    loginCard: document.getElementById('loginCard'),
    authStatusButton: document.getElementById('authStatusButton'),
    panicButton: document.getElementById('panicButton'),
    loginForm: document.getElementById('loginForm'),
    loginUsernameInput: document.getElementById('loginUsername'),
    loginEmailInput: document.getElementById('loginEmail'),
    areaSelect: document.getElementById('areaSelect'),
    timeOfDay: document.getElementById('timeOfDay'), 
    predictButton: document.getElementById('predictButton'),
    suggestionCard: document.getElementById('suggestionCard'),
    riskLevelEl: document.getElementById('riskLevel'), 
    riskMessageEl: document.getElementById('riskMessage'), 
    safetyTipsEl: document.getElementById('safetyTips'), 
    incidentFeed: document.getElementById('incidentFeed'),
    chatModal: document.getElementById('chatModal'),
    chatInput: document.getElementById('chatInput'),
    chatMessages: document.getElementById('chatMessages'),
    chatSendButton: document.getElementById('chatSendButton'),
    chatCloseButton: document.getElementById('chatCloseButton'),
    chatOpenButton: document.getElementById('chatOpenButton'),
    // Register.html elements
    registrationForm: document.getElementById('registrationForm'),
    otpVerification: document.getElementById('otpVerification'),
    verifyOtpButton: document.getElementById('verifyOtpButton'),
    resendOtpButton: document.getElementById('resendOtpButton'),
    otpInput: document.getElementById('otpInput'),
};


// **********************************************
// ********** FIREBASE/AUTH FUNCTIONS ***********
// **********************************************

async function authenticateUser() {
    try {
        if (IS_FIREBASE_MOCKED) {
            console.warn("Firebase config is placeholder. Using Mock Functionality.");
            if (D.incidentFeed) D.incidentFeed.innerHTML = '<p class="text-red-400 text-sm text-center py-4">Firebase Placeholder: Live data limited.</p>';
            return;
        }

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        await setPersistence(auth, browserSessionPersistence);
        
        if (!auth.currentUser) {
            await signInAnonymously(auth);
            console.log("Signed in anonymously for public data access.");
        }

        isAuthReady = true;
        if (D.incidentFeed) startLiveIncidentFeed();

    } catch (error) {
        console.error("Firebase Init/Auth Error:", error.message || error);
        if (D.incidentFeed) D.incidentFeed.innerHTML = '<p class="text-red-400 text-sm text-center py-4">Firebase Auth Failed. Check your network/keys.</p>';
    }
}

function startLiveIncidentFeed() {
    if (!db || !isAuthReady || !D.incidentFeed) return; 

    // --- 🔥 CORRECTION 2: Live Feed Path FIX 🔥 ---
    const feedRef = collection(
        db, 
        'users',             // 1. Collection ID (Aapka corrected name)
        appId,                   // 2. Document ID (mysafecityappD)
        'public',                // 3. Collection ID
        'data',                  // 4. Document ID (data)
        'incidents'              // 5. FINAL Collection ID
    );
    // --- 🔥 CORRECTION 2 END ---
    
    const q = query(feedRef);

    // ... (rest of the function) ...
}

async function saveRegistrationAndLogin() {
    // ... (rest of the function) ...

    try {
        const userData = currentRegisteringUser;
        const userDocId = userData.username; 
        
        // --- 🔥 CORRECTION 1: Registration Path FIX 🔥 ---
        const usersRef = collection(
            db, 
            'users',              // 1. Collection ID (Aapka corrected name)
            appId,                    // 2. Document ID (mysafecityappD)
            'public',                 // 3. Collection ID
            'data',                   // 4. Document ID (Is Document ko apka code automatically bana dega)
            'users'                   // 5. FINAL Collection ID
        );
        // --- 🔥 CORRECTION 1 END ---

        // setDoc call is now perfect
        await setDoc(doc(usersRef, userDocId), {
            name: userData.name,
            username: userData.username,
            email: userData.email,
            phone: userData.phoneNumber,
            alternatePhone: userData.alternateNumber,
            address: userData.address,
            registrationDate: new Date(),
        });

        // ... (rest of the function) ...
    } catch (error) {
        // ... (error handling) ...
    }
}

// **********************************************
// *********** REGISTER.HTML LOGIC **************
// **********************************************

let SIMULATED_OTP = "";
let resendTimer = null;
let currentPhoneNumber = '';

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function startResendTimer() {
    let seconds = 30;
    const timerEl = document.getElementById('timer');

    if (D.resendOtpButton) {
        D.resendOtpButton.disabled = true;
        D.resendOtpButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (timerEl) timerEl.textContent = seconds;

    resendTimer = setInterval(() => {
        seconds--;
        if (timerEl) timerEl.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(resendTimer);
            if (D.resendOtpButton) {
                D.resendOtpButton.disabled = false;
                D.resendOtpButton.classList.remove('opacity-50', 'cursor-not-allowed');
                D.resendOtpButton.textContent = 'Resend OTP';
            }
        }
    }, 1000);
}

async function handleRegistrationForm(e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const alternateNumber = document.getElementById('alternateNumber').value.trim();
    const address = document.getElementById('address').value.trim();
    const otpMessage = document.getElementById('otpMessage');

    currentRegisteringUser = { name, username, email, phoneNumber, alternateNumber, address };

    if (!db && !IS_FIREBASE_MOCKED) {
        standardAlert("Error: Database connection failed. Please check your network.");
        return;
    }

    if (db) {
        try {
            const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
            const q = query(usersRef, where('username', '==', username));
            const usernameCheck = await getDocs(q);

            if (!usernameCheck.empty) {
                standardAlert('Username already taken. Please choose another.');
                return;
            }

            const qEmail = query(usersRef, where('email', '==', email));
            const emailCheck = await getDocs(qEmail);
            
            if (!emailCheck.empty) {
                standardAlert('Email is already registered. Please login or use a different email.');
                return;
            }
        } catch(error) {
            console.error("Firebase Registration Check Error:", error);
            standardAlert("A network/database error occurred during checks.");
            return;
        }
    }

    SIMULATED_OTP = generateOTP(); 
    currentPhoneNumber = phoneNumber;

    if (D.registrationForm) D.registrationForm.classList.add('hidden');
    if (D.otpVerification) D.otpVerification.classList.remove('hidden');
    
    if (otpMessage) otpMessage.innerHTML = `OTP sent to **+91-${currentPhoneNumber.substring(0, 4)}XXXXX${currentPhoneNumber.substring(8)}**. (Simulated OTP: <span class="text-success-green font-bold">${SIMULATED_OTP}</span>)`;
    
    customAlert(`OTP sent successfully! Hi, ${name}.`, 'info');
    
    if (resendTimer) clearInterval(resendTimer);
    startResendTimer();
}

function handleOtpVerification() {
    const enteredOtp = D.otpInput.value.trim();

    if (enteredOtp === SIMULATED_OTP) {
        clearInterval(resendTimer);
        saveRegistrationAndLogin(); 
    } else {
        customAlert('Incorrect OTP. Please try again or resend.', 'error');
        D.otpInput.value = '';
    }
}

function handleResendOtp() {
    SIMULATED_OTP = generateOTP(); 
    const otpMessage = document.getElementById('otpMessage');

    if (otpMessage) otpMessage.innerHTML = `New OTP sent to **+91-${currentPhoneNumber.substring(0, 4)}XXXXX${currentPhoneNumber.substring(8)}**. (Simulated OTP: <span class="text-success-green font-bold">${SIMULATED_OTP}</span>)`;

    customAlert(`New OTP sent to +91-${currentPhoneNumber.substring(0, 4)}XXXXX${currentPhoneNumber.substring(8)}.`, 'info');
    D.otpInput.value = '';
    if (resendTimer) clearInterval(resendTimer);
    startResendTimer();
}
// **********************************************
// *********** INDEX.HTML LOGIN LOGIC ***********
// **********************************************

async function handleLoginForm(e) {
    e.preventDefault();

    const username = D.loginUsernameInput.value.trim();
    const email = D.loginEmailInput.value.trim();

    if (!db) {
        standardAlert('Database connection is initializing. Please wait and try again.');
        return;
    }
    
    // Check for mocking logic (unlikely to run now, but safe)
    if (IS_FIREBASE_MOCKED) {
        standardAlert('Firebase is mocked/not initialized. Using simulated login only.');
        if (username.length > 2 && email.includes('@')) {
             handleSuccessfulLogin(username, username);
        } else {
             standardAlert('Simulated Login Failed. Please enter valid mock credentials.');
        }
        return;
    }

    customAlert('Verifying credentials...', 'info');

    try {
        // ✅ LOGIN PATH FIX: Ye line ab sahi structure mein hai aur Registration se match karti hai.
        const usersRef = collection(
            db, 
            'artefacts', 
            appId, 
            'public', 
            'data', 
            'users' 
        );

        const q = query(usersRef, where('username', '==', username), where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            standardAlert('Login Failed. User not found. Please register.');
        } else {
            const userData = snapshot.docs[0].data();
            handleSuccessfulLogin(userData.name, userData.username);
        }
    } catch (error) {
        console.error("Firestore Login Error:", error);
        standardAlert(`A network error occurred during login verification: ${error.message}.`);
    }
}


function handleSuccessfulLogin(name, username) {
    customAlert(`Login Successful! Welcome back, ${name}.`, 'success');
    
    if (D.authModal && D.loginCard) {
        D.loginCard.classList.add('scale-95', 'opacity-0');
        setTimeout(() => D.authModal.style.display = 'none', 300);
    }
    
    if (D.authStatusButton) {
        D.authStatusButton.textContent = `Welcome, ${name}`;
        D.authStatusButton.classList.remove('bg-success-green');
        D.authStatusButton.classList.add('bg-primary-indigo');
        D.authStatusButton.setAttribute('data-status', 'authenticated');
    }
}

// **********************************************
// ************ MAP & PREDICTION LOGIC **********
// **********************************************

const getRiskClass = (level) => {
    if (level.includes('CRITICAL')) return 'risk-critical';
    if (level.includes('HIGH')) return 'risk-high';
    if (level.includes('Medium-HIGH')) return 'risk-medium-high';
    if (level.includes('Medium')) return 'risk-medium';
    if (level.includes('Low-Medium')) return 'risk-low-medium';
    return 'risk-low';
};

const createRiskIcon = (riskClass, areaName) => {
    return L.divIcon({
        className: `leaflet-marker-icon ${riskClass} rounded-full flex items-center justify-center text-xs text-white font-bold shadow-lg`,
        html: `<div>${areaName.substring(0, 3).toUpperCase()}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
};

const updateMapHighlight = (highlightZoneKey, prediction, selectedTime) => {
    const riskClass = getRiskClass(prediction.level);
    const geo = zoneGeocodes[highlightZoneKey];
    
    const targetMarker = zoneMarkers[highlightZoneKey];
    if (!targetMarker) return;

    const newIcon = createRiskIcon(riskClass, geo.name);
    
    targetMarker.setIcon(newIcon);
    targetMarker.setPopupContent(`
        <b class="text-lg">${geo.name}</b><br>
        Risk: <span class="font-bold ${riskClass.includes('red') ? 'text-red-500' : riskClass.includes('yellow') ? 'text-yellow-500' : 'text-green-500'}">${prediction.level}</span><br>
        Time: ${selectedTime}
    `);
    targetMarker.openPopup();
    
    map.panTo([geo.lat, geo.lon]);
};

const initMap = () => {
    const mapElement = document.getElementById('liveMap');
    if (!mapElement) return;

    if (map) { map.remove(); }

    map = L.map('liveMap').setView([23.0, 78.5], 7);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri...',
        noWrap: true
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        opacity: 0.8,
        attribution: 'Esri, Garmin, USGS'
    }).addTo(map);

    Object.keys(zoneGeocodes).forEach(zoneKey => {
        const geo = zoneGeocodes[zoneKey];
        const defaultRiskClass = 'risk-low-medium';
        const defaultIcon = createRiskIcon(defaultRiskClass, geo.name);

        const marker = L.marker([geo.lat, geo.lon], { 
                icon: defaultIcon, 
                title: zoneKey
            })
            .addTo(map)
            .bindPopup(`<b>${geo.name}</b><br>Select time and click marker or button to check risk.`, { closeButton: false });

        marker.on('click', function (e) {
            runPrediction(this.options.title, D.timeOfDay.value);
        });

        zoneMarkers[zoneKey] = marker;
    });
};

function runPrediction(selectedArea, selectedTime) {
    if (!D.timeOfDay) { 
        standardAlert("Prediction feature is only available on the main dashboard.");
        return;
    }

    if (!selectedArea || !selectedTime) {
        standardAlert("Kripya (Please) area aur time dono select karein.");
        return;
    }

    const prediction = riskData[selectedArea]?.[selectedTime];
    if (!prediction) {
         standardAlert("Is area aur time ke liye data available nahi hai. (Data not available for this area and time.)");
         return;
    }
    
    // 1. Update UI
    D.riskLevelEl.innerHTML = `${prediction.emoji} ${prediction.level}`;
    D.riskMessageEl.textContent = `For ${zoneGeocodes[selectedArea].name} during ${selectedTime}, the predicted safety risk is ${prediction.level}. ${prediction.msg}`;
    
    D.safetyTipsEl.innerHTML = prediction.tips.map(tip => `<li>${tip}</li>`).join('');

    // 2. Style Card
    let bgColorClass, borderColorClass, levelColorClass;
    switch (prediction.level) {
        case 'LOW': bgColorClass = 'bg-green-900/40'; borderColorClass = 'border-green-500/50'; levelColorClass = 'text-green-300'; break;
        case 'Low-Medium': bgColorClass = 'bg-secondary-teal/40'; borderColorClass = 'border-secondary-teal/50'; levelColorClass = 'text-secondary-teal'; break;
        case 'Medium': bgColorClass = 'bg-yellow-900/40'; borderColorClass = 'border-yellow-500/50'; levelColorClass = 'text-yellow-300'; break;
        case 'Medium-HIGH': bgColorClass = 'bg-orange-900/40'; borderColorClass = 'border-orange-500/50'; levelColorClass = 'text-orange-300'; break;
        case 'HIGH':
        case 'CRITICAL': bgColorClass = 'bg-red-900/40'; borderColorClass = 'border-red-500/50'; levelColorClass = 'text-red-300'; break;
        default: bgColorClass = 'bg-gray-700/40'; borderColorClass = 'border-gray-500/50'; levelColorClass = 'text-gray-300'; break;
    }

    D.suggestionCard.className = `p-6 ${bgColorClass} border ${borderColorClass} rounded-xl shadow-xl transition-all duration-300 transform scale-100 opacity-100`;
    D.riskLevelEl.className = `ml-2 font-extrabold text-2xl flex items-center ${levelColorClass}`;

    // 3. Update Map
    updateMapHighlight(selectedArea, prediction, selectedTime);

    // 4. Update Dropdown
    D.areaSelect.value = selectedArea;
}

// **********************************************
// ************ CHATBOT FUNCTIONS ***************
// **********************************************

function renderMessage(sender, text) {
    const isUser = sender === 'user';
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
    messageDiv.innerHTML = `
        <div class="max-w-[85%] p-3 rounded-xl shadow-md ${isUser 
            ? 'bg-primary-indigo text-white rounded-br-none' 
            : 'bg-gray-700 text-gray-100 rounded-tl-none'
        }">
            ${text.replace(/\n/g, '<br>')}
        </div>
    `;
    D.chatMessages.appendChild(messageDiv);
    D.chatMessages.scrollTop = D.chatMessages.scrollHeight;
}

function addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.className = 'flex justify-start';
    loadingDiv.innerHTML = `<div class="max-w-[85%] p-3 rounded-xl shadow-md bg-gray-700 text-gray-100 rounded-tl-none"><span class="animate-pulse">Typing...</span></div>`;
    D.chatMessages.appendChild(loadingDiv);
    D.chatMessages.scrollTop = D.chatMessages.scrollHeight;
}

function removeLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) { indicator.remove(); }
}

async function sendQueryToGemini(query) {
    if (isChatProcessing) return;
    isChatProcessing = true;
    if(D.chatSendButton) D.chatSendButton.disabled = true;
    if(D.chatInput) D.chatInput.disabled = true;

    renderMessage('user', query);
    addLoadingIndicator();
    
    const systemPrompt = "You are SafeCity AI, an expert virtual assistant for public safety in India. Keep your responses encouraging, professional, and focus on providing safety tips, project details, or simulated crime risk information based on the user's query. Use Hinglish.";
    
    chatHistory.push({ role: "user", parts: [{ text: query }] });

    const payload = {
        contents: chatHistory,
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const candidate = result.candidates?.[0];
        let aiResponseText = "Maafi chahte hain, main abhi response nahi de paya. Kripya thodi der baad koshish karein.";

        if (candidate?.content?.parts?.[0]?.text) {
            aiResponseText = candidate.content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: aiResponseText }] });
        } else if (result.error) {
            aiResponseText = `Error: ${result.error.message}. Network error ya API limit exceed ho gayi hai.`;
        }

        removeLoadingIndicator();
        renderMessage('model', aiResponseText);
        
    } catch (error) {
        console.error("Gemini API Error:", error);
        removeLoadingIndicator();
        renderMessage('model', "Network error ya API limit exceed ho gayi hai. Please check your connection.");
    } finally {
        isChatProcessing = false;
        if(D.chatSendButton) D.chatSendButton.disabled = false;
        if(D.chatInput) {
            D.chatInput.disabled = false;
            D.chatInput.value = '';
            D.chatInput.focus();
        }
    }
}

// **********************************************
// ************ UTILITY FUNCTIONS ***************
// **********************************************

function renderLiveFeedUI(incidents) {
    if (!D.incidentFeed) return; 

    D.incidentFeed.innerHTML = ''; 

    if (incidents.length === 0) {
        D.incidentFeed.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">No live incidents reported yet.</p>`;
        return;
    }

    incidents.forEach(incident => {
        const risk = incident.risk || 'LOW';
        const time = incident.timestamp ? new Date(incident.timestamp.seconds * 1000).toLocaleTimeString() : 'Just now';
        
        let colorClass = 'text-gray-400';
        if (risk.includes('CRITICAL')) colorClass = 'text-red-500';
        else if (risk.includes('HIGH')) colorClass = 'text-red-400';
        else if (risk.includes('Medium-HIGH')) colorClass = 'text-orange-400';
        else if (risk.includes('Medium')) colorClass = 'text-yellow-400';
        else if (risk.includes('LOW')) colorClass = 'text-green-400';

        const item = document.createElement('div');
        item.className = 'flex justify-between text-sm p-2 bg-gray-800 rounded-lg border-l-4 border-gray-700 hover:bg-gray-700/50 transition duration-150';
        item.innerHTML = `
            <div>
                <span class="font-bold ${colorClass}">${incident.type || 'Unknown Incident'}</span> 
                <span class="text-xs text-gray-500 ml-2">in ${incident.area || 'Unknown Zone'}</span>
            </div>
            <span class="text-xs text-gray-500">${time}</span>
        `;
        D.incidentFeed.appendChild(item);
    });
    D.incidentFeed.scrollTop = 0;
}

function customAlert(message, type = 'info') {
    const alertContainer = D.alertContainer;
    if (!alertContainer) return;

    let bgColor;
    if (type === 'success') { bgColor = 'bg-success-green'; } 
    else if (type === 'error') { bgColor = 'bg-error-red'; } 
    else { bgColor = 'bg-accent-blue'; }

    const alertDiv = document.createElement('div');
    const isRichHtml = message.includes('</');
    
    alertDiv.className = `p-4 rounded-lg shadow-2xl flex ${isRichHtml ? 'flex-col items-center w-full max-w-md' : 'items-center space-x-3'} transition-opacity duration-300 ${bgColor} text-white`;
    alertDiv.innerHTML = isRichHtml ? message : `
        <svg class="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="${type === 'success' ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : type === 'error' ? 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' : 'M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 102 0V9a1 1 0 10-2 0V7zm0 6a1 1 0 102 0v-2a1 1 0 10-2 0v2z'}" clip-rule="evenodd"/></svg>
        <span>${message}</span>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.addEventListener('transitionend', () => alertDiv.remove());
    }, 4000);
}

function standardAlert(message) {
     customAlert(`
        <div class="flex items-center space-x-3">
            <svg class="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
            <span>${message}</span>
        </div>
     `, 'error');
}


// **********************************************
// ************ EVENT LISTENERS *****************
// **********************************************

function setupEventListeners() {
    // --- REGISTER PAGE LISTENERS ---
    if (D.registrationForm) {
        D.registrationForm.addEventListener('submit', handleRegistrationForm);
        D.verifyOtpButton.addEventListener('click', handleOtpVerification);
        D.resendOtpButton.addEventListener('click', handleResendOtp);
    }
    
    // --- INDEX PAGE LISTENERS ---
    if (D.loginForm) {
        // Modal Logic
        const showModal = () => {
            D.authModal.style.display = 'flex';
            setTimeout(() => D.loginCard.classList.remove('scale-95', 'opacity-0'), 10);
        };
        const hideModal = () => {
            D.loginCard.classList.add('scale-95', 'opacity-0');
            setTimeout(() => D.authModal.style.display = 'none', 300);
        };
        window.hideModal = hideModal;

        D.authModal.addEventListener('click', (e) => {
            if (e.target === D.authModal) { hideModal(); }
        });
        D.authStatusButton.addEventListener('click', () => {
            if (D.authStatusButton.dataset.status !== 'authenticated') { showModal(); }
        });
        D.loginForm.addEventListener('submit', handleLoginForm);
        
        // Prediction and Map Listeners
        if (D.predictButton) D.predictButton.addEventListener('click', () => {
            runPrediction(D.areaSelect.value, D.timeOfDay.value);
        });
        
        // Panic Button Listener (SOS)
        if (D.panicButton) D.panicButton.addEventListener('click', () => {
             const sosMessageHtml = `<div class="text-center p-2"><h3 class="text-2xl font-extrabold text-red-100 mb-3 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s-8-4.5-8-10c0-4.4 3.6-8 8-8s8 3.6 8 8c0 5.5-8 10-8 10z"></path><path d="M12 18l-1.5-3h3L12 18z"></path><circle cx="12" cy="10" r="2"></circle></svg>EMERGENCY ALERT</h3><p class="text-lg font-bold text-red-300 border-b border-red-500/50 pb-2">Your location is being tracked (Simulated).</p><div class="space-y-1 mt-4 text-left text-base"><p class="font-semibold text-white">Police (All India): <span class="text-yellow-300">100 / 112</span></p><p class="font-semibold text-white">Women's Helpline: <span class="text-yellow-300">1090</span></p><p class="font-semibold text-white">Ambulance / Fire: <span class="text-yellow-300">108 / 101</span></p></div></div>`;
             customAlert(sosMessageHtml, 'error');
        });
        
        // Chatbot Controls (FIXED)
        if (D.chatOpenButton) {
            D.chatOpenButton.addEventListener('click', () => {
                D.chatModal.classList.remove('hidden');
                setTimeout(() => D.chatModal.classList.add('translate-y-0', 'opacity-100'), 10);
                if(D.chatInput) D.chatInput.focus();
            });

            D.chatCloseButton.addEventListener('click', () => {
                D.chatModal.classList.remove('translate-y-0', 'opacity-100');
                setTimeout(() => D.chatModal.classList.add('hidden'), 300);
            });
            
            D.chatSendButton.addEventListener('click', () => {
                const query = D.chatInput.value.trim();
                if (query) { sendQueryToGemini(query); }
            });

            D.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const query = D.chatInput.value.trim();
                    if (query) { sendQueryToGemini(query); }
                }
            });
        }
    }
}


// **********************************************
// ************ INITIALIZATION ******************
// **********************************************

document.addEventListener('DOMContentLoaded', () => {
    // Map init is only needed on the main dashboard (index.html)
    if (document.getElementById('liveMap')) {
        initMap();
    }
    
    setupEventListeners();
    authenticateUser(); 
});        