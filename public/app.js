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
})();
