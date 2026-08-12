/**
 * REGISTRATION FLOW TESTER
 * =========================
 * 
 * Open browser developer console (F12) and run these commands to test:
 * 
 * 1. Check Firebase connectivity:
 *    window.testFirebaseReady()
 * 
 * 2. Check current user:
 *    window.testCurrentUser()
 * 
 * 3. List all registrations in Firebase:
 *    window.testListAllRegistrations()
 * 
 * 4. List user's registrations from Profile logic:
 *    window.testListUserRegistrations()
 * 
 * 5. Create a test registration (required: userId):
 *    window.testCreateRegistration('test-user-123')
 * 
 * 6. Watch realtime listener updates:
 *    window.testWatchRealtimeListener()
 * 
 * 7. Full flow test:
 *    window.testFullFlow()
 */

window.testFirebaseReady = function() {
    console.log('[TEST] Checking Firebase readiness...');
    
    // Check Firebase library
    if (typeof firebase === 'undefined') {
        console.error('[TEST] Firebase library not loaded');
        return false;
    }
    
    // Check Firebase Auth
    try {
        const currentUser = firebase.auth().currentUser;
        console.log('[TEST] Firebase Auth current user:', currentUser ? currentUser.uid : 'not logged in');
    } catch (e) {
        console.error('[TEST] Firebase Auth error:', e);
    }
    
    // Check Database
    if (typeof database === 'undefined') {
        console.error('[TEST] Firebase database not initialized');
        return false;
    }
    
    console.log('[TEST] ✓ Firebase is ready');
    console.log('[TEST] Auth:', typeof firebase.auth !== 'undefined' ? 'YES' : 'NO');
    console.log('[TEST] Database:', typeof database !== 'undefined' ? 'YES' : 'NO');
    console.log('[TEST] FirebaseAPI:', typeof FirebaseAPI !== 'undefined' ? 'YES' : 'NO');
    
    return true;
};

window.testCurrentUser = function() {
    console.log('[TEST] Checking current user...');
    
    // From localStorage
    const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!cu) {
        console.warn('[TEST] No currentUser in localStorage');
        return null;
    }
    
    console.log('[TEST] CurrentUser from localStorage:');
    console.log('  uid:', cu.uid || 'NOT SET');
    console.log('  id:', cu.id || 'NOT SET');
    console.log('  email:', cu.email || 'NOT SET');
    console.log('  gmail:', cu.gmail || 'NOT SET');
    console.log('  username:', cu.username || 'NOT SET');
    console.log('  name:', cu.name || 'NOT SET');
    
    // From Firebase Auth
    const fbUser = firebase.auth().currentUser;
    if (fbUser) {
        console.log('[TEST] Firebase Auth user:');
        console.log('  uid:', fbUser.uid);
        console.log('  email:', fbUser.email);
    } else {
        console.warn('[TEST] Not logged in to Firebase Auth');
    }
    
    return cu;
};

window.testListAllRegistrations = async function() {
    console.log('[TEST] Loading all registrations from Firebase...');
    
    if (typeof FirebaseAPI === 'undefined' || !FirebaseAPI.getAllRegistrations) {
        console.error('[TEST] FirebaseAPI.getAllRegistrations not available');
        return [];
    }
    
    try {
        const regs = await FirebaseAPI.getAllRegistrations();
        console.log('[TEST] Total registrations:', regs.length);
        
        regs.forEach((r, i) => {
            console.log(`[TEST] [${i}]`, {
                id: r.id,
                userId: r.userId,
                email: r.email,
                gmail: r.gmail,
                status: r.status,
                code: r.code,
                createdAt: r.createdAt
            });
        });
        
        return regs;
    } catch (e) {
        console.error('[TEST] Error loading registrations:', e);
        return [];
    }
};

window.testListUserRegistrations = async function() {
    console.log('[TEST] Loading user registrations using Profile logic...');
    
    const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!cu) {
        console.warn('[TEST] No currentUser logged in');
        return [];
    }
    
    const uid = cu.uid || cu.id;
    const email = (cu.email || cu.gmail || '').toLowerCase();
    
    console.log('[TEST] Filtering with uid:', uid, 'email:', email);
    
    if (typeof FirebaseAPI === 'undefined' || !FirebaseAPI.getAllRegistrations) {
        console.error('[TEST] FirebaseAPI.getAllRegistrations not available');
        return [];
    }
    
    try {
        const allRegs = await FirebaseAPI.getAllRegistrations();
        console.log('[TEST] Total available:', allRegs.length);
        
        // Apply Profile filter logic
        const myRegs = allRegs.filter(r => {
            if (uid && r.userId === uid) {
                console.log('[TEST] MATCH by userId:', r.id);
                return true;
            }
            if (email && r.userEmail && r.userEmail.toLowerCase() === email) {
                console.log('[TEST] MATCH by userEmail:', r.id);
                return true;
            }
            if (email && r.email && r.email.toLowerCase() === email) {
                console.log('[TEST] MATCH by email:', r.id);
                return true;
            }
            if (email && r.gmail && r.gmail.toLowerCase() === email) {
                console.log('[TEST] MATCH by gmail:', r.id);
                return true;
            }
            return false;
        });
        
        console.log('[TEST] User registrations matched:', myRegs.length);
        myRegs.forEach((r, i) => {
            console.log(`[TEST] [${i}]`, {
                id: r.id,
                userId: r.userId,
                status: r.status,
                createdAt: r.createdAt
            });
        });
        
        return myRegs;
    } catch (e) {
        console.error('[TEST] Error:', e);
        return [];
    }
};

