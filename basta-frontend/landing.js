// ============================================
// BASTA LANDING PAGE - JavaScript
// Completely separate from app.js dashboard logic
// ============================================

(function() {
    'use strict';

    // --- Navbar scroll effect ---
    const nav = document.querySelector('.landing-nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        });
    }

    // --- Scroll reveal animations ---
    function initRevealAnimations() {
        const reveals = document.querySelectorAll('.reveal');
        if (reveals.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        reveals.forEach(el => observer.observe(el));
    }

    // --- Counter animation for stats ---
    function animateCounters() {
        const counters = document.querySelectorAll('.stat-number');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.getAttribute('data-count'), 10);
                    const suffix = el.getAttribute('data-suffix') || '';
                    const duration = 2000;
                    const startTime = performance.now();

                    function update(currentTime) {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        // Ease-out quad
                        const eased = 1 - (1 - progress) * (1 - progress);
                        const current = Math.floor(eased * target);
                        el.textContent = current + suffix;

                        if (progress < 1) {
                            requestAnimationFrame(update);
                        }
                    }

                    requestAnimationFrame(update);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(el => observer.observe(el));
    }

    // --- Navigate to login/dashboard ---
    window.navigateToApp = function() {
        // Close mobile landing menu overlay if open
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            navLinks.classList.remove('mobile-open');
        }

        const landingPage = document.getElementById('landingSection');
        const authSection = document.getElementById('authSection');
        const dashboardSection = document.getElementById('dashboardSection');

        // Check if user is already logged in
        const savedUser = localStorage.getItem('basta_username');
        
        if (landingPage) {
            landingPage.classList.add('hidden');
        }

        if (savedUser) {
            // User is already logged in - show dashboard
            if (authSection) authSection.classList.add('hidden');
            if (dashboardSection) dashboardSection.classList.remove('hidden');
            if (typeof showDashboard === 'function') {
                showDashboard(savedUser);
            }
        } else {
            // Show login screen
            if (authSection) authSection.classList.remove('hidden');
        }
    };

    // --- Handle smooth scroll for nav links ---
    function initSmoothScroll() {
        document.querySelectorAll('.landing-page a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // --- Parallax effect for hero leaf ---
    function initParallax() {
        const heroImage = document.querySelector('.hero-image');
        if (!heroImage) return;

        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            const rate = scrolled * 0.15;
            if (scrolled < window.innerHeight) {
                heroImage.style.transform = `translateY(calc(-50% + ${rate}px))`;
            }
        });
    }

    // --- Init all landing page features ---
    document.addEventListener('DOMContentLoaded', () => {
        // Only run if landing page exists
        if (!document.getElementById('landingSection')) return;

        // Dynamically change button label to "Dashboard" if logged in
        try {
            const savedUser = localStorage.getItem('basta_username');
            if (savedUser) {
                const navBtn = document.querySelector('.nav-btn');
                if (navBtn) {
                    navBtn.textContent = 'Dashboard';
                }
            }
        } catch (e) {
            console.error("Error checking session on landing load:", e);
        }

        initRevealAnimations();
        animateCounters();
        initSmoothScroll();
        initParallax();
    });
})();
