/* FJMC Academy - shared device reservation guard for secondary pages.
   Same rule as dashboard: maximum 1 mobile + 1 desktop, 3-day reservation.
   This file does not modify the existing dashboard device code. */
import { collection, doc, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const MAX_DEVICES = 2;
const DEVICE_TIMEOUT = 3 * 24 * 60 * 60 * 1000;

function getDeviceId() {
    let id = localStorage.getItem("fjmcDeviceId");
    if (!id) {
        id = "device-" + (crypto?.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
        localStorage.setItem("fjmcDeviceId", id);
    }
    return id;
}

function getDeviceType() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent || "") ? "mobile" : "desktop";
}

export async function enforceFJMCDeviceRule(db, user) {
    const deviceId = getDeviceId();
    const deviceType = getDeviceType();
    const now = Date.now();
    const ref = doc(db, "users", user.uid, "devices", deviceId);
    const snap = await getDoc(ref);

    const all = await getDocs(collection(db, "users", user.uid, "devices"));
    let activeTotal = 0;
    let sameType = 0;

    all.forEach(d => {
        if (d.id === deviceId) return;
        const data = d.data();
        if (data.active === true && Number(data.expiresAt || 0) > now) {
            activeTotal++;
            if ((data.deviceType || "") === deviceType) sameType++;
        }
    });

    if (snap.exists()) {
        const data = snap.data();
        if (Number(data.expiresAt || 0) > now) {
            await setDoc(ref, { active: true, lastSeen: now, email: user.email }, { merge: true });
            return true;
        }
    }

    if (sameType >= 1 || activeTotal >= MAX_DEVICES) {
        alert("Device limit reached. This page follows the same FJMC device reservation rule.");
        return false;
    }

    await setDoc(ref, {
        email: user.email,
        active: true,
        deviceType,
        lastSeen: now,
        expiresAt: now + DEVICE_TIMEOUT
    }, { merge: true });

    return true;
}
