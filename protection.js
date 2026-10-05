/* FJMC Academy - Global screen/capture protection (best effort) */
(function () {
    "use strict";
    if (window.__FJMC_GLOBAL_PROTECTION__) return;
    window.__FJMC_GLOBAL_PROTECTION__ = true;

    const guard = document.createElement("div");
    guard.id = "fjmcGlobalCaptureGuard";
    guard.innerHTML = '<div class="fjmc-global-guard-box"><div class="fjmc-global-lock">🔒</div><div class="fjmc-global-title">Screen protection active</div><div class="fjmc-global-text">This page is temporarily hidden for security.</div></div>';
    guard.style.cssText = [
        "position:fixed", "inset:0", "display:none", "align-items:center", "justify-content:center",
        "background:#000", "z-index:2147483647", "color:#fff", "font-family:Arial,Helvetica,sans-serif",
        "text-align:center", "pointer-events:auto"
    ].join(";");
    document.documentElement.appendChild(guard);

    const box = guard.querySelector(".fjmc-global-guard-box");
    if (box) box.style.cssText = "max-width:520px;padding:24px";
    const lock = guard.querySelector(".fjmc-global-lock");
    if (lock) lock.style.cssText = "font-size:42px;margin-bottom:12px";
    const title = guard.querySelector(".fjmc-global-title");
    if (title) title.style.cssText = "font-size:20px;font-weight:800;margin-bottom:8px";
    const text = guard.querySelector(".fjmc-global-text");
    if (text) text.style.cssText = "font-size:14px;opacity:.9";

    let timer = 0;
    function showGuard() {
        guard.style.display = "flex";
        document.documentElement.classList.add("fjmc-capture-protected");
    }
    function hideGuard() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            if (!document.hidden && document.hasFocus()) {
                guard.style.display = "none";
                document.documentElement.classList.remove("fjmc-capture-protected");
            }
        }, 350);
    }

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) showGuard(); else hideGuard();
    }, true);

    window.addEventListener("blur", function () {
        showGuard();
    }, true);

    window.addEventListener("focus", hideGuard, true);

    document.addEventListener("keydown", function (event) {
        const key = String(event.key || "").toLowerCase();
        const blocked =
            key === "printscreen" || key === "prtsc" || key === "snapshot" ||
            key === "f12" ||
            (event.ctrlKey && ["u", "s", "p"].includes(key)) ||
            (event.ctrlKey && event.shiftKey && ["i", "j", "c", "s"].includes(key)) ||
            (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key));
        if (blocked) {
            event.preventDefault();
            event.stopPropagation();
            showGuard();
            setTimeout(hideGuard, 900);
        }
    }, true);

    document.addEventListener("contextmenu", function (event) {
        event.preventDefault();
    }, true);

    document.addEventListener("dragstart", function (event) {
        event.preventDefault();
    }, true);

    // Additional browser-level deterrence. These do NOT override OS-level
    // screen capture tools, but reduce common ways of copying page content.
    document.addEventListener("selectstart", function (event) {
        event.preventDefault();
    }, true);

    document.addEventListener("copy", function (event) {
        event.preventDefault();
    }, true);

    document.addEventListener("cut", function (event) {
        event.preventDefault();
    }, true);

    document.addEventListener("copy", function (event) {
        try { event.clipboardData.setData("text/plain", ""); } catch (_) {}
    }, true);

    window.addEventListener("beforeprint", showGuard, true);
    window.addEventListener("afterprint", hideGuard, true);

    // Try to disable picture-in-picture where supported.
    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("video").forEach(function (video) {
            try { video.disablePictureInPicture = true; } catch (_) {}
            try { video.setAttribute("disablepictureinpicture", ""); } catch (_) {}
        });
    }, true);

    // Keep newly-created videos protected too.
    const observer = new MutationObserver(function () {
        document.querySelectorAll("video").forEach(function (video) {
            try { video.disablePictureInPicture = true; } catch (_) {}
            try { video.setAttribute("disablepictureinpicture", ""); } catch (_) {}
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
