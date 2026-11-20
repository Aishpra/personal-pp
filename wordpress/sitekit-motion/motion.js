/* SiteKit Motion. Uses GSAP (ScrollTrigger + SplitText) when it has loaded, and falls back to
   lighter CSS/IntersectionObserver animations when it hasn't. Visitors who prefer reduced
   motion get a still page either way. */
(() => {
	const root = document.documentElement;
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const finePointer = matchMedia('(pointer: fine)').matches;
	const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
	if (G) {
		G.registerPlugin(window.ScrollTrigger);
		if (window.SplitText) G.registerPlugin(window.SplitText);
		if (!reduce) root.classList.add('sk-gsap');
	}

	const hero = document.querySelector('.sk-hero');
	const h1 = hero && hero.querySelector('h1');
	const heroImg = hero && hero.querySelector('.wp-block-cover__image-background');
	const collage = hero ? [...hero.querySelectorAll('.sk-hero-collage > figure')] : [];
	const badge = hero && hero.querySelector('.sk-hero-badge');

	// Content that reveals on scroll: section content, columns, gallery photos.
	const targets = [];
	const mark = (el, kind, d) => {
		if (!el || el.hasAttribute('data-sk-reveal') || el.closest('.sk-hero, header, [data-sk-reveal]')) return;
		el.setAttribute('data-sk-reveal', kind || '');
		el.style.setProperty('--sk-d', d || 0);
		targets.push(el);
	};
	document.querySelectorAll('.sk-gallery figure.wp-block-image').forEach((el, i) => mark(el, 'zoom', i % 6));
	document.querySelectorAll('.sk-section .wp-block-columns, .sk-footer .wp-block-columns').forEach((cols) => {
		[...cols.children].forEach((col, i) => mark(col, '', i));
	});
	// Cards and links inside custom blocks stagger one by one.
	document.querySelectorAll('.sk-qcard, .sk-jump a').forEach((el, i) => mark(el, '', i % 6));
	// Photo banners on inner pages: animate the text lines, never the photo itself.
	document.querySelectorAll('.sk-pagehero-text').forEach((t) => [...t.children].forEach((el, i) => {
		if (G && !reduce && el.matches('h1')) return;
		mark(el, '', i);
	}));
	document.querySelectorAll('.sk-section, .sk-banner:not(.sk-pagehero)').forEach((sec) => {
		const inner = sec.querySelector(':scope > .wp-block-group__inner-container') || sec;
		[...inner.children].forEach((el, i) => {
			if (el.matches('.wp-block-columns, .wp-block-gallery, .sk-gallery') || el.querySelector('[data-sk-reveal]')) return;
			if (G && !reduce && el.matches('h1, h2')) return; // GSAP animates these word by word
			mark(el, '', Math.min(i, 4));
		});
	});
	const showAll = () => targets.forEach((el) => el.classList.add('sk-in'));

	if (reduce) {
		showAll();
		addEventListener('scroll', () => root.classList.toggle('sk-scrolled', scrollY > 40), { passive: true });
	} else if (G) {
		gsapMotion();
	} else {
		cssMotion();
	}

	// ---------------------------------------------------------------- GSAP version
	function gsapMotion() {
		const gsap = G;
		const split = (el, type) => (window.SplitText ? window.SplitText.create(el, { type, mask: type.includes('chars') ? 'words' : 'lines', wordsClass: 'sk-gword', charsClass: 'sk-gchar' }) : null);

		// Hero: one timeline. Wait for fonts so letters are split at their final width.
		const runHero = () => {
			if (!hero) return;
			const text = [...hero.querySelectorAll('.sk-hero-text > *')].filter((el) => el !== h1);
			const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
			// Devanagari (Nepali) letters join into conjuncts, so split those headlines by word only.
			const joined = h1 && /[\u0900-\u097F]/.test(h1.textContent);
			const s = h1 ? split(h1, joined ? 'words' : 'words,chars') : null;
			let lastWord = null;
			if (s) {
				if (s.words.length > 1) lastWord = s.words[s.words.length - 1];
				tl.from(joined ? s.words : s.chars, { yPercent: 115, rotate: 8, opacity: 0, duration: 1, stagger: 0.022 }, 0.15);
			} else if (h1) {
				tl.from(h1, { y: 40, opacity: 0, duration: 0.9 }, 0.15);
			}
			tl.from(text, { y: 34, opacity: 0, duration: 0.9, stagger: 0.09 }, 0.35);
			if (collage.length) {
				tl.from(collage, { y: 90, scale: 0.78, rotation: (i) => (i ? -16 : 14), opacity: 0, duration: 1.3, stagger: 0.16, ease: 'back.out(1.5)' }, 0.25);
			}
			if (badge) {
				tl.from(badge, { scale: 0, rotation: -25, opacity: 0, duration: 1.1, ease: 'elastic.out(1, 0.55)' }, 0.95);
				gsap.to(badge, { y: -10, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2.2 });
			}
			// The last word's highlight (underline, outline or tint, by design style) starts once the letters land.
			tl.add(() => lastWord && lastWord.classList.add('sk-word-last'), '-=0.4');

			// Scrolling past the hero: the content drifts up and fades, the collage lags behind.
			const content = hero.querySelector('.sk-hero-text');
			const visual = hero.querySelector('.sk-hero-visual');
			const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 };
			if (content) gsap.to(content, { y: -90, opacity: 0.15, ease: 'none', scrollTrigger: st });
			if (visual) gsap.to(visual, { y: -160, ease: 'none', scrollTrigger: { ...st } });
		};
		(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(runHero);

		// Section headings slide up word by word.
		document.querySelectorAll('.sk-section h2.wp-block-heading, .sk-banner h1, .sk-cta h2').forEach((h) => {
			const s = split(h, 'words');
			gsap.from(s ? s.words : h, { yPercent: s ? 110 : 0, y: s ? 0 : 30, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
		});

		// Everything else reveals in staggered batches as it scrolls into view.
		gsap.set(targets, { opacity: 0, y: 46 });
		window.ScrollTrigger.batch(targets, {
			start: 'top 90%',
			once: true,
			onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.11, overwrite: true, onComplete: () => batch.forEach((el) => el.classList.add('sk-in')) }),
		});

		// Photos are uncovered with a wipe and settle from a slight zoom.
		document.querySelectorAll('.wp-block-post-content .wp-block-image').forEach((fig) => {
			if (fig.closest('.sk-hero, .sk-gallery')) return;
			const img = fig.querySelector('img');
			const tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 85%', once: true } });
			tl.fromTo(fig, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut', clearProps: 'clipPath' });
			if (img) tl.from(img, { scale: 1.3, duration: 1.6, ease: 'power3.out' }, 0);
		});

		// Facts: numbers count up.
		document.querySelectorAll('.sk-facts h3').forEach((el) => {
			const m = el.textContent.trim().match(/^(\d{1,5})(\D{0,3})$/);
			if (!m) return;
			const obj = { v: 0 }, end = Number(m[1]), suffix = m[2];
			gsap.to(obj, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; } });
		});

		// Buttons lean toward the pointer (smoothed).
		if (finePointer) {
			document.querySelectorAll('.wp-element-button').forEach((b) => {
				const xTo = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3' });
				const yTo = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3' });
				b.addEventListener('pointermove', (e) => {
					const r = b.getBoundingClientRect();
					xTo((e.clientX - r.left - r.width / 2) * 0.25);
					yTo((e.clientY - r.top - r.height / 2) * 0.35);
				});
				b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
			});
		}
		common();
	}

	// ---------------------------------------------------------------- Lighter version
	function cssMotion() {
		if (h1) {
			let i = 0;
			const walk = (node) => {
				for (const n of [...node.childNodes]) {
					if (n.nodeType === 3) {
						const frag = document.createDocumentFragment();
						for (const t of n.textContent.split(/(\s+)/)) {
							if (!t) continue;
							if (/^\s+$/.test(t)) { frag.append(t); continue; }
							const s = document.createElement('span');
							s.className = 'sk-word';
							s.style.setProperty('--i', i++);
							s.textContent = t;
							frag.append(s);
						}
						n.replaceWith(frag);
					} else if (n.nodeType === 1) walk(n);
				}
			};
			walk(h1);
			const words = h1.querySelectorAll('.sk-word');
			if (words.length > 1) words[words.length - 1].classList.add('sk-word-last');
		}
		if ('IntersectionObserver' in window) {
			const io = new IntersectionObserver((entries) => {
				for (const e of entries) if (e.isIntersecting) { e.target.classList.add('sk-in'); io.unobserve(e.target); }
			}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
			targets.forEach((el) => io.observe(el));
		} else showAll();
		document.querySelectorAll('.sk-facts h3').forEach((el) => {
			const m = el.textContent.trim().match(/^(\d{1,5})(\D{0,3})$/);
			if (!m) return;
			const end = Number(m[1]), suffix = m[2];
			const co = new IntersectionObserver(([e]) => {
				if (!e.isIntersecting) return;
				co.disconnect();
				const t0 = performance.now();
				const tick = (t) => {
					const p = Math.min(1, (t - t0) / 1400);
					el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
					if (p < 1) requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			}, { threshold: 0.6 });
			co.observe(el);
		});
		if (finePointer) {
			document.querySelectorAll('.wp-element-button').forEach((b) => {
				b.addEventListener('pointermove', (e) => {
					const r = b.getBoundingClientRect();
					b.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`;
				});
				b.addEventListener('pointerleave', () => { b.style.translate = ''; });
			});
		}
		common();
	}

	// ---------------------------------------------------------------- Both versions
	function common() {
		// Header gains a shadow after scrolling; hero photo moves slower than the page.
		let ticking = false;
		const onScroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				ticking = false;
				root.classList.toggle('sk-scrolled', scrollY > 40);
				if (heroImg && scrollY < hero.offsetHeight) heroImg.style.translate = `0 ${Math.round(scrollY * 0.3)}px`;
			});
		};
		addEventListener('scroll', onScroll, { passive: true });
		onScroll();

		// Hero collage layers follow the pointer at different depths.
		if (collage.length && finePointer) {
			let raf = 0;
			hero.addEventListener('pointermove', (e) => {
				cancelAnimationFrame(raf);
				raf = requestAnimationFrame(() => {
					const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
					collage.forEach((f, i) => {
						const d = i === 0 ? -16 : 26;
						f.style.translate = `${(x * d).toFixed(1)}px ${(y * d).toFixed(1)}px`;
					});
				});
			});
		}
	}

	// The "scroll down" cue glides to the next section (works with or without motion).
	const cue = document.querySelector('.sk-scroll-cue');
	if (cue) cue.addEventListener('click', (e) => {
		const next = cue.closest('.sk-hero')?.nextElementSibling;
		if (!next) return;
		e.preventDefault();
		next.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
	});

	// ---------------------------------------------------------------- Navigation extras
	// The mobile menu also gets the main button and the quick contact links.
	const menu = document.querySelector('header .wp-block-navigation__responsive-container-content');
	if (menu && !menu.querySelector('.sk-menu-extra')) {
		const box = document.createElement('div');
		box.className = 'sk-menu-extra';
		const cta = document.querySelector('header .sk-nav .wp-block-button__link');
		if (cta) box.append(cta.cloneNode(true));
		document.querySelectorAll('.sk-topbar__right a').forEach((a) => box.append(a.cloneNode(true)));
		if (box.children.length) menu.append(box);
	}

	// Back to top, with a ring that fills as you scroll.
	const top = document.createElement('button');
	top.type = 'button';
	top.className = 'sk-totop';
	top.setAttribute('aria-label', 'Back to top');
	top.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="sk-totop__track" cx="24" cy="24" r="21"/><circle class="sk-totop__ring" cx="24" cy="24" r="21"/><path d="M24 31V17M17 23l7-7 7 7"/></svg>';
	document.body.append(top);
	const ring = top.querySelector('.sk-totop__ring');
	const updateTop = () => {
		const max = document.documentElement.scrollHeight - innerHeight;
		const p = max > 0 ? Math.min(1, scrollY / max) : 0;
		ring.style.strokeDashoffset = String(132 * (1 - p));
		top.classList.toggle('is-visible', scrollY > 600);
	};
	addEventListener('scroll', updateTop, { passive: true });
	updateTop();
	top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

	// Page transitions: a curtain in the brand's dark colour covers the screen when you follow
	// a link to another page of the site; the next page opens from behind it (CSS, see
	// sitekit-motion.php), so there is no flash before scripts load.
	if (!reduce) {
		addEventListener('click', (e) => {
			const a = e.target.closest && e.target.closest('a[href]');
			if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			if (a.target && a.target !== '_self') return;
			if (a.hasAttribute('download')) return;
			const url = new URL(a.href, location.href);
			if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
			if (url.pathname === location.pathname && url.search === location.search) return; // same page / anchors
			if (/\/wp-(admin|login)/.test(url.pathname)) return;
			e.preventDefault();
			const curtain = document.createElement('div');
			curtain.className = 'sk-curtain';
			document.body.append(curtain);
			requestAnimationFrame(() => requestAnimationFrame(() => curtain.classList.add('is-on')));
			try { sessionStorage.setItem('sk-t', '1'); } catch (err) { /* private mode: no reveal, still navigates */ }
			setTimeout(() => { location.href = url.href; }, 480);
		});
		addEventListener('pageshow', (e) => { if (e.persisted) document.querySelectorAll('.sk-curtain').forEach((c) => c.remove()); });
	}
})();

/* Interactive sections and dark mode. Plain JavaScript, independent of GSAP. */
(() => {
	const root = document.documentElement;
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const btn = (cls, label, html) => {
		const b = document.createElement('button');
		b.type = 'button';
		if (cls) b.className = cls;
		b.setAttribute('aria-label', label);
		b.innerHTML = html || '';
		return b;
	};

	// Testimonial slider: arrows, dots, and a gentle autoplay while it is on screen.
	document.querySelectorAll('[data-sk-slider]').forEach((slider) => {
		const track = slider.querySelector('.sk-tslider__track');
		const slides = track ? [...track.children] : [];
		if (slides.length < 2) return;
		const nav = document.createElement('div');
		nav.className = 'sk-tslider__nav';
		const dots = document.createElement('div');
		dots.className = 'sk-tslider__dots';
		const dotBtns = slides.map((_, i) => btn('', `Show testimonial ${i + 1}`));
		dots.append(...dotBtns);
		const prev = btn('', 'Previous testimonial', '←');
		const next = btn('', 'Next testimonial', '→');
		nav.append(prev, dots, next);
		slider.append(nav);
		let index = 0;
		const go = (i) => {
			index = (i + slides.length) % slides.length;
			track.scrollTo({ left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
		};
		const sync = () => {
			const x = track.scrollLeft;
			let best = 0;
			slides.forEach((s, i) => { if (Math.abs(s.offsetLeft - slides[0].offsetLeft - x) < Math.abs(slides[best].offsetLeft - slides[0].offsetLeft - x)) best = i; });
			index = best;
			dotBtns.forEach((d, i) => d.setAttribute('aria-current', String(i === best)));
		};
		track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
		sync();
		prev.addEventListener('click', () => go(index - 1));
		next.addEventListener('click', () => go(index + 1));
		dotBtns.forEach((d, i) => d.addEventListener('click', () => go(i)));
		// Autoplay: only on screen, never while the visitor is reading or interacting.
		if (reduce) return;
		let visible = false, paused = false;
		new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(slider);
		['pointerenter', 'focusin', 'touchstart'].forEach((ev) => slider.addEventListener(ev, () => { paused = true; }, { passive: true }));
		['pointerleave', 'focusout'].forEach((ev) => slider.addEventListener(ev, () => { paused = false; }));
		setInterval(() => { if (visible && !paused && !document.hidden) go(index + 1); }, 6500);
	});

	// Before / after: stack the photos and add a drag handle (a range input, so it works
	// with touch, mouse and keyboard).
	document.querySelectorAll('[data-sk-ba]').forEach((ba) => {
		ba.classList.add('is-live');
		const range = document.createElement('input');
		range.type = 'range';
		range.min = '0';
		range.max = '100';
		range.value = '50';
		range.className = 'sk-ba__range';
		range.setAttribute('aria-label', 'Drag to compare before and after');
		const handle = document.createElement('span');
		handle.className = 'sk-ba__handle';
		handle.setAttribute('aria-hidden', 'true');
		ba.append(range, handle);
		range.addEventListener('input', () => ba.style.setProperty('--pos', `${range.value}%`));
	});

	// Opening hours: highlight today's line ("Sun - Fri", "Saturday", "Daily", "Weekends").
	const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	const today = new Date().getDay();
	const covers = (text) => {
		const t = text.toLowerCase();
		if (/daily|every ?day|all week|7 days|दैनिक|हरेक दिन|सातै दिन/.test(t)) return true;
		if (/weekend/.test(t)) return today === 0 || today === 6;
		if (/weekday/.test(t)) return today >= 1 && today <= 5;
		const NE_DAYS = ['आइत', 'सोम', 'मङ्गल|मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'];
		const re = new RegExp(`\\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*|(${NE_DAYS.join('|')})`, 'g');
		const found = [...t.matchAll(re)].map((m) => (m[1] ? DAYS.indexOf(m[1]) : NE_DAYS.findIndex((d) => d.split('|').includes(m[2]))));
		if (!found.length) return false;
		if (found.length >= 2 && /[-–—]|\bto\b|देखि/.test(t)) {
			for (let i = found[0], n = 0; n < 7; i = (i + 1) % 7, n++) {
				if (i === today) return true;
				if (i === found[1]) break;
			}
			return found.slice(2).includes(today);
		}
		return found.includes(today);
	};
	document.querySelectorAll('.sk-hours').forEach((card) => {
		const line = [...card.querySelectorAll('li[data-days]')].find((li) => covers(li.dataset.days));
		if (line) line.classList.add('is-today');
	});

	// Dark mode switch in the header; the choice is remembered (see the head script).
	const nav = document.querySelector('.sk-nav');
	if (nav) {
		const moon = '<svg class="sk-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>';
		const sun = '<svg class="sk-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
		const toggle = btn('sk-darktoggle', 'Dark mode', moon + sun);
		const set = (on) => {
			root.classList.toggle('sk-dark', on);
			toggle.setAttribute('aria-pressed', String(on));
			try { localStorage.setItem(window.skThemeKey || 'sk-theme', on ? 'dark' : 'light'); } catch (e) { /* storage blocked */ }
		};
		toggle.setAttribute('aria-pressed', String(root.classList.contains('sk-dark')));
		toggle.addEventListener('click', () => set(!root.classList.contains('sk-dark')));
		nav.prepend(toggle);
	}
})();