window.testCreateRegistration = async function(userId) {
    console.log('[TEST] Creating test registration for userId:', userId);
    
    if (!userId) {
        console.error('[TEST] userId required');
        return;
    }
    
    const testReg = {
        id: 'TEST-' + Date.now().toString(36).toUpperCase(),
        userId: userId,
        code: 'TEST-PACKAGE',
        packageName: 'Test Package',
        name: 'Test User',
        email: 'test@example.com',
        phone: '0123456789',
        price: 100000,
        status: 'pending_payment',
        createdAt: new Date().toISOString()
    };
    
    console.log('[TEST] Submitting:', testReg);
    
    if (typeof RegistrationSync === 'undefined' || !RegistrationSync.save) {
        console.error('[TEST] RegistrationSync.save not available');
        return;
    }
    
    try {
        const result = await RegistrationSync.save(testReg);
        console.log('[TEST] Result:', result);
        return result;
    } catch (e) {
        console.error('[TEST] Error:', e);
    }
};

window.testWatchRealtimeListener = function() {
    console.log('[TEST] Setting up realtime listener for current user...');
    
    const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!cu) {
        console.warn('[TEST] No currentUser logged in');
        return;
    }
    
    const uid = cu.uid || cu.id;
    const email = (cu.email || cu.gmail || '').toLowerCase();
    
    console.log('[TEST] Listening to uid:', uid, 'email:', email);
    
    if (typeof FirebaseAPI === 'undefined' || !FirebaseAPI.getUserRegistrationsRealtime) {
        console.error('[TEST] FirebaseAPI.getUserRegistrationsRealtime not available');
        return;
    }
    
    const unsub = FirebaseAPI.getUserRegistrationsRealtime(uid, email, function(regs) {
        console.log('[TEST] Listener received update:', regs.length, 'registrations');
        regs.forEach((r, i) => {
            console.log(`[TEST]   [${i}]`, r.id, r.status);
        });
    });
    
    console.log('[TEST] Listener activated. To stop, call: window._testListenerUnsub()');
    window._testListenerUnsub = unsub;
};

window.testFullFlow = async function() {
    console.log('[TEST] ===== FULL REGISTRATION FLOW TEST =====');
    
    // Step 1: Check readiness
    console.log('[TEST] Step 1: Checking Firebase readiness...');
    if (!window.testFirebaseReady()) {
        console.error('[TEST] Firebase not ready, aborting');
        return;
    }
    
    // Step 2: Check current user
    console.log('[TEST] Step 2: Checking current user...');
    const cu = window.testCurrentUser();
    if (!cu || !cu.uid) {
        console.error('[TEST] No valid current user, aborting');
        return;
    }
    
    // Step 3: List all registrations
    console.log('[TEST] Step 3: Listing all registrations...');
    const allRegs = await window.testListAllRegistrations();
    console.log('[TEST] Total in Firebase:', allRegs.length);
    
    // Step 4: List user registrations
    console.log('[TEST] Step 4: Listing user registrations...');
    const userRegs = await window.testListUserRegistrations();
    console.log('[TEST] User registrations:', userRegs.length);
    
    // Step 5: Create test registration
    console.log('[TEST] Step 5: Creating test registration...');
    const result = await window.testCreateRegistration(cu.uid);
    if (!result || !result.success) {
        console.error('[TEST] Failed to create test registration');
        return;
    }
    console.log('[TEST] Created:', result.id);
    
    // Step 6: Wait a moment and check if it appears
    console.log('[TEST] Step 6: Waiting 2 seconds for Firebase sync...');
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 7: List all again
    console.log('[TEST] Step 7: Listing all registrations again...');
    const allRegs2 = await window.testListAllRegistrations();
    console.log('[TEST] Total in Firebase now:', allRegs2.length, '(was:', allRegs.length + ')');
    
    const newReg = allRegs2.find(r => r.id === result.id);
    if (newReg) {
        console.log('[TEST] ✓ NEW REGISTRATION FOUND IN FIREBASE');
        console.log('[TEST]', newReg);
    } else {
        console.error('[TEST] ✗ NEW REGISTRATION NOT FOUND IN FIREBASE');
    }
    
    // Step 8: List user registrations again
    console.log('[TEST] Step 8: Listing user registrations again...');
    const userRegs2 = await window.testListUserRegistrations();
    console.log('[TEST] User registrations now:', userRegs2.length, '(was:', userRegs.length + ')');
    
    const userFoundReg = userRegs2.find(r => r.id === result.id);
    if (userFoundReg) {
        console.log('[TEST] ✓ NEW REGISTRATION FOUND IN USER LIST');
    } else {
        console.error('[TEST] ✗ NEW REGISTRATION NOT FOUND IN USER LIST');
    }
    
    console.log('[TEST] ===== TEST COMPLETE =====');
};

console.log('[RegistrationFlowTester] Loaded. Available commands:');
console.log('  window.testFirebaseReady()');
console.log('  window.testCurrentUser()');
console.log('  window.testListAllRegistrations()');
console.log('  window.testListUserRegistrations()');
console.log('  window.testCreateRegistration(userId)');
console.log('  window.testWatchRealtimeListener()');
console.log('  window.testFullFlow()');
