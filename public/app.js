// Progressive enhancements for SiteKit. Every page works without this file.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Toasts
  const toastBox = $('.toasts');
  function toast(message, type = 'ok') {
    if (!toastBox) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastBox.append(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // Flash messages fade away on their own.
  $$('[data-autohide]').forEach((el) => setTimeout(() => el.classList.add('hide'), 4500));

  // Buttons that show a busy state while the form submits (push, save).
  $$('form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirm && !confirm(form.dataset.confirm)) {
        e.preventDefault();
        return;
      }
      const btn = $('[data-busy]', form);
      if (!btn) return;
      btn.disabled = true;
      btn.classList.add('busy');
      const label = $('span', btn) || btn;
      label.textContent = btn.dataset.busy;
    });
  });

  // Copy buttons
  $$('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const target = $(btn.dataset.copy);
      try {
        await navigator.clipboard.writeText(target.textContent);
        toast('Copied to clipboard');
      } catch {
        toast('Copy failed: select the text and copy it manually', 'error');
      }
    })
  );

  // Checklist auto-save
  const checklist = $('[data-autosave]');
  if (checklist) {
    const state = $('[data-save-state]', checklist);
    let timer;
    checklist.addEventListener('change', () => {
      clearTimeout(timer);
      state.textContent = 'Saving…';
      timer = setTimeout(save, 250);
    });
    async function save() {
      try {
        const res = await fetch(checklist.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams(new FormData(checklist)),
        });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        state.textContent = 'Saved';
        setTimeout(() => (state.textContent = ''), 1500);
        update(data);
      } catch {
        state.textContent = '';
        toast('Could not save the checklist. Is SiteKit still running?', 'error');
      }
    }
    function update(data) {
      const bar = $('[data-total-bar]');
      if (bar) bar.style.setProperty('--w', `${data.pct}%`);
      const total = $('[data-total]');
      if (total) total.textContent = `${data.done}/${data.total} tasks · ${data.pct}%`;
      const current = data.phases.find((p) => !p.complete);
      data.phases.forEach((p, i) => {
        const el = $(`[data-phase="${p.id}"]`);
        if (el) {
          $('[data-count]', el).textContent = `${p.done}/${p.total}`;
          el.classList.toggle('complete', p.complete);
          el.classList.toggle('current', current && current.id === p.id);
        }
        const step = $$('.stepper.with-labels .step')[i];
        if (step) {
          step.classList.remove('done', 'current', 'todo');
          step.classList.add(p.complete ? 'done' : current && current.id === p.id ? 'current' : 'todo');
          const count = $('.step-count', step);
          if (count) count.textContent = `${p.done}/${p.total}`;
        }
      });
    }
  }

  // Upload drop zones with previews and early warnings.
  const MAX_BYTES = 10 * 1024 * 1024;
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  $$('[data-dropzone]').forEach((zone) => {
    const input = $('input[type=file]', zone);
    const kind = zone.dataset.kind;
    const preview = $(`[data-preview-for="${kind}"]`);
    const warnings = $(`[data-warnings-for="${kind}"]`);

    ['dragenter', 'dragover'].forEach((ev) =>
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.add('over');
      })
    );
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove('over')));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!e.dataTransfer.files.length) return;
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    });

    input.addEventListener('change', () => {
      const files = [...input.files];
      const notes = [];
      preview.innerHTML = '';
      if (kind === 'media' && files.length > 20) notes.push(`${files.length} photos selected: only the first 20 will be kept.`);
      files.forEach((file, i) => {
        if (!TYPES.includes(file.type)) notes.push(`${file.name}: not a PNG, JPG or WebP. It will be rejected.`);
        else if (file.size > MAX_BYTES) notes.push(`${file.name}: over 10 MB. Compress it first.`);
        if (!TYPES.includes(file.type)) return;
        const img = new Image();
        img.alt = file.name;
        img.style.setProperty('--i', i);
        img.onload = () => {
          if (kind === 'logo' && img.naturalWidth < 500) {
            warnings.insertAdjacentHTML('beforeend', `<p>Logo is only ${img.naturalWidth}px wide and will look blurry. Ask for a bigger PNG.</p>`);
          }
        };
        img.src = URL.createObjectURL(file);
        preview.append(img);
      });
      warnings.innerHTML = notes.map((n) => `<p>${n.replace(/</g, '&lt;')}</p>`).join('');
      zone.classList.toggle('has-files', files.length > 0);
      $('.dz-text', zone).innerHTML = files.length
        ? `<strong>${files.length} file${files.length === 1 ? '' : 's'} selected</strong> · click to change`
        : '<strong>Drop files here</strong> or click to browse';
    });
  });

  // Colour inputs show their hex value.
  $$('[data-colour]').forEach((input) => {
    const out = input.parentElement.querySelector('[data-hex]');
    input.addEventListener('input', () => (out.textContent = input.value));
  });

  // AI copy job: poll until the local model finishes, then reload to show the copy.
  const job = $('[data-copy-job]');
  if (job) {
    const msg = $('[data-job-message]', job);
    const secs = $('[data-job-seconds]', job);
    const poll = async () => {
      try {
        const res = await fetch(job.dataset.copyJob, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (data.status === 'running') {
          msg.textContent = data.message;
          secs.textContent = data.seconds;
          setTimeout(poll, 2000);
        } else {
          location.hash = 'copy';
          location.reload();
        }
      } catch {
        setTimeout(poll, 5000);
      }
    };
    setTimeout(poll, 2000);
  }

  // Character counters on fields with a recommended length (SEO title/description etc.).
  $$('textarea[data-limit]').forEach((field) => {
    const out = field.parentElement.querySelector('.count');
    const limit = Number(field.dataset.limit);
    const update = () => {
      const n = field.value.length;
      out.textContent = `${n}/${limit}`;
      out.classList.toggle('over', n > limit);
    };
    field.addEventListener('input', update);
    update();
  });

  // Highlight the intake section currently on screen.
  const stepLinks = $$('.form-steps a');
  if (stepLinks.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          stepLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    $$('form[data-intake] fieldset').forEach((fs) => io.observe(fs));
  }

  // Live style preview on the intake form: redraws as the form changes.
  const sp = $('[data-style-preview]');
  const form = sp && sp.closest('form');
  if (sp && form) {
    const field = (name) => form.elements[name];
    const val = (name, fallback) => (field(name) && field(name).value.trim()) || fallback;
    const setText = (key, text) => $$(`[data-sp="${key}"]`, sp).forEach((el) => (el.textContent = text));
    const domainFor = (name) => name.toLowerCase().split('').filter((ch) => /[a-z0-9]/.test(ch)).join('') || 'yourbusiness';
    let photoUrl = sp.dataset.photo || '';
    let photo2 = sp.dataset.photo2 || '';
    const draw = () => {
      const name = val('businessName', 'Your business');
      setText('name', name);
      setText('initial', name.charAt(0).toUpperCase());
      setText('tagline', val('tagline', 'A short line about what you do best'));
      setText('location', val('location', 'Your city'));
      setText('cta', val('ctaLabel', 'Get a quote'));
      setText('years', `${val('yearsInBusiness', '10')}+`);
      setText('domain', val('domain', `${domainFor(name)}.com`));
      const services = val('services', '').split('\n').map((l) => l.split(':')[0].trim()).filter(Boolean);
      ['Our main service', 'Something we do well', 'Another service'].forEach((d, i) => setText(`service${i}`, services[i] || d));
      for (const [input, prop] of [['colourPrimary', '--p'], ['colourSecondary', '--d'], ['colourAccent', '--a']]) {
        if (field(input)) sp.style.setProperty(prop, field(input).value);
      }
      sp.dataset.style = val('style', 'classic');
      $('.sp-hero', sp).style.backgroundImage = photoUrl ? `url("${photoUrl}")` : '';
      const [tileA, tileB] = $$('.sp-collage span', sp);
      tileA.style.backgroundImage = photo2 ? `url("${photo2}")` : photoUrl ? `url("${photoUrl}")` : '';
      tileB.style.backgroundImage = photoUrl ? `url("${photoUrl}")` : '';
    };
    form.addEventListener('input', draw);
    form.addEventListener('change', (e) => {
      if (e.target.name === 'media' && e.target.files && e.target.files.length) {
        photoUrl = URL.createObjectURL(e.target.files[0]);
        photo2 = e.target.files[1] ? URL.createObjectURL(e.target.files[1]) : '';
      }
      draw();
    });
    draw();
  }
})();
